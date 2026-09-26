// 食材の「ほかの数え方」(純粋関数)
// URL の取り込み・昼食の口頭入力・レシートの読み取りで、辞書と違う数え方の量を辞書の単位に換算するのに使う
import type { AltUnit, Food } from '../db/types';

/** 単位を比べる形にする(全角・半角、大文字・小文字の違いをそろえる) */
function unitKey(unit: string): string {
  return unit.normalize('NFKC').trim().toLowerCase();
}

/** その食材の、この単位のほかの数え方。なければ undefined */
export function findAltUnit(food: Food, unit: string): AltUnit | undefined {
  const key = unitKey(unit);
  if (key === '') return undefined;
  return food.altUnits.find((a) => unitKey(a.unit) === key);
}

/** ほかの数え方で書かれた量を、辞書の単位での量にする。その数え方がなければ null */
export function convertAltUnit(food: Food, value: number, unit: string): number | null {
  const alt = findAltUnit(food, unit);
  return alt ? value * alt.amount : null;
}
