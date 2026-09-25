// 在庫を仮に減らしてみる(純粋関数)
// 献立を組む途中で「この料理を作ったら在庫がどれだけ残り、何が足りないか」を計算する
import type { DateString, RecipeIngredient, Stock } from '../../db/types';
import { roundAmount } from '../stock';

/** 仮の在庫。食材ID → 量と追加日 */
export type SimStock = ReadonlyMap<string, { amount: number; addedDate: DateString }>;

export function toSimStock(stocks: readonly Stock[]): SimStock {
  return new Map(stocks.map((s) => [s.foodId, { amount: s.amount, addedDate: s.addedDate }]));
}

export interface DishUse {
  /** 在庫から使う量 */
  used: Map<string, number>;
  /** 足りない量(買い足しが必要) */
  shortage: Map<string, number>;
}

/**
 * 料理1品分の材料(量は人数に合わせたもの)を在庫から使ったら、どれだけ使いどれだけ足りないか。
 * 常備調味料は在庫管理しないので、使うことも足りなくなることもない
 */
export function dishUse(state: SimStock, ingredients: readonly RecipeIngredient[], pantryIds: ReadonlySet<string>): DishUse {
  const used = new Map<string, number>();
  const shortage = new Map<string, number>();
  for (const ing of ingredients) {
    if (pantryIds.has(ing.foodId)) continue;
    const take = Math.min(state.get(ing.foodId)?.amount ?? 0, ing.amount);
    if (take > 0) used.set(ing.foodId, take);
    const lack = roundAmount(ing.amount - take);
    if (lack > 0) shortage.set(ing.foodId, lack);
  }
  return { used, shortage };
}

/** 使った量を引いた新しい仮の在庫を返す(元の在庫は変えない) */
export function applyUse(state: SimStock, used: ReadonlyMap<string, number>): SimStock {
  const next = new Map(state);
  for (const [foodId, amount] of used) {
    const have = next.get(foodId);
    if (!have) continue;
    const rest = roundAmount(have.amount - amount);
    if (rest > 0) next.set(foodId, { ...have, amount: rest });
    else next.delete(foodId);
  }
  return next;
}
