// データベースのテスト(fake-indexeddb でメモリ上の IndexedDB を使う)
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../data/foods';
import { INITIAL_RECIPES } from '../data/recipes';
import { parseBackup, serializeBackup } from '../logic/backup';
import { sequentialIds } from '../logic/id';
import { KondateDB } from './db';
import { addStockToDb, removeStockFromDb, setStockAmountInDb, tidyUpStocksInDb } from './stockRepo';

let n = 0;
const opened: KondateDB[] = [];
function freshDb(): KondateDB {
  const d = new KondateDB(`test-${++n}`);
  opened.push(d);
  return d;
}

afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

const day1 = new Date(2026, 8, 25, 10, 0, 0);
const day2 = new Date(2026, 8, 26, 10, 0, 0);

describe('初期データ', () => {
  it('初めて開いたときに食材辞書・初期レシピ・家庭の好みが入る', async () => {
    const db = freshDb();
    expect(await db.foods.count()).toBe(INITIAL_FOODS.length);
    expect(await db.recipes.count()).toBe(INITIAL_RECIPES.length);
    expect((await db.household.get('household'))?.methodFrequency['揚げ物']).toBe('ふつう');
    expect(await db.stocks.count()).toBe(0);
    expect(await db.pantry.count()).toBe(0);
  });
});

describe('在庫の保存', () => {
  it('追加・買い足し・手直し・削除がすべて在庫の動きとして残る', async () => {
    const db = freshDb();
    const ids = sequentialIds();
    await addStockToDb(db, 'egg', 6, day1, ids);
    await addStockToDb(db, 'egg', 10, day2, ids);
    expect(await db.stocks.get('egg')).toEqual({ foodId: 'egg', amount: 16, addedDate: '2026-09-25' });

    await setStockAmountInDb(db, 'egg', 12, day2, ids);
    await removeStockFromDb(db, 'egg', day2, ids);
    expect(await db.stocks.get('egg')).toBeUndefined();

    const moves = await db.stockMoves.orderBy('id').toArray();
    expect(moves.map((m) => [m.delta, m.reason])).toEqual([
      [6, '購入'],
      [10, '購入'],
      [-4, '手直し'],
      [-12, '手直し'],
    ]);
  });

  it('在庫の整理:選んだ食材をまとめて消し、「整理で削除」の動きは書き出し・読み込みでも残る', async () => {
    const db = freshDb();
    const ids = sequentialIds();
    await addStockToDb(db, 'egg', 6, day1, ids);
    await addStockToDb(db, 'onion', 3, day1, ids);
    await addStockToDb(db, 'milk', 1000, day1, ids);

    await tidyUpStocksInDb(db, ['egg', 'milk'], day2, ids);
    expect((await db.stocks.toArray()).map((s) => s.foodId)).toEqual(['onion']);
    const tidied = (await db.stockMoves.toArray()).filter((m) => m.reason === '整理で削除');
    expect(tidied.map((m) => [m.foodId, m.delta]).sort()).toEqual([
      ['egg', -6],
      ['milk', -1000],
    ]);

    const parsed = parseBackup(serializeBackup(await db.readAll(), day2));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.data.stockMoves.filter((m) => m.reason === '整理で削除')).toHaveLength(2);
  });
});

describe('書き出しと読み込み', () => {
  it('書き出したファイルを読み込むと、変更前の状態に完全に戻る', async () => {
    const db = freshDb();
    const ids = sequentialIds();
    await addStockToDb(db, 'cabbage', 1, day1, ids);
    await db.pantry.add({ foodId: 'soy_sauce' });
    const before = await db.readAll();
    const file = serializeBackup(before, day1);

    // データを変える
    await addStockToDb(db, 'egg', 10, day2, ids);
    await db.pantry.clear();
    await db.recipes.delete(INITIAL_RECIPES[0].id);

    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);
    await db.replaceAll(parsed.data);
    expect(await db.readAll()).toEqual(before);
  });

  it('別の端末(空のデータベース)にも同じデータを入れられる', async () => {
    const src = freshDb();
    await addStockToDb(src, 'egg', 3, day1, sequentialIds());
    const file = serializeBackup(await src.readAll(), day1);

    const dst = freshDb();
    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);
    await dst.replaceAll(parsed.data);
    expect(await dst.readAll()).toEqual(await src.readAll());
  });
});

describe('版1からの移行', () => {
  it('既存データを消さずに、薬味・アレルギー物質・主な材料・買い足し上限を補う', async () => {
    const name = `test-${++n}`;
    // 版1のデータベースを、版1の形のデータで作る
    const old = new Dexie(name);
    old.version(1).stores({
      foods: 'id, name, kind',
      stocks: 'foodId',
      pantry: 'foodId',
      members: 'id, kind',
      household: 'id',
      recipes: 'id, course, source',
      mealSets: 'id, startDate',
      stockMoves: 'id, at, foodId',
      feedbacks: 'id, at',
    });
    const strip = <T extends object>(o: T, keys: string[]) =>
      Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
    // 版1のころにはなかった食材(なめこ)とレシピ(なめこの味噌汁)は入れない
    await old.table('foods').bulkAdd(
      INITIAL_FOODS.filter((f) => f.id !== 'nameko').map((f) => strip(f, ['isCondiment', 'allergens', 'allergenUncertain', 'gramsPerUnit'])),
    );
    await old.table('foods').add({ id: 'user_1', name: 'みょうが', aliases: [], unit: '個', usualAmount: 3, kind: '食材', foodGroup: '緑', shelfLifeDays: 5 });
    const v1Recipe = (r: (typeof INITIAL_RECIPES)[number]) => ({
      ...r,
      ingredients: r.ingredients.map((i) => ({ foodId: i.foodId, amount: i.amount })),
    });
    await old.table('recipes').bulkAdd(INITIAL_RECIPES.filter((r) => r.id !== 'init_miso_nameko').map(v1Recipe));
    await old.table('recipes').add({ ...v1Recipe(INITIAL_RECIPES[0]), id: 'my_1', source: 'マイレシピ' });
    await old.table('members').add({ id: 'm1', name: 'テスト', kind: '家族', sex: '女性', age: 40, appetite: 'ふつう', portionOverride: null, likedFoodIds: [], dislikedFoodIds: [], allergyFoodIds: ['shrimp'], likedMethods: [], dislikedMethods: [], likedFlavors: [], dislikedFlavors: [] });
    await old.table('household').add({ id: 'household', methodFrequency: { 揚げ物: '好き' }, dislikedFlavors: [] });
    await old.table('stocks').add({ foodId: 'egg', amount: 6, addedDate: '2026-09-20' });
    old.close();

    // 新しい版で開く
    const db = new KondateDB(name);
    opened.push(db);
    expect(await db.foods.get('soy_sauce')).toMatchObject({ isCondiment: false, allergens: ['小麦', '大豆'] });
    expect(await db.foods.get('ginger')).toMatchObject({ isCondiment: true });
    expect(await db.foods.get('salad_oil')).toMatchObject({ allergenUncertain: true });
    expect(await db.foods.get('user_1')).toMatchObject({ isCondiment: false, allergens: [], allergenUncertain: false, gramsPerUnit: null });
    // 版5:米には1合=150gが入る
    expect((await db.foods.get('rice'))?.gramsPerUnit).toBe(150);
    const nikujaga = await db.recipes.get('init_nikujaga');
    expect(nikujaga?.ingredients.filter((i) => i.main).map((i) => i.foodId)).toEqual(['beef_koma', 'potato']);
    expect((await db.recipes.get('my_1'))?.ingredients.every((i) => i.main === false)).toBe(true);
    expect(await db.members.get('m1')).toMatchObject({ allergyFoodIds: ['shrimp'], allergyAllergens: [] });
    expect(await db.household.get('household')).toMatchObject({ shoppingLimitPerMeal: 2, methodFrequency: { 揚げ物: '好き' } });
    expect(await db.stocks.get('egg')).toEqual({ foodId: 'egg', amount: 6, addedDate: '2026-09-20' });
    // 追加した初期食材・初期レシピが届く
    expect(await db.foods.get('nameko')).toMatchObject({ name: 'なめこ' });
    expect((await db.recipes.get('init_miso_nameko'))?.ingredients.find((i) => i.foodId === 'nameko')?.main).toBe(true);
    expect(await db.recipes.count()).toBe(INITIAL_RECIPES.length + 1); // +1 はマイレシピ
  });
});

describe('版5からの移行', () => {
  it('ほかの数え方と重さの目安を足し、干ししいたけを足す。自分で入れた値・自分で足した食材はそのまま', async () => {
    const name = `test-${++n}`;
    const old = new Dexie(name);
    old.version(5).stores({
      foods: 'id, name, kind',
      stocks: 'foodId',
      pantry: 'foodId',
      members: 'id, kind',
      household: 'id',
      recipes: 'id, course, source',
      mealSets: 'id, startDate',
      stockMoves: 'id, at, foodId',
      feedbacks: 'id, at',
      planDrafts: 'id',
      ignoredWords: 'word',
    });
    // 版5のころの食材:ほかの数え方がなく、重さは米だけ。干ししいたけはない
    const v5Foods = INITIAL_FOODS.filter((f) => f.id !== 'dried_shiitake').map(({ altUnits: _altUnits, ...f }) => ({
      ...f,
      gramsPerUnit: f.id === 'rice' ? 150 : f.id === 'onion' ? 180 : null,
    }));
    await old.table('foods').bulkAdd(v5Foods);
    await old.table('foods').add({ id: 'user_1', name: 'みょうが', aliases: [], unit: '個', usualAmount: 3, kind: '食材', foodGroup: '緑', shelfLifeDays: 5, isCondiment: true, allergens: [], allergenUncertain: false, gramsPerUnit: null });
    // 自分で単位を変えた食材には、初期データの重さを入れない
    await old.table('foods').update('carrot', { unit: 'g' });
    old.close();

    const db = new KondateDB(name);
    opened.push(db);
    expect(await db.foods.get('cabbage')).toMatchObject({ gramsPerUnit: 1000, altUnits: [{ unit: '枚', amount: 0.1 }, { unit: '玉', amount: 1 }] });
    expect(await db.foods.get('onion')).toMatchObject({ gramsPerUnit: 180, altUnits: [{ unit: '玉', amount: 1 }] });
    expect(await db.foods.get('carrot')).toMatchObject({ unit: 'g', gramsPerUnit: null });
    expect(await db.foods.get('user_1')).toMatchObject({ gramsPerUnit: null, altUnits: [] });
    expect(await db.foods.get('dried_shiitake')).toMatchObject({ name: '干ししいたけ', gramsPerUnit: 3 });
    expect(await db.foods.count()).toBe(INITIAL_FOODS.length + 1);
  });
});

describe('献立の確定・キャンセルの保存', () => {
  it('確定で在庫が減り、買った→1食キャンセル→全体キャンセルで、確定前+買った分に戻る。動きはすべて記録される', async () => {
    const { confirmPlanToDb, cancelDayInDb, cancelSetInDb, markBoughtInDb } = await import('./mealSetRepo');
    const { plannerData, member, conditions, days } = await import('../logic/planner/testing');
    const db = freshDb();
    const ids = sequentialIds();
    await addStockToDb(db, 'pork_loin', 250, day1, ids);
    await addStockToDb(db, 'onion', 3, day1, ids);
    const before = await db.stocks.orderBy('foodId').toArray();

    const recipes = await db.recipes.toArray();
    const data = plannerData({ recipes, members: [member('a'), member('b')], pantryIds: [] });
    const planned = days(['a', 'b']).map((d) => ({ ...d, mainId: 'init_ginger_pork', sideId: 'init_spinach_goma', soupId: 'init_miso_tofu_wakame', overLimit: false }));
    // 在庫は保存の直前にデータベースから読み直すので、data の在庫(空)は使われない
    const set = await confirmPlanToDb(db, { id: 'set1', startDate: planned[0].date, days: planned, conditions: conditions('ふつう'), guests: [], data, now: day1, newId: ids });

    // 250g を1日目200g・2日目50gで使い切り、2日目の残り150gと3日目の200gが買い足しになる
    expect(await db.stocks.get('pork_loin')).toBeUndefined();
    expect(set.shopping.filter((s) => s.foodId === 'pork_loin').map((s) => s.amount)).toEqual([150, 200]);

    const bought = await markBoughtInDb(db, 'set1', 'pork_loin', 500, day2, ids);
    expect(bought.ok).toBe(true);
    expect((await cancelDayInDb(db, 'set1', 1, day2, ids)).ok).toBe(true);
    expect((await cancelSetInDb(db, 'set1', day2, ids)).ok).toBe(true);

    const after = await db.stocks.orderBy('foodId').toArray();
    expect(after).toEqual(before.map((s) => (s.foodId === 'pork_loin' ? { ...s, amount: 750 } : s)));
    expect((await db.mealSets.get('set1'))?.status).toBe('キャンセル');
    const reasons = new Set((await db.stockMoves.toArray()).map((m) => m.reason));
    expect(reasons).toEqual(new Set(['購入', '夕飯', 'キャンセルで戻す']));
  });
});

describe('確定前の提案(下書き)', () => {
  it('保存して読み直せる。確定すると消える。書き出しには含めない', async () => {
    const { saveDraft, loadDraft, deleteDraft } = await import('./draftRepo');
    const { confirmPlanToDb } = await import('./mealSetRepo');
    const { plannerData, member, conditions, days } = await import('../logic/planner/testing');
    const db = freshDb();
    const planned = days(['a']).map((d) => ({ ...d, mainId: 'init_nikujaga', sideId: 'init_kinpira', soupId: 'init_tonjiru', overLimit: false }));
    const draft = {
      savedAt: day1.toISOString(),
      startDate: planned[0].date,
      conditions: conditions('ふつう'),
      addedGuests: [],
      guests: [],
      days: planned,
      shown: { '0-mainId': ['init_ginger_pork'] },
    };

    await saveDraft(db, draft);
    expect(await loadDraft(db)).toEqual({ ...draft, id: 'draft' });
    expect(Object.keys(await db.readAll())).not.toContain('planDrafts');

    // 「条件からやり直す」で消す
    await deleteDraft(db);
    expect(await loadDraft(db)).toBeNull();

    // 確定で消す
    await saveDraft(db, draft);
    const data = plannerData({ recipes: await db.recipes.toArray(), members: [member('a')] });
    await confirmPlanToDb(db, { id: 's1', startDate: draft.startDate, days: planned, conditions: draft.conditions, guests: [], data, now: day1, newId: sequentialIds() });
    expect(await loadDraft(db)).toBeNull();
    expect(await db.mealSets.count()).toBe(1);
  });

  it('3日分用と作り直し用を1件ずつ持てる。作り直しの確定では作り直し用だけが消え、3日分の確定では3日分用だけが消える', async () => {
    const { saveDraft, loadDraft, saveRebuildDraft, loadRebuildDraft, deleteRebuildDraft } = await import('./draftRepo');
    const { confirmPlanToDb, cancelDayInDb, refillDayInDb } = await import('./mealSetRepo');
    const { plannerData, member, conditions, days } = await import('../logic/planner/testing');
    const db = freshDb();
    const planned = days(['a'], '2026-10-01').map((d) => ({ ...d, mainId: 'init_nikujaga', sideId: 'init_kinpira', soupId: 'init_tonjiru', overLimit: false }));
    const data = plannerData({ recipes: await db.recipes.toArray(), members: [member('a')] });
    await confirmPlanToDb(db, { id: 's1', startDate: planned[0].date, days: planned, conditions: conditions(), guests: [], data, now: day1, newId: sequentialIds('c') });
    await cancelDayInDb(db, 's1', 0, day1, sequentialIds('x'));

    const planDraft = {
      savedAt: day1.toISOString(),
      startDate: '2026-10-04',
      conditions: conditions(),
      addedGuests: [],
      guests: [],
      days: days(['a'], '2026-10-04').map((d) => ({ ...d, mainId: 'init_nikujaga', sideId: 'init_kinpira', soupId: 'init_tonjiru', overLimit: false })),
      shown: {},
    };
    const rebuildDraft = {
      savedAt: day1.toISOString(),
      mealSetId: 's1',
      dayIndex: 0,
      conditions: conditions('らくらく'),
      fixed: [{ dayIndex: 0, course: '主菜' as const, recipeId: 'init_ginger_pork' }],
      day: null,
      shown: {},
    };
    await saveDraft(db, planDraft);
    await saveRebuildDraft(db, rebuildDraft);
    // タブの切り替えやアプリを閉じたあとに読み直しても、両方残っている
    expect(await loadDraft(db)).toEqual({ ...planDraft, id: 'draft' });
    expect(await loadRebuildDraft(db)).toEqual({ ...rebuildDraft, id: 'rebuild' });
    expect(Object.keys(await db.readAll())).not.toContain('planDrafts');

    // 「やめる」で作り直し用だけ消える
    await deleteRebuildDraft(db);
    expect(await loadRebuildDraft(db)).toBeNull();
    expect(await loadDraft(db)).not.toBeNull();

    // 作り直しの確定で作り直し用だけ消える
    await saveRebuildDraft(db, { ...rebuildDraft, day: { ...planned[0], mainId: 'init_ginger_pork' } });
    const result = await refillDayInDb(db, {
      mealSetId: 's1',
      dayIndex: 0,
      day: { ...planned[0], mainId: 'init_ginger_pork' },
      data,
      now: day1,
      newId: sequentialIds('r'),
    });
    expect(result.ok).toBe(true);
    const refilled = await db.mealSets.get('s1');
    expect(refilled?.days[0]).toMatchObject({ mainId: 'init_ginger_pork', status: '予定' });
    // 在庫がないので、作り直した日の材料は買い足しに入る
    expect(refilled?.shopping.some((s) => s.dayIndex === 0)).toBe(true);
    expect(await loadRebuildDraft(db)).toBeNull();
    expect(await loadDraft(db)).not.toBeNull();

    // 3日分の確定では、作り直し用は消えない
    await saveRebuildDraft(db, rebuildDraft);
    await confirmPlanToDb(db, { id: 's2', startDate: '2026-10-04', days: planDraft.days, conditions: conditions(), guests: [], data, now: day1, newId: sequentialIds('d') });
    expect(await loadDraft(db)).toBeNull();
    expect(await loadRebuildDraft(db)).not.toBeNull();
  });
});

describe('フェーズ3:昼食・評価・お気に入り・読まない言葉の保存', () => {
  it('昼食で減らすと「昼食」の動きが残り、動きを逆に足すと元の在庫に戻る。直した別名も保存される', async () => {
    const { useForLunchInDb } = await import('./stockRepo');
    const { withAlias } = await import('../logic/aliases');
    const db = freshDb();
    const ids = sequentialIds();
    await addStockToDb(db, 'egg', 10, day1, ids);
    await addStockToDb(db, 'cabbage', 1, day1, ids);
    const before = await db.stocks.orderBy('foodId').toArray();

    const egg = (await db.foods.get('egg'))!;
    const updated = withAlias(egg, 'エッグ', await db.foods.toArray())!;
    // キャベツは在庫より多く言っても0で止まる(マイナスにしない)
    await useForLunchInDb(db, [{ foodId: 'egg', amount: 2 }, { foodId: 'cabbage', amount: 3 }], [updated], day2, ids);
    expect(await db.stocks.get('egg')).toMatchObject({ amount: 8 });
    expect(await db.stocks.get('cabbage')).toBeUndefined();
    expect((await db.foods.get('egg'))?.aliases).toContain('エッグ');

    const lunchMoves = (await db.stockMoves.toArray()).filter((m) => m.reason === '昼食');
    expect(lunchMoves.map((m) => [m.foodId, m.delta])).toEqual([
      ['egg', -2],
      ['cabbage', -1],
    ]);
    for (const m of lunchMoves) await addStockToDb(db, m.foodId, -m.delta, day1, ids);
    expect(await db.stocks.orderBy('foodId').toArray()).toEqual(before);
  });

  it('評価をまとめて保存・削除でき、お気に入りを切り替えられる', async () => {
    const { saveFeedbacksInDb, deleteFeedbackInDb } = await import('./feedbackRepo');
    const { setFavoriteInDb } = await import('./recipeRepo');
    const db = freshDb();
    await saveFeedbacksInDb(
      db,
      [
        { targetType: '食材', targetValue: 'spinach', kind: '好き' },
        { targetType: '料理法×味付け', targetValue: '和え物×胡麻', kind: '提案時の嫌い' },
      ],
      ' ほうれん草は好き、胡麻和えは微妙 ',
      day1,
      sequentialIds('f'),
    );
    const saved = await db.feedbacks.orderBy('id').toArray();
    expect(saved.map((f) => [f.id, f.targetValue, f.kind, f.originalText])).toEqual([
      ['f-1', 'spinach', '好き', 'ほうれん草は好き、胡麻和えは微妙'],
      ['f-2', '和え物×胡麻', '提案時の嫌い', 'ほうれん草は好き、胡麻和えは微妙'],
    ]);
    await deleteFeedbackInDb(db, 'f-1');
    expect(await db.feedbacks.count()).toBe(1);

    await setFavoriteInDb(db, 'init_nikujaga', true);
    expect((await db.recipes.get('init_nikujaga'))?.favorite).toBe(true);
    await setFavoriteInDb(db, 'init_nikujaga', false);
    expect((await db.recipes.get('init_nikujaga'))?.favorite).toBe(false);
  });

  it('評価と読まない言葉も書き出し・読み込みで元に戻る', async () => {
    const db = freshDb();
    await db.feedbacks.add({ id: 'f1', at: day1.toISOString(), targetType: '料理法×味付け', targetValue: '和え物×胡麻', kind: '食後の嫌い', originalText: '胡麻和え' });
    await db.ignoredWords.add({ word: 'トイレットペーパー', label: 'トイレットペーパー', addedAt: day1.toISOString() });
    const before = await db.readAll();
    const parsed = parseBackup(serializeBackup(before, day1));
    if (!parsed.ok) throw new Error(parsed.error);
    await db.feedbacks.clear();
    await db.ignoredWords.clear();
    await db.replaceAll(parsed.data);
    expect(await db.readAll()).toEqual(before);
  });
});

describe('フェーズ3:貼り付けの保存', () => {
  it('買った食材を「購入」として足し、直した別名と読まない言葉を保存・外せる', async () => {
    const { addPurchasesInDb } = await import('./stockRepo');
    const { withAlias } = await import('../logic/aliases');
    const { makeIgnoredWord } = await import('../logic/receipt/ignoredWord');
    const db = freshDb();
    const ids = sequentialIds();
    await addStockToDb(db, 'egg', 2, day1, ids);
    await db.ignoredWords.add({ word: 'ムカシ', label: 'むかし', addedAt: day1.toISOString() });

    const loin = (await db.foods.get('pork_loin'))!;
    const updated = withAlias(loin, '産地直送豚肩ロース切りおとし', await db.foods.toArray())!;
    const ignored = makeIgnoredWord('ふんわりトイレットロール', day2)!;
    await addPurchasesInDb(
      db,
      [{ foodId: 'egg', amount: 10 }, { foodId: 'pork_loin', amount: 250 }],
      [updated],
      { add: [ignored], remove: ['ムカシ'] },
      day2,
      ids,
    );

    expect(await db.stocks.get('egg')).toMatchObject({ amount: 12, addedDate: '2026-09-25' });
    expect(await db.stocks.get('pork_loin')).toMatchObject({ amount: 250, addedDate: '2026-09-26' });
    expect((await db.foods.get('pork_loin'))?.aliases).toContain('産地直送豚肩ロース切りおとし');
    expect((await db.ignoredWords.toArray()).map((w) => w.label)).toEqual(['ふんわりトイレットロール']);
    const bought = (await db.stockMoves.toArray()).filter((m) => m.at === day2.toISOString());
    expect(bought.map((m) => [m.foodId, m.delta, m.reason])).toEqual([
      ['egg', 10, '購入'],
      ['pork_loin', 250, '購入'],
    ]);
  });
});
