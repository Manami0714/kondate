// キャンセルした日の献立を作り直す(純粋関数)
// 1日分だけ提案するための条件を作る。組み方は3日分と同じ makePlan・swapDish・pinDish を使う
import type { DateString, FixedDish, MealSet, Member, PlanConditions } from '../../db/types';
import { buildDays, isDateTakenByOther } from './days';
import { COURSE_SLOTS, type PlanRequest } from './types';

/**
 * その日を作り直せるか:キャンセルした日で、今日以降で、その日付をほかの献立セットが使っていない
 * (キャンセルした日から新しいセットを作っていたら、そちらが優先)
 */
export function canRebuildDay(set: MealSet, dayIndex: number, mealSets: readonly MealSet[], today: DateString): boolean {
  const day = set.days[dayIndex];
  return day !== undefined && day.status === 'キャンセル' && day.date >= today && !isDateTakenByOther(mealSets, day.date, set.id);
}

/** 同じ献立セットのほかの日(キャンセル以外)で使っているレシピ。作り直す日にはアプリが選ばない */
export function otherDayRecipeIds(set: MealSet, dayIndex: number): string[] {
  return set.days.flatMap((d, i) => (i === dayIndex || d.status === 'キャンセル' ? [] : COURSE_SLOTS.map((s) => d[s.key])));
}

/**
 * 作り直す1日分の条件。メンバーは、家族と、その日に献立セットのゲストとして泊まっている人。
 * 料理の指定は1日分なので、何日目は 0 で持つ
 */
export function rebuildRequest(
  set: MealSet,
  dayIndex: number,
  members: readonly Member[],
  conditions: PlanConditions,
  fixed: readonly FixedDish[],
): PlanRequest {
  const date = set.days[dayIndex]?.date ?? set.startDate;
  return {
    days: buildDays(date, members, set.guests, 1),
    conditions,
    fixed,
    excludeRecipeIds: otherDayRecipeIds(set, dayIndex),
  };
}
