import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../../data/foods';
import type { Food, Recipe } from '../../db/types';
import { sequentialIds } from '../id';
import { readPastedText } from './clipboard';
import { parseMinutes, recipeMinutes } from './duration';
import { COOKPAD_LIKE, DELISH_LIKE, KURASHIRU_LIKE, PAGE_TEXT, STEP_TEXT } from './fixtures';
import {
  findRecipeByUrl,
  initialDifficulty,
  initialFormState,
  normalizeRecipeUrl,
  planImportSave,
  type ImportFormState,
} from './importSave';
import { splitIngredientLine } from './ingredientLine';
import { readIngredientLine, readIngredients } from './matchIngredients';
import { titleToName } from './pageText';
import { parseRecipeAmount, toRecipeFoodAmount } from './recipeAmount';
import { parseServings } from './servings';
import type { ImportedPage } from './types';

const foods = INITIAL_FOODS;
const food = (id: string) => foods.find((f) => f.id === id) as Food;

/** ショートカットがコピーする形にする */
function shortcutJson(recipe: Record<string, unknown>, url: string): string {
  return JSON.stringify({
    kondate: 1,
    kind: 'recipe',
    url,
    name: recipe.name,
    recipeIngredient: recipe.recipeIngredient,
    totalTime: recipe.totalTime ?? null,
    cookTime: recipe.cookTime ?? null,
    prepTime: recipe.prepTime ?? null,
    recipeYield: recipe.recipeYield,
  });
}

function readOk(text: string): ImportedPage {
  const result = readPastedText(text);
  if (!result.ok) throw new Error(result.error);
  return result.page;
}

describe('時間と人数の読み取り', () => {
  it.each([
    ['PT15M', 15],
    ['PT1H30M', 90],
    ['P0DT0H20M', 20],
    ['約15分', 15],
    ['1時間30分', 90],
    ['1時間半', 90],
    ['10〜15分', 10],
    ['PT', null],
    ['すぐ', null],
  ])('%s → %s分', (text, minutes) => {
    expect(parseMinutes(text)).toBe(minutes);
  });

  it('合計の時間がなければ、調理と下ごしらえの時間を足す', () => {
    expect(recipeMinutes({ totalTime: 'PT20M', cookTime: 'PT10M' })).toBe(20);
    expect(recipeMinutes({ cookTime: 'PT1H', prepTime: 'PT10M' })).toBe(70);
    expect(recipeMinutes({})).toBeNull();
  });

  it.each([
    ['2人分', 2],
    ['2人前', 2],
    ['4', 4],
    ['2〜3人分', 2],
    ['4 servings', 4],
    ['12個分', null],
    ['', null],
  ])('%s → %s人', (text, n) => {
    expect(parseServings(text)).toBe(n);
  });

  it('配列なら、読めた最初のもの', () => {
    expect(parseServings(['12個分', '3人分'])).toBe(3);
  });
});

describe('量の読み取り', () => {
  it.each([
    ['200g', { kind: 'number', value: 200, unit: 'g' }],
    ['1.5kg', { kind: 'number', value: 1500, unit: 'g' }],
    ['大さじ1と1/2', { kind: 'number', value: 1.5, unit: '大さじ' }],
    ['大さじ1・1/2', { kind: 'number', value: 1.5, unit: '大さじ' }],
    ['小さじ1/2', { kind: 'number', value: 0.5, unit: '小さじ' }],
    ['大1', { kind: 'number', value: 1, unit: '大さじ' }],
    ['小1/2', { kind: 'number', value: 0.5, unit: '小さじ' }],
    ['カップ1', { kind: 'number', value: 1, unit: 'カップ' }],
    ['1/4個', { kind: 'number', value: 0.25, unit: '個' }],
    ['½個', { kind: 'number', value: 0.5, unit: '個' }],
    ['1本半', { kind: 'number', value: 1.5, unit: '本' }],
    ['1片', { kind: 'number', value: 1, unit: 'かけ' }],
    ['ひとかけ', { kind: 'number', value: 1, unit: 'かけ' }],
    ['2〜3個', { kind: 'number', value: 2, unit: '個' }],
    ['各大さじ2', { kind: 'number', value: 2, unit: '大さじ' }],
    ['200cc', { kind: 'number', value: 200, unit: 'ml' }],
    ['1パック(200g)', { kind: 'number', value: 1, unit: 'パック' }],
    ['少々', { kind: 'vague', teaspoons: 1 / 8 }],
    ['ひとつまみ', { kind: 'vague', teaspoons: 1 / 8 }],
    ['適量', { kind: 'vague', teaspoons: 1 }],
    ['お好みで', { kind: 'vague', teaspoons: 1 }],
    ['なし', null],
  ])('%s', (text, expected) => {
    expect(parseRecipeAmount(text)).toEqual(expected);
  });

  it('辞書の単位へ換算する', () => {
    const soy = food('soy_sauce'); // 大さじ
    expect(toRecipeFoodAmount({ kind: 'number', value: 3, unit: '小さじ' }, soy)).toEqual({ amount: 1, note: 'converted' });
    expect(toRecipeFoodAmount({ kind: 'number', value: 30, unit: 'ml' }, soy)).toEqual({ amount: 2, note: 'converted' });
    // 調味料の g は 1ml≒1g とみなす
    expect(toRecipeFoodAmount({ kind: 'number', value: 1, unit: '大さじ' }, food('butter'))).toEqual({ amount: 15, note: 'converted' });
    // 牛乳(ml)に大さじ
    expect(toRecipeFoodAmount({ kind: 'number', value: 2, unit: '大さじ' }, food('milk'))).toEqual({ amount: 30, note: 'converted' });
    // 「個」はどの数える単位にも合わせる
    expect(toRecipeFoodAmount({ kind: 'number', value: 2, unit: '個' }, food('carrot'))).toEqual({ amount: 2, note: null });
    // パックで辞書が g → ふつうの量×数
    expect(toRecipeFoodAmount({ kind: 'number', value: 1, unit: 'パック' }, food('pork_koma'))).toEqual({ amount: 300, note: 'unit-mismatch' });
    // 重さで辞書が本 → 決められない
    expect(toRecipeFoodAmount({ kind: 'number', value: 100, unit: 'g' }, food('carrot'))).toEqual({ amount: null, note: 'unit-mismatch' });
    // 食材(調味料でない)の g とかさは換算しない
    expect(toRecipeFoodAmount({ kind: 'number', value: 1, unit: '大さじ' }, food('pork_koma'))).toEqual({ amount: null, note: 'unit-mismatch' });
  });

  it('数字でない量:かさ・g の材料は小さじ何杯分を換算、数える単位の材料は空欄', () => {
    expect(toRecipeFoodAmount({ kind: 'vague', teaspoons: 1 / 8 }, food('salt'))).toEqual({ amount: 0.125, note: 'not-number' });
    expect(toRecipeFoodAmount({ kind: 'vague', teaspoons: 1 }, food('salad_oil'))).toEqual({ amount: 0.333, note: 'not-number' });
    expect(toRecipeFoodAmount({ kind: 'vague', teaspoons: 1 }, food('scallion'))).toEqual({ amount: null, note: 'not-number' });
    // 量が書いていないときも、適量と同じ
    expect(toRecipeFoodAmount(null, food('salad_oil'))).toEqual({ amount: 0.333, note: 'not-number' });
  });
});

describe('材料の行を分ける', () => {
  it.each([
    ['豚こま切れ肉 200g', '豚こま切れ肉', '200g'],
    ['●醤油 大さじ2', '醤油', '大さじ2'],
    ['(A)砂糖 小さじ1', '砂糖', '小さじ1'],
    ['【A】みりん 大さじ1', 'みりん', '大さじ1'],
    ['A しょうゆ 大さじ1', 'しょうゆ', '大さじ1'],
    ['玉ねぎ(中) 1/2個', '玉ねぎ', '1/2個'],
    ['豚バラ肉 (薄切り) 200g', '豚バラ肉', '200g'],
    ['醤油大さじ2', '醤油', '大さじ2'],
    ['塩こしょう少々', '塩こしょう', '少々'],
    ['お好み焼き粉 100g', 'お好み焼き粉', '100g'],
    ['ミックス ベジタブル 100g', 'ミックス ベジタブル', '100g'],
    ['しょうゆ 大さじ 1', 'しょうゆ', '大さじ 1'],
    ['サラダ油', 'サラダ油', ''],
  ])('%s', (line, name, amountText) => {
    expect(splitIngredientLine(line)).toEqual({ name, amountText });
  });

  it.each(['<合わせ調味料>', '【A】', 'A', 'タレ:', '★'])('見出しの行は捨てる:%s', (line) => {
    expect(splitIngredientLine(line)).toBeNull();
  });
});

describe('3サイトの形の構造化データを読む', () => {
  it('クックパッドの形(Recipe が1つ、時間なし)', () => {
    const page = readOk(shortcutJson(COOKPAD_LIKE, 'https://cookpad.example/recipe/1'));
    expect(page).toMatchObject({
      from: '構造化データ',
      url: 'https://cookpad.example/recipe/1',
      name: 'テスト用 豚こまのしょうが焼き風',
      minutes: null,
      servings: 2,
    });
    expect(page.ingredientLines).toHaveLength(7);
  });

  it('クラシルの形(@graph の中)', () => {
    const page = readOk(shortcutJson(KURASHIRU_LIKE['@graph'][1], 'https://kurashiru.example/recipes/abc'));
    expect(page).toMatchObject({ name: 'テスト用 ほうれん草と卵の炒め物', minutes: 15, servings: 2 });
  });

  it('デリッシュキッチンの形(配列の中、@type も配列、調理+下ごしらえの時間)', () => {
    const page = readOk(shortcutJson(DELISH_LIKE[1], 'https://delish.example/recipe/9'));
    expect(page).toMatchObject({ name: 'テスト用 鶏むね肉のみそ煮', minutes: 70, servings: 2 });
  });

  it('構造化データそのもの(JSON-LD)を貼っても読める', () => {
    for (const data of [COOKPAD_LIKE, KURASHIRU_LIKE, DELISH_LIKE]) {
      const page = readOk(JSON.stringify(data));
      expect(page.ingredientLines.length).toBeGreaterThan(0);
      expect(page.name).toMatch(/^テスト用/);
    }
  });

  it('作り方は読まない', () => {
    for (const data of [COOKPAD_LIKE, KURASHIRU_LIKE, DELISH_LIKE]) {
      expect(JSON.stringify(readOk(JSON.stringify(data)))).not.toContain(STEP_TEXT);
    }
  });

  it('材料を食材辞書と照らし合わせる(クックパッドの形)', () => {
    const items = readIngredients(COOKPAD_LIKE.recipeIngredient, foods);
    const by = (name: string) => items.find((i) => i.name === name);
    expect(by('豚こま切れ肉')).toMatchObject({ status: '自信がない', foodId: 'pork_koma', amount: 200, note: null });
    expect(by('玉ねぎ')).toMatchObject({ status: '読み取った', foodId: 'onion', amount: 0.5 });
    expect(by('しょうゆ')).toMatchObject({ status: '読み取った', foodId: 'soy_sauce', amount: 1 });
    // 生姜(かけ)を小さじで → 決められない
    expect(by('生姜')).toMatchObject({ status: '読み取った', foodId: 'ginger', amount: null, note: 'unit-mismatch' });
    // 塩こしょう → 塩とこしょうの両方が候補
    expect(by('塩こしょう')).toMatchObject({ status: '自信がない', candidateIds: ['salt', 'pepper'], note: 'not-number' });
    expect(by('サラダ油')).toMatchObject({ status: '読み取った', amount: 0.333, note: 'not-number' });
  });

  it('材料を食材辞書と照らし合わせる(クラシル・デリッシュキッチンの形)', () => {
    const k = readIngredients(KURASHIRU_LIKE['@graph'][1].recipeIngredient as string[], foods);
    expect(k.map((i) => [i.foodId, i.amount, i.status])).toEqual([
      ['spinach', 1, '読み取った'],
      ['egg', 2, '読み取った'],
      ['soy_sauce', 0.667, '読み取った'],
      ['sugar', 0.167, '読み取った'],
      ['sesame_oil', 1, '読み取った'],
      [null, null, '材料に入れない'],
    ]);
    const d = readIngredients(DELISH_LIKE[1].recipeIngredient as string[], foods);
    expect(d.map((i) => [i.foodId, i.amount, i.status])).toEqual([
      ['chicken_breast', 300, '読み取った'], // 1枚(300g) → 辞書は g なので ( ) の中
      ['daikon', 0.25, '読み取った'],
      ['miso', 1.5, '読み取った'],
      ['sugar', 1, '読み取った'],
      ['sake', 2, '読み取った'],
      [null, null, '材料に入れない'],
      ['scallion', null, '読み取った'],
    ]);
  });
});

describe('構造化データがないページの文字(予備の読み取り)', () => {
  it('材料・時間・人数を読み、名前と量が別の行でもまとめる', () => {
    const text = JSON.stringify({
      kondate: 1,
      kind: 'text',
      url: 'https://example.com/r/1',
      title: 'テスト用 キャベツとツナのサラダ | テストサイト',
      text: PAGE_TEXT,
    });
    const page = readOk(text);
    expect(page).toMatchObject({
      from: 'ページの文字',
      url: 'https://example.com/r/1',
      name: 'テスト用 キャベツとツナのサラダ',
      minutes: 10,
      servings: 2,
    });
    expect(page.ingredientLines).toEqual(['キャベツ 1/4個', 'ツナ缶 1缶', 'マヨネーズ 大さじ2', '塩 少々']);
    expect(page.ingredientLines.join()).not.toContain(STEP_TEXT);
  });

  it('ただの文字を貼っても読める(URL は文字の中から探す)', () => {
    const page = readOk(`https://example.com/r/2\n${PAGE_TEXT}`);
    expect(page.url).toBe('https://example.com/r/2');
    expect(page.name).toBe('');
    expect(page.ingredientLines).toHaveLength(4);
  });

  it('材料が見つからなければ知らせる', () => {
    expect(readPastedText('こんにちは').ok).toBe(false);
    expect(readPastedText('').ok).toBe(false);
    expect(readPastedText(JSON.stringify({ kondate: 1, kind: 'error', message: 'x' })).ok).toBe(false);
  });

  it.each([
    ['豚こまの生姜焼き 作り方・レシピ | テストサイト', '豚こまの生姜焼き'],
    ['簡単 豚こま炒め by テスト 【テストサイト】', '簡単 豚こま炒め'],
  ])('題名から料理名:%s', (title, name) => {
    expect(titleToName(title)).toBe(name);
  });
});

describe('保存するものを決める', () => {
  const KURASHIRU_URL = 'https://kurashiru.example/recipes/abc';
  const kurashiruForm = (): ImportFormState => {
    const page = readOk(shortcutJson(KURASHIRU_LIKE['@graph'][1], KURASHIRU_URL));
    const form = initialFormState(page, readIngredients(page.ingredientLines, foods));
    form.rows = form.rows.map((r) => (r.foodId === 'spinach' ? { ...r, main: true } : r));
    return form;
  };

  it('難易度の初期値は時間から', () => {
    expect(initialDifficulty(20)).toBe(1);
    expect(initialDifficulty(21)).toBe(2);
    expect(initialDifficulty(40)).toBe(2);
    expect(initialDifficulty(41)).toBe(3);
    expect(initialDifficulty(null)).toBe(3);
  });

  it('URL レシピとして保存し、作り方は持たない。水は材料に入らない', () => {
    const plan = planImportSave(kurashiruForm(), foods, [], sequentialIds('r'));
    if (!plan.ok) throw new Error(plan.errors.join());
    expect(plan.recipe).toMatchObject({
      id: 'url_r-1',
      name: 'テスト用 ほうれん草と卵の炒め物',
      source: 'URL',
      url: KURASHIRU_URL,
      steps: [],
      servings: 2,
      minutes: 15,
      difficulty: 1,
      favorite: false,
    });
    expect(plan.recipe.ingredients.map((i) => i.foodId)).toEqual(['spinach', 'egg', 'soy_sauce', 'sugar', 'sesame_oil']);
    expect(plan.recipe.ingredients.find((i) => i.foodId === 'spinach')?.main).toBe(true);
    expect(JSON.stringify(plan.recipe)).not.toContain(STEP_TEXT);
    expect(plan.updatedFoods).toEqual([]);
    expect(plan.replaced).toBeNull();
  });

  it('主な材料・人数・時間・量が決まっていなければ保存しない', () => {
    const form = kurashiruForm();
    form.rows = form.rows.map((r) => ({ ...r, main: false, amountText: r.foodId === 'egg' ? '' : r.amountText }));
    form.servings = '';
    const plan = planImportSave(form, foods, [], sequentialIds('r'));
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.errors).toContain('「卵」の量を0より大きい数字にしてください');
  });

  it('自信のない材料は確かめるまで保存せず、選んだ材料名は別名になって次から「読み取った」に入る', () => {
    const page = readOk(shortcutJson(COOKPAD_LIKE, 'https://cookpad.example/recipe/1'));
    const form = initialFormState(page, readIngredients(page.ingredientLines, foods));
    const first = planImportSave(form, foods, [], sequentialIds('r'));
    expect(first.ok).toBe(false);
    if (first.ok) return;
    expect(first.errors).toContain('「豚こま切れ肉」が豚こまでよいか確かめてください');
    expect(first.errors).toContain('「生姜」の量を0より大きい数字にしてください');

    // 確認画面で直す:時間を入れる(このサイトの形には時間がない)・豚こまでよい・生姜は1かけ・塩こしょうは塩・豚こまを主に
    form.minutes = '15';
    form.rows = form.rows.map((r) => {
      if (r.item.name === '豚こま切れ肉') return { ...r, confirmed: true, main: true };
      if (r.item.name === '生姜') return { ...r, amountText: '1' };
      if (r.item.name === '塩こしょう') return { ...r, confirmed: true };
      return r;
    });
    const plan = planImportSave(form, foods, [], sequentialIds('r'));
    if (!plan.ok) throw new Error(plan.errors.join());
    const pork = plan.updatedFoods.find((f) => f.id === 'pork_koma');
    expect(pork?.aliases).toContain('豚こま切れ肉');
    expect(plan.updatedFoods.find((f) => f.id === 'salt')?.aliases).toContain('塩こしょう');

    // 次に同じ材料を読むと「読み取った」
    const nextFoods = foods.map((f) => plan.updatedFoods.find((u) => u.id === f.id) ?? f);
    expect(readIngredientLine('豚こま切れ肉 200g', nextFoods)).toMatchObject({ status: '読み取った', foodId: 'pork_koma' });
  });

  it('水は最初から「材料に入れない」', () => {
    expect(readIngredientLine('水 200ml', foods)?.status).toBe('材料に入れない');
    expect(readIngredientLine('お湯 適量', foods)?.status).toBe('材料に入れない');
    // 「水菜」は水ではない
    expect(readIngredientLine('水菜 1袋', foods)).toMatchObject({ status: '読み取った', foodId: 'mizuna' });
  });

  it('同じ食材が2行あれば量を合計する', () => {
    const form = kurashiruForm();
    const soy = form.rows.find((r) => r.foodId === 'soy_sauce');
    if (!soy) throw new Error('しょうゆがない');
    form.rows.push({ ...soy, key: 99, amountText: '1' });
    const plan = planImportSave(form, foods, [], sequentialIds('r'));
    if (!plan.ok) throw new Error(plan.errors.join());
    expect(plan.recipe.ingredients.filter((i) => i.foodId === 'soy_sauce')).toEqual([
      { foodId: 'soy_sauce', amount: 1.667, main: false },
    ]);
  });

  it('同じ URL のレシピがあれば、ID とお気に入りを引き継いで上書きする', () => {
    const old: Recipe = {
      id: 'url_old',
      name: '前のもの',
      course: '副菜',
      ingredients: [{ foodId: 'egg', amount: 1, main: true }],
      servings: 2,
      minutes: 10,
      difficulty: 1,
      methods: [],
      flavors: [],
      steps: [],
      source: 'URL',
      url: `${KURASHIRU_URL}/?utm_source=x#top`,
      favorite: true,
    };
    expect(findRecipeByUrl([old], KURASHIRU_URL)?.id).toBe('url_old');
    const plan = planImportSave(kurashiruForm(), foods, [old], sequentialIds('r'));
    if (!plan.ok) throw new Error(plan.errors.join());
    expect(plan.replaced?.id).toBe('url_old');
    expect(plan.recipe).toMatchObject({ id: 'url_old', favorite: true, name: 'テスト用 ほうれん草と卵の炒め物' });
  });

  it('URL の形をそろえる', () => {
    expect(normalizeRecipeUrl('https://a.example/r/1/?utm_source=x&id=2#s')).toBe('https://a.example/r/1?id=2');
    expect(normalizeRecipeUrl('ftp://a.example/')).toBeNull();
    expect(normalizeRecipeUrl('レシピ')).toBeNull();
  });
});
