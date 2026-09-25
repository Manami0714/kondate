// アレルギーの注意書き(純粋関数)
import type { Food, Member, Recipe } from '../../db/types';

export const DAY_ALLERGY_NOTE = '商品によって原材料が違うので、表示を確認してください';
export const UNCERTAIN_FOOD_NOTE = 'この材料は商品によってアレルギー物質が入ることがあります';

/** その日のメンバーにアレルギー(食材またはアレルギー物質)のある人がいるか */
export function dayHasAllergy(members: readonly Member[]): boolean {
  return members.some((m) => m.allergyFoodIds.length > 0 || m.allergyAllergens.length > 0);
}

/**
 * 料理の注意に出す「要確認」の食材名。アレルギーのある人がいない日は空
 * 要確認の食材を使う料理は外さず、注意を出すだけにする
 */
export function uncertainFoodNames(
  recipe: Recipe,
  dayMembers: readonly Member[],
  foodsById: ReadonlyMap<string, Food>,
): string[] {
  if (!dayHasAllergy(dayMembers)) return [];
  return recipe.ingredients
    .map((i) => foodsById.get(i.foodId))
    .filter((f): f is Food => f !== undefined && f.allergenUncertain)
    .map((f) => f.name);
}
