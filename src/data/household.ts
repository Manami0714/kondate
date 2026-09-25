// 家庭全体の好みの初期値(すべて「ふつう」、苦手な味付けなし、買い足し上限は設定ファイルの値)
import { DEFAULT_SHOPPING_LIMIT_PER_MEAL } from '../config/scoring';
import { COOKING_METHODS, type CookingMethod } from './tags';
import type { Frequency, HouseholdPrefs } from '../db/types';

export function defaultHouseholdPrefs(): HouseholdPrefs {
  const methodFrequency = Object.fromEntries(
    COOKING_METHODS.map((m) => [m, 'ふつう' as Frequency]),
  ) as Record<CookingMethod, Frequency>;
  return { id: 'household', methodFrequency, dislikedFlavors: [], shoppingLimitPerMeal: DEFAULT_SHOPPING_LIMIT_PER_MEAL };
}
