// 在庫の増減(純粋関数)
// 在庫を変えるときは、必ずこの関数で「新しい在庫」と「在庫の動き」を一緒に作る
import type { DateString, Food, Stock, StockMove, StockMoveReason } from '../db/types';
import { addDays, toDateString, toDateTimeString } from './date';
import type { IdGenerator } from './id';

export interface StockChange {
  /** 変更後の在庫。null なら在庫から消す */
  stock: Stock | null;
  /** 記録する在庫の動き。量が変わらなければ null */
  move: StockMove | null;
}

export interface ChangeStockInput {
  current: Stock | null;
  foodId: string;
  delta: number;
  reason: StockMoveReason;
  now: Date;
  newId: IdGenerator;
  mealSetId?: string | null;
  /** 在庫が0から増えるときに使う追加日(キャンセルで戻すとき、元の追加日に戻すため)。なければ今日 */
  restoreAddedDate?: DateString | null;
}

/** 小数の誤差(0.1+0.2 など)を消すため、小数3桁で丸める */
export function roundAmount(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * 在庫を delta だけ増減する。
 * - 0 以下になったら在庫から消す(マイナスにはしない)
 * - 追加日は「在庫が0から増えた日」。残っているうちに増やしても変えない
 * - restoreAddedDate(キャンセルで戻すとき)があれば、0から増えるときはその日にし、
 *   残っている在庫の追加日より古ければ古い方にする(保存の目安を安全側で見るため)
 * - 在庫の動きには実際に変わった量を記録する(動きを逆に足せば必ず元に戻る)
 */
export function changeStock(input: ChangeStockInput): StockChange {
  const { current, foodId, delta, reason, now, newId, mealSetId = null, restoreAddedDate = null } = input;
  if (!Number.isFinite(delta)) throw new Error('量が数字ではありません');

  const before = current?.amount ?? 0;
  const after = Math.max(0, roundAmount(before + delta));
  const actualDelta = roundAmount(after - before);

  if (actualDelta === 0) {
    return { stock: current, move: null };
  }

  let addedDate = current && before > 0 ? current.addedDate : (restoreAddedDate ?? toDateString(now));
  if (restoreAddedDate !== null && delta > 0 && restoreAddedDate < addedDate) addedDate = restoreAddedDate;
  const stock: Stock | null = after <= 0 ? null : { foodId, amount: after, addedDate };

  const move: StockMove = {
    id: newId(),
    at: toDateTimeString(now),
    foodId,
    delta: actualDelta,
    reason,
    mealSetId,
  };

  return { stock, move };
}

/** 買ってきた食材を在庫に足す */
export function addStock(
  current: Stock | null,
  foodId: string,
  amount: number,
  now: Date,
  newId: IdGenerator,
): StockChange {
  if (!(amount > 0)) throw new Error('量は0より大きくしてください');
  return changeStock({ current, foodId, delta: amount, reason: '購入', now, newId });
}

/** 在庫の量を手で直す(0 なら在庫から消す) */
export function setStockAmount(
  current: Stock | null,
  foodId: string,
  amount: number,
  now: Date,
  newId: IdGenerator,
): StockChange {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('量は0以上の数字にしてください');
  const before = current?.amount ?? 0;
  return changeStock({ current, foodId, delta: amount - before, reason: '手直し', now, newId });
}

/** 在庫から消す */
export function removeStock(current: Stock, now: Date, newId: IdGenerator): StockChange {
  return setStockAmount(current, current.foodId, 0, now, newId);
}

/** 保存の目安を過ぎたか:追加日+保存の目安日数の日より後なら true(その日までは過ぎていない) */
export function isPastShelfLife(stock: Stock, food: Food, today: DateString): boolean {
  return today > addDays(stock.addedDate, food.shelfLifeDays);
}

/**
 * 在庫の整理:選んだ食材を在庫からまとめて消す(理由:整理で削除)。
 * 在庫にない食材は飛ばす。同じ食材を2回選んでも1回だけ消す
 */
export function tidyUpStocks(
  stocks: readonly Stock[],
  foodIds: readonly string[],
  now: Date,
  newId: IdGenerator,
): { foodId: string; change: StockChange }[] {
  const byId = new Map(stocks.map((s) => [s.foodId, s]));
  return [...new Set(foodIds)].flatMap((foodId) => {
    const current = byId.get(foodId);
    if (!current) return [];
    return [{ foodId, change: changeStock({ current, foodId, delta: -current.amount, reason: '整理で削除', now, newId }) }];
  });
}
