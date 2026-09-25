// 食材がどこで使われているかを調べる(純粋関数)
// 使われている食材は辞書から削除できない
import type { MealSet, Member, PantryItem, Recipe, Stock } from '../db/types';

export interface FoodUsageSource {
  recipes: readonly Recipe[];
  stocks: readonly Stock[];
  pantry: readonly PantryItem[];
  members: readonly Member[];
  mealSets: readonly MealSet[];
}

/** 画面に出す名前の数の上限(多いときは「ほか○件」にまとめる) */
const MAX_NAMES = 3;

function namesWithRest(names: string[]): string {
  const shown = names.slice(0, MAX_NAMES).map((n) => `「${n}」`).join('');
  const rest = names.length - MAX_NAMES;
  return rest > 0 ? `${shown}ほか${rest}件` : shown;
}

/** 使われている場所の説明の一覧。空なら、どこでも使われていない */
export function findFoodUsage(foodId: string, src: FoodUsageSource): string[] {
  const usage: string[] = [];

  const recipes = src.recipes.filter((r) => r.ingredients.some((i) => i.foodId === foodId)).map((r) => r.name);
  if (recipes.length > 0) usage.push(`レシピ${namesWithRest(recipes)}`);

  if (src.stocks.some((s) => s.foodId === foodId)) usage.push('在庫');
  if (src.pantry.some((p) => p.foodId === foodId)) usage.push('常備調味料');

  const members = src.members
    .filter((m) => [m.likedFoodIds, m.dislikedFoodIds, m.allergyFoodIds].some((ids) => ids.includes(foodId)))
    .map((m) => m.name);
  if (members.length > 0) usage.push(`メンバー${namesWithRest(members)}の好み・アレルギー`);

  const inMealSet = src.mealSets.some(
    (s) => s.reserved.some((r) => r.foodId === foodId) || s.shopping.some((x) => x.foodId === foodId),
  );
  if (inMealSet) usage.push('献立セット');

  return usage;
}
