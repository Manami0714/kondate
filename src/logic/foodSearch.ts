// 食材辞書から名前・別名で食材を探す(純粋関数)
import type { Food } from '../db/types';

/**
 * 比べやすい形にそろえる
 * - 半角カナ→全角、全角英数→半角(NFKC)
 * - ひらがな→カタカナ
 * - 空白を取り、英字は小文字に
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 一致の強さ。小さいほど強い。一致しなければ null */
function matchRank(query: string, food: Food): number | null {
  const names = [food.name, ...food.aliases].map(normalizeForSearch);
  if (names.some((n) => n === query)) return 0;
  if (names.some((n) => n.startsWith(query))) return 1;
  if (names.some((n) => n.includes(query))) return 2;
  return null;
}

/** 名前と別名で探す。完全一致→前方一致→部分一致の順、同じ強さなら名前順 */
export function searchFoods(foods: readonly Food[], query: string, limit = 20): Food[] {
  const q = normalizeForSearch(query);
  if (q === '') return [];
  return foods
    .map((food) => ({ food, rank: matchRank(q, food) }))
    .filter((x): x is { food: Food; rank: number } => x.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.food.name.localeCompare(b.food.name, 'ja'))
    .slice(0, limit)
    .map((x) => x.food);
}

/** 同じ名前(別名を含む)の食材がすでにあるか */
export function findFoodByExactName(foods: readonly Food[], name: string): Food | undefined {
  const q = normalizeForSearch(name);
  if (q === '') return undefined;
  return foods.find((f) => [f.name, ...f.aliases].some((n) => normalizeForSearch(n) === q));
}
