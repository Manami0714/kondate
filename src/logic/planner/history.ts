// 作った料理の履歴(純粋関数)
import type { CookingMethod } from '../../data/tags';
import type { DateString, MealSet, Recipe } from '../../db/types';
import { diffDays } from '../date';
import type { HistoryEntry } from './types';

/**
 * 献立セットから「作った」とみなす料理を集める(「最近作った料理」と「調理法の頻度」に使う)。
 * 「作った」の1食に加え、まだ「作った」を押していない「予定」の1食も、日付が過ぎたものもこれからのものも数える。
 * キャンセルは数えない
 */
export function cookedHistory(mealSets: readonly MealSet[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const set of mealSets) {
    if (set.status === 'キャンセル') continue;
    for (const day of set.days) {
      if (day.status === 'キャンセル') continue;
      for (const recipeId of [day.mainId, day.sideId, day.soupId]) entries.push({ date: day.date, recipeId });
    }
  }
  return entries;
}

/**
 * その料理を作った(作る予定の)日のうち、date に最も近い日までの日数。なければ null。
 * 献立の中では後の日に同じ料理があることもあるので、前後どちらも見る(同じ日は数えない)
 */
export function daysToNearestCooked(recipeId: string, history: readonly HistoryEntry[], date: DateString): number | null {
  let best: number | null = null;
  for (const h of history) {
    if (h.recipeId !== recipeId) continue;
    const gap = Math.abs(diffDays(h.date, date));
    if (gap > 0 && (best === null || gap < best)) best = gap;
  }
  return best;
}

/** date より前の windowDays 日のうちに、その調理法の料理を作った回数 */
export function methodCount(
  method: CookingMethod,
  history: readonly HistoryEntry[],
  recipesById: ReadonlyMap<string, Recipe>,
  date: DateString,
  windowDays: number,
): number {
  let count = 0;
  for (const h of history) {
    const gap = diffDays(h.date, date);
    if (gap <= 0 || gap > windowDays) continue;
    if (recipesById.get(h.recipeId)?.methods.includes(method)) count++;
  }
  return count;
}
