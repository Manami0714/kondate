// 献立セットの確定・キャンセル・買った・作ったを、データベースに保存する
// 計算は logic/mealSet.ts の純粋関数に任せ、ここでは在庫・在庫の動き・献立セットを1つのトランザクションで書き込むだけ
import type { KondateDB } from './db';
import { deleteDraft } from './draftRepo';
import type { MealSet, Stock } from './types';
import { randomId, type IdGenerator } from '../logic/id';
import {
  cancelDay,
  cancelSet,
  confirmPlan,
  markBought,
  markCooked,
  type ConfirmInput,
  type MealSetChange,
  type MealSetResult,
} from '../logic/mealSet';

async function saveChange(db: KondateDB, change: MealSetChange): Promise<void> {
  for (const [foodId, stock] of change.stocks) {
    if (stock) await db.stocks.put(stock);
    else await db.stocks.delete(foodId);
  }
  if (change.moves.length > 0) await db.stockMoves.bulkAdd(change.moves);
  await db.mealSets.put(change.mealSet);
}

/** 献立セットと今の在庫を読んで計算し、結果を保存する */
async function update(
  db: KondateDB,
  mealSetId: string,
  compute: (set: MealSet, stocks: Stock[]) => MealSetResult,
): Promise<MealSetResult> {
  return db.transaction('rw', db.stocks, db.stockMoves, db.mealSets, async () => {
    const set = await db.mealSets.get(mealSetId);
    if (!set) return { ok: false, error: '献立セットが見つかりません' } as const;
    const result = compute(set, await db.stocks.toArray());
    if (result.ok) await saveChange(db, result.change);
    return result;
  });
}

/** 献立を確定する。在庫は保存する直前にデータベースから読み直す。確定したら下書きを消す */
export async function confirmPlanToDb(db: KondateDB, input: Omit<ConfirmInput, 'data'> & { data: Omit<ConfirmInput['data'], 'stocks'> }): Promise<MealSet> {
  return db.transaction('rw', db.stocks, db.stockMoves, db.mealSets, db.planDrafts, async () => {
    const stocks = await db.stocks.toArray();
    const change = confirmPlan({ ...input, data: { ...input.data, stocks } });
    await saveChange(db, change);
    await deleteDraft(db);
    return change.mealSet;
  });
}

export function cancelDayInDb(db: KondateDB, mealSetId: string, dayIndex: number, now: Date, newId: IdGenerator = randomId) {
  return update(db, mealSetId, (set, stocks) => cancelDay(set, dayIndex, stocks, now, newId));
}

export function cancelSetInDb(db: KondateDB, mealSetId: string, now: Date, newId: IdGenerator = randomId) {
  return update(db, mealSetId, (set, stocks) => cancelSet(set, stocks, now, newId));
}

export function markBoughtInDb(
  db: KondateDB,
  mealSetId: string,
  foodId: string,
  amount: number,
  now: Date,
  newId: IdGenerator = randomId,
) {
  return update(db, mealSetId, (set, stocks) => markBought(set, foodId, amount, stocks, now, newId));
}

export function markCookedInDb(db: KondateDB, mealSetId: string, dayIndex: number) {
  return update(db, mealSetId, (set) => markCooked(set, dayIndex));
}
