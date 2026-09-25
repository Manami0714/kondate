import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../data/foods';
import {
  parseAmount,
  splitList,
  validateFoodDraft,
  validateMemberDraft,
  validateRecipeDraft,
  type FoodDraft,
  type MemberDraft,
  type RecipeDraft,
} from './forms';

describe('量の読み取り', () => {
  it.each([
    ['2', 2],
    ['0.5', 0.5],
    ['1/4', 0.25],
    ['1 1/2', 1.5],
    ['１／２', 0.5],
    ['.5', 0.5],
  ])('「%s」は %d', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each(['', 'abc', '1/0', '-1', '半分'])('「%s」は読めない', (text) => {
    expect(parseAmount(text)).toBeNull();
  });
});

describe('区切りの分割', () => {
  it('読点・カンマ・改行で分け、空と重複を除く', () => {
    expect(splitList('たまご、玉子,,タマゴ\nたまご')).toEqual(['たまご', '玉子', 'タマゴ']);
  });
});

describe('食材辞書への追加', () => {
  const base: FoodDraft = {
    name: 'ズッキーニ',
    aliasesText: 'ｽﾞｯｷｰﾆ',
    unit: '本',
    usualAmount: '2',
    kind: '食材',
    foodGroup: '緑',
    shelfLifeDays: '5',
  };

  it('正しく入れると食材になる', () => {
    const r = validateFoodDraft(base, INITIAL_FOODS, 'new1');
    expect(r).toEqual({
      ok: true,
      value: {
        id: 'new1',
        name: 'ズッキーニ',
        aliases: ['ｽﾞｯｷｰﾆ'],
        unit: '本',
        usualAmount: 2,
        kind: '食材',
        foodGroup: '緑',
        shelfLifeDays: 5,
      },
    });
  });

  it('すでにある名前・別名は追加できない', () => {
    const r = validateFoodDraft({ ...base, name: 'たまご' }, INITIAL_FOODS, 'new1');
    expect(r.ok).toBe(false);
  });

  it('食材は食品グループが必要、調味料はグループなしになる', () => {
    expect(validateFoodDraft({ ...base, foodGroup: null }, INITIAL_FOODS, 'x').ok).toBe(false);
    const r = validateFoodDraft({ ...base, name: '柚子胡椒', kind: '調味料', foodGroup: '緑' }, INITIAL_FOODS, 'x');
    expect(r.ok && r.value.foodGroup).toBeNull();
  });
});

describe('メンバー', () => {
  const base: MemberDraft = {
    name: 'テスト',
    kind: '家族',
    sex: '男性',
    age: '14',
    appetite: '多め',
    portionOverride: '',
    likedFoodIds: [],
    dislikedFoodIds: [],
    allergyFoodIds: [],
    likedMethods: [],
    dislikedMethods: [],
    likedFlavors: [],
    dislikedFlavors: [],
  };

  it('倍率が空欄なら null(自動)', () => {
    const r = validateMemberDraft(base, 'm1');
    expect(r.ok && r.value.portionOverride).toBeNull();
  });

  it('倍率を入れると数字で保存される', () => {
    const r = validateMemberDraft({ ...base, portionOverride: '1.2' }, 'm1');
    expect(r.ok && r.value.portionOverride).toBe(1.2);
  });

  it('年齢が整数でなければエラー', () => {
    expect(validateMemberDraft({ ...base, age: '14.5' }, 'm1').ok).toBe(false);
    expect(validateMemberDraft({ ...base, age: '' }, 'm1').ok).toBe(false);
  });

  it('同じものを好きと苦手の両方に入れるとエラー', () => {
    const r = validateMemberDraft({ ...base, likedFlavors: ['味噌'], dislikedFlavors: ['味噌'] }, 'm1');
    expect(r.ok).toBe(false);
  });
});

describe('マイレシピ', () => {
  const base: RecipeDraft = {
    name: '卵焼き',
    course: '副菜',
    ingredients: [
      { foodId: 'egg', amount: '3' },
      { foodId: 'sugar', amount: '1/2' },
    ],
    servings: '2',
    minutes: '10',
    difficulty: 1,
    methods: ['焼き物'],
    flavors: ['甘辛'],
    stepsText: '卵を溶く\n\n焼く\n',
    favorite: false,
  };

  it('正しく入れるとマイレシピになる(空の手順行は除く)', () => {
    const r = validateRecipeDraft(base, 'r1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source).toBe('マイレシピ');
      expect(r.value.ingredients).toEqual([
        { foodId: 'egg', amount: 3 },
        { foodId: 'sugar', amount: 0.5 },
      ]);
      expect(r.value.steps).toEqual(['卵を溶く', '焼く']);
    }
  });

  it('材料がない・量が読めない・同じ材料が2回はエラー', () => {
    expect(validateRecipeDraft({ ...base, ingredients: [] }, 'r1').ok).toBe(false);
    expect(validateRecipeDraft({ ...base, ingredients: [{ foodId: 'egg', amount: 'たくさん' }] }, 'r1').ok).toBe(false);
    expect(
      validateRecipeDraft({ ...base, ingredients: [{ foodId: 'egg', amount: '1' }, { foodId: 'egg', amount: '2' }] }, 'r1').ok,
    ).toBe(false);
  });
});
