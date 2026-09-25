// レシピの「主な材料」(純粋関数)
import type { Food, Recipe } from '../../db/types';

/** 主な材料にできる食材か。薬味と調味料はできない */
export function canBeMain(food: Food | undefined): boolean {
  return food !== undefined && food.kind === '食材' && !food.isCondiment;
}

/** 主な材料の印が1つでもついているか */
export function hasMainFlags(recipe: Recipe): boolean {
  return recipe.ingredients.some((i) => i.main);
}

/**
 * 「同じ1食の中でかぶらない」の判定に使う食材ID。
 * 印がないレシピ(移行前のマイレシピなど)は、薬味・調味料以外をすべて主な材料とみなす(判定が厳しめになる安全側)
 */
export function mainFoodIds(recipe: Recipe, byId: ReadonlyMap<string, Food>): string[] {
  if (hasMainFlags(recipe)) return recipe.ingredients.filter((i) => i.main).map((i) => i.foodId);
  return recipe.ingredients.filter((i) => canBeMain(byId.get(i.foodId))).map((i) => i.foodId);
}
