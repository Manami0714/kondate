import { describe, expect, it } from 'vitest';
import { TIME_PRESETS } from '../config/scoring';
import type { MealSet, Member } from '../db/types';
import { findFoodUsage, type FoodUsageSource } from './foodUsage';
import { recipe } from './planner/testing';

// 初期レシピが増えても結果が変わらないよう、テスト用のレシピだけを使う
const recipes = ['a', 'b', 'c', 'd', 'e'].map((id) => recipe(id, '副菜', [['carrot', 1, true]], { name: `にんじん料理${id}` }));

const member: Member = {
  id: 'm1',
  name: 'テスト',
  kind: '家族',
  sex: '女性',
  age: 40,
  appetite: 'ふつう',
  portionOverride: null,
  likedFoodIds: ['cherry_tomato'],
  dislikedFoodIds: [],
  allergyFoodIds: [],
  allergyAllergens: [],
  likedMethods: [],
  dislikedMethods: [],
  likedFlavors: [],
  dislikedFlavors: [],
};

const mealSet: MealSet = {
  id: 's1',
  startDate: '2026-09-25',
  days: [],
  status: '予定',
  reserved: [],
  conditions: { preset: 'ふつう', ...TIME_PRESETS['ふつう'], forMemberId: null },
  guests: [],
  shopping: [{ dayIndex: 0, foodId: 'bell_pepper', amount: 1, bought: false }],
  overLimitDays: [],
};

const src: FoodUsageSource = {
  recipes,
  stocks: [{ foodId: 'nira', amount: 1, addedDate: '2026-09-20' }],
  pantry: [{ foodId: 'ketchup' }],
  members: [member],
  mealSets: [mealSet],
};

describe('食材がどこで使われているか', () => {
  it('どこでも使われていなければ空', () => {
    expect(findFoodUsage('maitake', src)).toEqual([]);
  });

  it('レシピで使われている(多いときはまとめる)', () => {
    const usage = findFoodUsage('carrot', src);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toBe('レシピ「にんじん料理a」「にんじん料理b」「にんじん料理c」ほか2件');
  });

  it('在庫・常備調味料・メンバー・献立セット', () => {
    expect(findFoodUsage('nira', src)).toEqual(['在庫']);
    expect(findFoodUsage('ketchup', src)).toEqual(expect.arrayContaining(['常備調味料']));
    expect(findFoodUsage('cherry_tomato', src)).toEqual(['メンバー「テスト」の好み・アレルギー']);
    expect(findFoodUsage('bell_pepper', src)).toEqual(['献立セット']);
  });
});
