// 家庭全体の好みの初期値(すべて「ふつう」、苦手な味付けなし)
import { COOKING_METHODS, type CookingMethod } from './tags';
import type { Frequency, HouseholdPrefs } from '../db/types';

export function defaultHouseholdPrefs(): HouseholdPrefs {
  const methodFrequency = Object.fromEntries(
    COOKING_METHODS.map((m) => [m, 'ふつう' as Frequency]),
  ) as Record<CookingMethod, Frequency>;
  return { id: 'household', methodFrequency, dislikedFlavors: [] };
}
