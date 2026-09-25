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
