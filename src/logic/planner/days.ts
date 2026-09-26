// 献立セットの日付と、日ごとのメンバー(純粋関数)
import { DAYS_PER_SET } from '../../config/scoring';
import type { DateString, GuestStay, MealSet, MealStatus, Member } from '../../db/types';
import { addDays, formatShortDate } from '../date';
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
/** 献立で使っている日(日付と状態)。キャンセルしたセット・キャンセルした日は数えない。「作った」の日は数える */
export interface TakenDay {
  date: DateString;
  status: Exclude<MealStatus, 'キャンセル'>;
  mealSetId: string;
}

function takenDays(mealSets: readonly MealSet[]): TakenDay[] {
  return mealSets
    .filter((s) => s.status !== 'キャンセル')
    .flatMap((s) =>
      s.days.flatMap((d) => (d.status === 'キャンセル' ? [] : [{ date: d.date, status: d.status, mealSetId: s.id }])),
    );
}

/** 新しい献立セットの開始日の初期値:使っている日の最後の翌日、なければ今日(今日より前にはしない) */
export function defaultStartDate(mealSets: readonly MealSet[], today: DateString): DateString {
  const dates = takenDays(mealSets).map((d) => d.date);
  if (dates.length === 0) return today;
  const next = addDays(dates.reduce((a, b) => (a > b ? a : b)), 1);
  return next > today ? next : today;
}

/** 新しい献立セットと重なる、使っている日(日付の順) */
export function overlappingDays(mealSets: readonly MealSet[], startDate: DateString, count = DAYS_PER_SET): TakenDay[] {
  const lastDate = addDays(startDate, count - 1);
  return takenDays(mealSets)
    .filter((d) => d.date >= startDate && d.date <= lastDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 日付が重なる献立セットがあるか */
export function overlapsExisting(mealSets: readonly MealSet[], startDate: DateString, count = DAYS_PER_SET): boolean {
  return overlappingDays(mealSets, startDate, count).length > 0;
}

/** 重なったときのエラーの文。例:「10/2(作った)の献立と重なります」 */
export function overlapMessage(days: readonly TakenDay[]): string {
  return `${days.map((d) => `${formatShortDate(d.date)}(${d.status})`).join('・')}の献立と重なります`;
}

/** from 以降で、count 日とも空いている最初の開始日 */
export function nextFreeStartDate(mealSets: readonly MealSet[], from: DateString, count = DAYS_PER_SET): DateString {
  let start = from;
  for (;;) {
    const overlaps = overlappingDays(mealSets, start, count);
    if (overlaps.length === 0) return start;
    // 重なった日の最後の翌日から探し直す(使っている日は有限なので必ず終わる)
    start = addDays(overlaps[overlaps.length - 1].date, 1);
  }
}

/** その日付を、ほかの献立セット(exceptSetId 以外)が使っているか */
export function isDateTakenByOther(mealSets: readonly MealSet[], date: DateString, exceptSetId: string): boolean {
  return takenDays(mealSets).some((d) => d.date === date && d.mealSetId !== exceptSetId);
}

/**
 * 献立の画面に出す献立セット:「予定」の日があるか、今日以降に「作った」の日がある。
 * 全部キャンセルしたセットは出さない(その日付からは新しいセットを作れる)
 */
export function isVisibleMealSet(set: MealSet, today: DateString): boolean {
  return set.days.some((d) => d.status === '予定' || (d.status === '作った' && d.date >= today));
}
