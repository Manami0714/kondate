// 文の中から、辞書の言葉が出てくる位置を探す(純粋関数)
import type { Food } from '../../db/types';
import { normalizeForSearch } from '../foodSearch';

/** 探す言葉と、見つかったときに返す値 */
export interface Term<T> {
  /** 比べる形(normalizeForSearch 済み) */
  key: string;
  value: T;
  /** 同じ長さで重なったときの優先度。小さいほど優先 */
  priority?: number;
}

/** 見つかった位置 */
export interface Span<T> {
  start: number;
  end: number;
  value: T;
}

/**
 * 比べる形の文(toMatchForm 済み)から、言葉が出てくる位置をすべて探し、重ならないものだけを残す。
 * 長い言葉を優先する(「ほうれん草の胡麻和え」があれば、その中の「ほうれん草」「胡麻和え」は捨てる)。
 * 同じ長さなら priority が小さいもの、それも同じなら前にあるもの。結果は文の前から順
 */
export function findSpans<T>(matchText: string, terms: readonly Term<T>[]): Span<T>[] {
  const found: (Span<T> & { priority: number })[] = [];
  for (const term of terms) {
    if (term.key === '') continue;
    let from = 0;
    for (;;) {
      const at = matchText.indexOf(term.key, from);
      if (at < 0) break;
      found.push({ start: at, end: at + term.key.length, value: term.value, priority: term.priority ?? 0 });
      from = at + 1;
    }
  }
  found.sort((a, b) => b.end - b.start - (a.end - a.start) || a.priority - b.priority || a.start - b.start);
  const taken: Span<T>[] = [];
  for (const s of found) {
    if (taken.every((t) => s.end <= t.start || t.end <= s.start)) taken.push({ start: s.start, end: s.end, value: s.value });
  }
  return taken.sort((a, b) => a.start - b.start);
}

/** 食材の名前と別名を、探す言葉にする */
export function foodTerms(foods: readonly Food[], priority = 0): Term<Food>[] {
  return foods.flatMap((food) =>
    [...new Set([food.name, ...food.aliases].map(normalizeForSearch))].map((key) => ({ key, value: food, priority })),
  );
}
