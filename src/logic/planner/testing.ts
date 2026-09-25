// テスト用のデータを作る道具(テストからだけ使う)
import { TIME_PRESETS } from '../../config/scoring';
import { INITIAL_FOODS } from '../../data/foods';
import { defaultHouseholdPrefs } from '../../data/household';
import type { Course, Feedback, Member, PlanConditions, Recipe, Stock, TimePreset } from '../../db/types';
import type { PlannerData } from './types';

export const foodsById = new Map(INITIAL_FOODS.map((f) => [f.id, f]));

/** [食材ID, 量, 主な材料か] */
type Ing = [string, number, boolean?];

export function recipe(id: string, course: Course, ings: Ing[], extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name: id,
    course,
    ingredients: ings.map(([foodId, amount, main = false]) => ({ foodId, amount, main })),
    servings: 2,
    minutes: 15,
    difficulty: 1,
    methods: [],
    flavors: [],
    steps: ['作る'],
    source: '初期',
    url: null,
    favorite: false,
    ...extra,
  };
}

export function member(id: string, extra: Partial<Member> = {}): Member {
  return {
    id,
    name: id,
    kind: '家族',
    sex: '女性',
    age: 40,
    appetite: 'ふつう',
    portionOverride: null,
    likedFoodIds: [],
    dislikedFoodIds: [],
    allergyFoodIds: [],
    allergyAllergens: [],
    likedMethods: [],
    dislikedMethods: [],
    likedFlavors: [],
    dislikedFlavors: [],
    ...extra,
  };
}

export function conditions(preset: TimePreset = 'しっかり', extra: Partial<PlanConditions> = {}): PlanConditions {
  return { preset, ...TIME_PRESETS[preset], forMemberId: null, ...extra };
}

export function feedback(targetType: Feedback['targetType'], targetValue: string, kind: Feedback['kind']): Feedback {
  return { id: `${targetType}-${targetValue}`, at: '2026-09-01T00:00:00.000Z', targetType, targetValue, kind, originalText: '' };
}

export function plannerData(opts: {
  recipes: Recipe[];
  members: Member[];
  stocks?: Stock[];
  pantryIds?: string[];
  feedbacks?: Feedback[];
  shoppingLimit?: number;
}): PlannerData {
  return {
    recipes: opts.recipes,
    foodsById,
    stocks: opts.stocks ?? [],
    pantryIds: new Set(opts.pantryIds ?? []),
    membersById: new Map(opts.members.map((m) => [m.id, m])),
    household: { ...defaultHouseholdPrefs(), shoppingLimitPerMeal: opts.shoppingLimit ?? 99 },
    feedbacks: opts.feedbacks ?? [],
    history: [],
  };
}

/** 3日とも同じメンバー */
export function days(memberIds: string[], start = '2026-09-25') {
  const [y, m, d] = start.split('-').map(Number);
  return [0, 1, 2].map((i) => ({
    date: new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10),
    memberIds,
  }));
}

/** 副菜・汁物の、どれとも主な材料がかぶらない無難な候補 */
export function fillerSidesAndSoups(): Recipe[] {
  return [
    recipe('side_a', '副菜', [['spinach', 1, true]]),
    recipe('side_b', '副菜', [['komatsuna', 1, true]]),
    recipe('side_c', '副菜', [['okra', 4, true]]),
    recipe('soup_a', '汁物', [['wakame', 2, true]]),
    recipe('soup_b', '汁物', [['enoki', 1, true]]),
    recipe('soup_c', '汁物', [['shimeji', 1, true]]),
  ];
}
