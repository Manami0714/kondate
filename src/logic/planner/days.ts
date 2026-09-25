// 献立セットの日付と、日ごとのメンバー(純粋関数)
import { DAYS_PER_SET } from '../../config/scoring';
import type { DateString, GuestStay, MealSet, Member } from '../../db/types';
import { addDays } from '../date';
import type { DayInput } from './types';

/** 画面の「何日目から(1始まり)・何日間」を、日付の滞在にする */
export function guestStay(memberId: string, startDate: DateString, fromDay: number, days: number): GuestStay {
  const fromDate = addDays(startDate, fromDay - 1);
  return { memberId, fromDate, toDate: addDays(fromDate, days - 1) };
}

/** 日ごとのメンバー:家族全員+その日に滞在しているゲスト */
export function buildDays(
  startDate: DateString,
  members: readonly Member[],
  guests: readonly GuestStay[],
  count = DAYS_PER_SET,
): DayInput[] {
  const family = members.filter((m) => m.kind === '家族').map((m) => m.id);
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(startDate, i);
    const staying = guests.filter((g) => g.fromDate <= date && date <= g.toDate).map((g) => g.memberId);
    return { date, memberIds: [...new Set([...family, ...staying])] };
  });
}

/** 前の献立セットのゲストのうち、新しいセットの日付にかかる滞在(次のセットへの引き継ぎ) */
export function carryOverGuests(mealSets: readonly MealSet[], startDate: DateString, count = DAYS_PER_SET): GuestStay[] {
  const lastDate = addDays(startDate, count - 1);
  return mealSets
    .filter((s) => s.status !== 'キャンセル')
    .flatMap((s) => s.guests)
    .filter((g) => g.toDate >= startDate && g.fromDate <= lastDate);
}

/** 新しい献立セットの開始日の初期値:予定中のセットの最終日の翌日、なければ今日 */
export function defaultStartDate(mealSets: readonly MealSet[], today: DateString): DateString {
  const lastDates = mealSets
    .filter((s) => s.status === '予定')
    .flatMap((s) => s.days.map((d) => d.date));
  if (lastDates.length === 0) return today;
  const next = addDays(lastDates.reduce((a, b) => (a > b ? a : b)), 1);
  return next > today ? next : today;
}

/** 日付が重なる献立セット(キャンセル以外)があるか */
export function overlapsExisting(mealSets: readonly MealSet[], startDate: DateString, count = DAYS_PER_SET): boolean {
  const lastDate = addDays(startDate, count - 1);
  return mealSets
    .filter((s) => s.status !== 'キャンセル')
    .some((s) => s.days.some((d) => d.status !== 'キャンセル' && d.date >= startDate && d.date <= lastDate));
}
