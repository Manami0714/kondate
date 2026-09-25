// レシピの保存(お気に入り)
import type { KondateDB } from './db';

/** お気に入りをつける・外す */
export async function setFavoriteInDb(db: KondateDB, recipeId: string, favorite: boolean): Promise<void> {
  await db.recipes.update(recipeId, { favorite });
}
