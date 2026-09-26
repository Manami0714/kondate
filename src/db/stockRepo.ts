// 在庫の変更をデータベースに保存する
// 計算は logic/stock.ts の純粋関数に任せ、ここでは在庫と在庫の動きを同時に書き込むだけ
import type { KondateDB } from './db';
import type { Food, IgnoredWord, Stock } from './types';
import { addStock, changeStock, setStockAmount, tidyUpStocks, type StockChange } from '../logic/stock';
import { randomId, type IdGenerator } from '../logic/id';

async function saveChange(db: KondateDB, foodId: string, change: StockChange): Promise<void> {
  if (change.stock) await db.stocks.put(change.stock);
  else await db.stocks.delete(foodId);
  if (change.move) await db.stockMoves.add(change.move);
}

async function update(
  db: KondateDB,
  foodId: string,
  compute: (current: Stock | null) => StockChange,
): Promise<void> {
  await db.transaction('rw', db.stocks, db.stockMoves, async () => {
    const current = (await db.stocks.get(foodId)) ?? null;
    await saveChange(db, foodId, compute(current));
  });
}

export function addStockToDb(db: KondateDB, foodId: string, amount: number, now: Date, newId: IdGenerator = randomId) {
  return update(db, foodId, (current) => addStock(current, foodId, amount, now, newId));
}

export function setStockAmountInDb(db: KondateDB, foodId: string, amount: number, now: Date, newId: IdGenerator = randomId) {
  return update(db, foodId, (current) => setStockAmount(current, foodId, amount, now, newId));
}

export function removeStockFromDb(db: KondateDB, foodId: string, now: Date, newId: IdGenerator = randomId) {
  return setStockAmountInDb(db, foodId, 0, now, newId);
}

/**
 * レシート・ネットスーパーで買った食材を在庫に足し(理由:購入)、
 * 確認画面で直した別名と、「食材ではない」を選んだ読まない言葉を保存する。
 * 1つのトランザクションで行うので、途中で失敗したら何も変わらない
 */
export async function addPurchasesInDb(
  db: KondateDB,
  items: readonly { foodId: string; amount: number }[],
  updatedFoods: readonly Food[],
  ignoredWords: { add: readonly IgnoredWord[]; remove: readonly string[] },
  now: Date,
  newId: IdGenerator = randomId,
): Promise<void> {
  await db.transaction('rw', [db.stocks, db.stockMoves, db.foods, db.ignoredWords], async () => {
    if (updatedFoods.length > 0) await db.foods.bulkPut([...updatedFoods]);
    // 「食材ではない」から食材に選び直した品は、読まない言葉から外す
    if (ignoredWords.remove.length > 0) await db.ignoredWords.bulkDelete([...ignoredWords.remove]);
    if (ignoredWords.add.length > 0) await db.ignoredWords.bulkPut([...ignoredWords.add]);
    for (const item of items) {
      if (!(item.amount > 0)) continue;
      const current = (await db.stocks.get(item.foodId)) ?? null;
      await saveChange(db, item.foodId, addStock(current, item.foodId, item.amount, now, newId));
    }
  });
}

/**
 * 昼食で使った食材を在庫から減らし(理由:昼食)、確認画面で直した別名を辞書に保存する。
 * 1つのトランザクションで行うので、途中で失敗したら何も変わらない
 */
export async function useForLunchInDb(
  db: KondateDB,
  items: readonly { foodId: string; amount: number }[],
  updatedFoods: readonly Food[],
  now: Date,
  newId: IdGenerator = randomId,
): Promise<void> {
  await db.transaction('rw', db.stocks, db.stockMoves, db.foods, async () => {
    if (updatedFoods.length > 0) await db.foods.bulkPut([...updatedFoods]);
    for (const item of items) {
      if (!(item.amount > 0)) continue;
      const current = (await db.stocks.get(item.foodId)) ?? null;
      const change = changeStock({ current, foodId: item.foodId, delta: -item.amount, reason: '昼食', now, newId });
      await saveChange(db, item.foodId, change);
    }
  });
}

/**
 * 在庫の整理:選んだ食材をまとめて在庫から消す(理由:整理で削除)。
 * 在庫は保存する直前に読み直し、1つのトランザクションで行うので、途中で失敗したら何も変わらない
 */
export async function tidyUpStocksInDb(db: KondateDB, foodIds: readonly string[], now: Date, newId: IdGenerator = randomId): Promise<void> {
  await db.transaction('rw', db.stocks, db.stockMoves, async () => {
    const stocks = await db.stocks.toArray();
    for (const { foodId, change } of tidyUpStocks(stocks, foodIds, now, newId)) await saveChange(db, foodId, change);
  });
}
