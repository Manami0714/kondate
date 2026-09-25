// 日付の変換。現在の日付は必ず引数で受け取る
import type { DateString, DateTimeString } from '../db/types';

/** 端末の地域時刻での日付(YYYY-MM-DD) */
export function toDateString(date: Date): DateString {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDateTimeString(date: Date): DateTimeString {
  return date.toISOString();
}

/** 画面表示用:「9/25」 */
export function formatShortDate(value: DateString): string {
  const [, m, d] = value.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** 日付(YYYY-MM-DD)を、時差の影響を受けない通し日数にする */
function toDayNumber(value: DateString): number {
  const [y, m, d] = value.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** n 日後の日付(n が負なら前の日付) */
export function addDays(value: DateString, n: number): DateString {
  const date = new Date((toDayNumber(value) + n) * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** to − from の日数(to が後なら正) */
export function diffDays(from: DateString, to: DateString): number {
  return Math.round(toDayNumber(to) - toDayNumber(from));
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 画面表示用:「9/25(金)」 */
export function formatDayLabel(value: DateString): string {
  const weekday = WEEKDAYS[new Date(toDayNumber(value) * 86_400_000).getUTCDay()];
  return `${formatShortDate(value)}(${weekday})`;
}
