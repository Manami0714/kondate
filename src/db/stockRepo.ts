// 在庫の変更をデータベースに保存する
// 計算は logic/stock.ts の純粋関数に任せ、ここでは在庫と在庫の動きを同時に書き込むだけ
import type { KondateDB } from './db';
import type { Stock } from './types';
import { addStock, setStockAmount, type StockChange } from '../logic/stock';
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
