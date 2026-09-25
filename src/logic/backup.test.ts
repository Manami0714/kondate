import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../data/foods';
import { defaultHouseholdPrefs } from '../data/household';
import { INITIAL_RECIPES } from '../data/recipes';
import type { AllData } from '../db/types';
import { backupFileName, countData, parseBackup, serializeBackup } from './backup';

const now = new Date(2026, 8, 25, 21, 5, 0);

/** すべての種類のデータを1件以上含むテスト用データ */
function sampleData(): AllData {
  return {
    foods: INITIAL_FOODS,
    stocks: [{ foodId: 'egg', amount: 6, addedDate: '2026-09-20' }],
    pantry: [{ foodId: 'soy_sauce' }, { foodId: 'salt' }],
    members: [
      {
        id: 'm1',
        name: 'テスト1',
        kind: '家族',
        sex: '女性',
        age: 45,
        appetite: 'ふつう',
        portionOverride: null,
        likedFoodIds: ['spinach'],
        dislikedFoodIds: [],
        allergyFoodIds: ['shrimp'],
        allergyAllergens: ['小麦'],
        likedMethods: ['煮物'],
        dislikedMethods: ['揚げ物'],
        likedFlavors: ['味噌'],
        dislikedFlavors: [],
      },
      {
        id: 'm2',
        name: 'テスト2',
        kind: 'ゲスト',
        sex: '男性',
        age: 72,
        appetite: '少なめ',
        portionOverride: 0.7,
        likedFoodIds: [],
        dislikedFoodIds: ['green_pepper'],
        allergyFoodIds: [],
        allergyAllergens: [],
        likedMethods: [],
        dislikedMethods: [],
        likedFlavors: [],
        dislikedFlavors: ['ピリ辛'],
      },
    ],
    household: [defaultHouseholdPrefs()],
    recipes: INITIAL_RECIPES,
    mealSets: [
      {
        id: 's1',
        startDate: '2026-09-25',
        days: [
          { date: '2026-09-25', mainId: 'init_nikujaga', sideId: 'init_kinpira', soupId: 'init_tonjiru', memberIds: ['m1'], status: '予定' },
        ],
        status: '予定',
        reserved: [{ dayIndex: 0, foodId: 'potato', amount: 3, addedDate: '2026-09-20' }],
        conditions: { preset: 'しっかり', maxMinutes: null, maxDifficulty: 3, forMemberId: 'm1' },
        guests: [{ memberId: 'm2', fromDate: '2026-09-25', toDate: '2026-09-26' }],
        shopping: [{ dayIndex: 0, foodId: 'onion', amount: 1, bought: false }],
        overLimitDays: [0],
      },
    ],
    stockMoves: [
      { id: 'mv1', at: now.toISOString(), foodId: 'egg', delta: 6, reason: '購入', mealSetId: null },
    ],
    feedbacks: [
      { id: 'f1', at: now.toISOString(), targetType: '味付け', targetValue: '胡麻', kind: '提案時の嫌い', originalText: '胡麻味が微妙' },
      { id: 'f2', at: now.toISOString(), targetType: '料理法×味付け', targetValue: '和え物×胡麻', kind: '食後の嫌い', originalText: '胡麻和えが微妙' },
    ],
    ignoredWords: [{ word: 'トイレットペーパー', label: 'トイレットペーパー', addedAt: now.toISOString() }],
  };
}

describe('書き出しと読み込み', () => {
  it('書き出したものを読み込むと、完全に同じデータに戻る', () => {
    const data = sampleData();
    const result = parseBackup(serializeBackup(data, now));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(data);
      expect(result.exportedAt).toBe(now.toISOString());
    }
  });

  it('件数を数えられる', () => {
    const counts = countData(sampleData());
    expect(counts.members).toBe(2);
    expect(counts.recipes).toBe(INITIAL_RECIPES.length);
  });

  it('ファイル名に日時が入る', () => {
    expect(backupFileName(now)).toBe('kondate-backup-20260925-2105.json');
  });
});

describe('版1のファイルの読み込み', () => {
  /** 版2のデータから、版2で足した項目を消して版1のファイルにする */
  function toV1File(data: AllData): string {
    const raw = JSON.parse(serializeBackup(data, now));
    raw.formatVersion = 1;
    const d = raw.data;
    d.feedbacks = [];
    delete d.ignoredWords;
    for (const f of d.foods) {
      delete f.isCondiment;
      delete f.allergens;
      delete f.allergenUncertain;
      delete f.gramsPerUnit;
    }
    for (const m of d.members) delete m.allergyAllergens;
    for (const r of d.recipes) for (const i of r.ingredients) delete i.main;
    for (const h of d.household) delete h.shoppingLimitPerMeal;
    for (const ms of d.mealSets) {
      delete ms.conditions;
      delete ms.guests;
      delete ms.shopping;
      delete ms.overLimitDays;
      for (const r of ms.reserved) delete r.addedDate;
    }
    return JSON.stringify(raw);
  }

  it('足りない項目を補って読み込める(初期食材・初期レシピは初期データの値になる)', () => {
    const data = sampleData();
    const r = parseBackup(toV1File(data));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.foods).toEqual(INITIAL_FOODS);
    expect(r.data.recipes).toEqual(INITIAL_RECIPES);
    expect(r.data.members.map((m) => m.allergyAllergens)).toEqual([[], []]);
    expect(r.data.household[0].shoppingLimitPerMeal).toBe(2);
    expect(r.data.mealSets[0]).toMatchObject({
      guests: [],
      shopping: [],
      overLimitDays: [],
      conditions: { preset: 'ふつう', maxMinutes: 40, maxDifficulty: 2, forMemberId: null },
      reserved: [{ dayIndex: 0, foodId: 'potato', amount: 3, addedDate: null }],
    });
  });

  it('辞書に自分で足した食材とマイレシピは、印なし・アレルギー物質なしになる', () => {
    const data = sampleData();
    data.foods = [
      ...INITIAL_FOODS,
      { id: 'user_1', name: 'みょうが', aliases: [], unit: '個', usualAmount: 3, kind: '食材', foodGroup: '緑', shelfLifeDays: 5, isCondiment: true, allergens: ['大豆'], allergenUncertain: true, gramsPerUnit: 40 },
    ];
    data.recipes = [
      ...INITIAL_RECIPES,
      { ...INITIAL_RECIPES[0], id: 'my_1', source: 'マイレシピ' },
    ];
    const r = parseBackup(toV1File(data));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.foods.find((f) => f.id === 'user_1')).toMatchObject({ isCondiment: false, allergens: [], allergenUncertain: false, gramsPerUnit: null });
    expect(r.data.recipes.find((x) => x.id === 'my_1')?.ingredients.every((i) => !i.main)).toBe(true);
  });
});

describe('版2のファイルの読み込み', () => {
  it('読まない言葉がなくても、空として読み込める', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    raw.formatVersion = 2;
    delete raw.data.ignoredWords;
    const r = parseBackup(JSON.stringify(raw));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.ignoredWords).toEqual([]);
    expect(r.data.feedbacks).toEqual(sampleData().feedbacks);
  });
});

describe('版3のファイルの読み込み', () => {
  it('食材の1単位あたりの重さがなくても、初期食材は初期データの値(米=150g)、ほかは空で読み込める', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    raw.formatVersion = 3;
    for (const f of raw.data.foods) delete f.gramsPerUnit;
    const r = parseBackup(JSON.stringify(raw));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.foods.find((f) => f.id === 'rice')?.gramsPerUnit).toBe(150);
    expect(r.data.foods.find((f) => f.id === 'egg')?.gramsPerUnit).toBeNull();
  });
});

describe('壊れたファイルを拒否する', () => {
  it('JSON でないファイル', () => {
    const r = parseBackup('これはJSONではない');
    expect(r).toEqual({ ok: false, error: 'JSON として読めないファイルです' });
  });

  it('ほかのアプリのファイル', () => {
    const r = parseBackup(JSON.stringify({ app: 'other', formatVersion: 2, exportedAt: '', data: {} }));
    expect(r.ok).toBe(false);
  });

  it('新しい版の形式', () => {
    const text = serializeBackup(sampleData(), now).replace('"formatVersion": 4', '"formatVersion": 999');
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
  });

  it('データの項目が欠けている', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    delete raw.data.members[0].age;
    const r = parseBackup(JSON.stringify(raw));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('メンバー[0].age');
  });

  it('決まった値以外が入っている', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    raw.data.recipes[0].methods = ['空揚げ'];
    const r = parseBackup(JSON.stringify(raw));
    expect(r.ok).toBe(false);
  });

  it('組み合わせの評価の値が正しくない', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    raw.data.feedbacks[1].targetValue = '和え物×のり';
    const r = parseBackup(JSON.stringify(raw));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('評価[1].targetValue');
  });

  it('表が欠けている', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    delete raw.data.stocks;
    expect(parseBackup(JSON.stringify(raw)).ok).toBe(false);
  });
});
