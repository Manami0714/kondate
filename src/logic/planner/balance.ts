// 栄養バランス(食品グループ)の判定(純粋関数)
// ご飯は毎食別に出る前提なので、黄は常にそろう扱い。判定は主菜・副菜・汁物の材料で赤と緑がそろうか
import type { Food, FoodGroup, Recipe } from '../../db/types';

/** 黄をそろえるもの(画面に「黄:ご飯」と出す) */
export const ALWAYS_YELLOW_SOURCE = 'ご飯';

export interface MealBalance {
  /** 材料に入っている食品グループ */
  groups: Set<FoodGroup>;
  /** 赤・緑がそろう(黄はご飯でそろう)か */
  balanced: boolean;
}

export function mealBalance(recipes: readonly Recipe[], foodsById: ReadonlyMap<string, Food>): MealBalance {
  const groups = new Set<FoodGroup>();
  for (const r of recipes) {
    for (const i of r.ingredients) {
      const g = foodsById.get(i.foodId)?.foodGroup;
      if (g) groups.add(g);
    }
  }
  return { groups, balanced: groups.has('赤') && groups.has('緑') };
}

/** 1食で赤・緑・黄がそろうか(黄はご飯で常にそろう) */
export function isBalanced(recipes: readonly Recipe[], foodsById: ReadonlyMap<string, Food>): boolean {
  return mealBalance(recipes, foodsById).balanced;
}
