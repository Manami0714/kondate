// レシピの保存(お気に入り・URL からの取り込み)
import type { KondateDB } from './db';
import type { Food, Recipe } from './types';

/** お気に入りをつける・外す */
export async function setFavoriteInDb(db: KondateDB, recipeId: string, favorite: boolean): Promise<void> {
  await db.recipes.update(recipeId, { favorite });
}

/**
 * URL から取り込んだレシピを保存する。確認画面で覚えた別名(食材)も一緒に保存する。
 * 同じ ID のレシピ(同じ URL で上書きするとき)は置き換える
 */
export async function saveImportedRecipeInDb(db: KondateDB, recipe: Recipe, updatedFoods: readonly Food[]): Promise<void> {
  await db.transaction('rw', db.recipes, db.foods, async () => {
    if (updatedFoods.length > 0) await db.foods.bulkPut([...updatedFoods]);
    await db.recipes.put(recipe);
  });
}
