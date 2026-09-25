// 貼り付けの確認画面の内容から、保存するものを決める(純粋関数)
import type { Food, IgnoredWord } from '../../db/types';
import { withAlias, withoutAlias } from '../aliases';
import { parseAmount } from '../forms';
import { makeIgnoredWord } from './ignoredWord';
import { matchingIgnoredWords, type PasteItem } from './parsePaste';

/** 確認画面の1行の状態 */
export interface PasteRowState {
  item: PasteItem;
  foodId: string | null;
  amountText: string;
  include: boolean;
  /** 確認画面で食材を選び直した(商品名を別名として覚える) */
  corrected: boolean;
  /** 「食材ではない」を選んだ */
  notFood: boolean;
}

export type PasteSavePlan =
  | {
      ok: true;
      /** 在庫に足す食材と量 */
      items: { foodId: string; amount: number }[];
      /** 別名を足した・外した食材 */
      updatedFoods: Food[];
      ignoredWords: { add: IgnoredWord[]; remove: string[] };
    }
  | { ok: false; errors: string[] };

/**
 * 確認画面の内容から、保存するものを決める。
 * - チェックの入った食材を在庫に足す
 * - 選び直した食材は、商品名(量を取った言葉)を別名として足す
 * - この画面で「食材ではない」を選んだ品は読まない言葉にし、その言葉とまったく同じ別名が辞書にあれば外す
 * - 「食材ではない」に入っていた品を食材に選び直したら、その読まない言葉を外す
 */
export function planPasteSave(
  rows: readonly PasteRowState[],
  foods: readonly Food[],
  ignored: readonly IgnoredWord[],
  now: Date,
): PasteSavePlan {
  const errors: string[] = [];
  const items: { foodId: string; amount: number }[] = [];
  for (const row of rows) {
    if (!row.include || row.notFood || row.foodId === null) continue;
    const amount = parseAmount(row.amountText);
    if (amount === null || amount <= 0) errors.push(`${row.item.name}の量を0より大きい数字にしてください`);
    else items.push({ foodId: row.foodId, amount });
  }
  if (errors.length > 0) return { ok: false, errors };

  const current = new Map(foods.map((f) => [f.id, f]));
  const changed = new Set<string>();
  const put = (food: Food) => {
    current.set(food.id, food);
    changed.add(food.id);
  };

  const newlyNotFood = rows.filter((r) => r.notFood && r.item.status !== '食材ではない');
  for (const row of newlyNotFood) {
    for (const food of [...current.values()]) {
      const next = withoutAlias(food, row.item.word);
      if (next) put(next);
    }
  }
  for (const row of rows) {
    if (!row.include || row.notFood || !row.corrected || row.foodId === null) continue;
    const food = current.get(row.foodId);
    const next = food ? withAlias(food, row.item.word, [...current.values()]) : null;
    if (next) put(next);
  }

  const add = newlyNotFood.map((r) => makeIgnoredWord(r.item.word, now)).filter((w): w is IgnoredWord => w !== null);
  const remove = rows
    .filter((r) => r.item.status === '食材ではない' && !r.notFood && r.foodId !== null)
    .flatMap((r) => matchingIgnoredWords(r.item.word, ignored).map((w) => w.word));

  return {
    ok: true,
    items,
    updatedFoods: [...changed].map((id) => current.get(id) as Food),
    ignoredWords: { add, remove: [...new Set(remove)] },
  };
}
