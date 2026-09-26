// 調理時間の読み取り(純粋関数)
import { cleanText } from '../textInput/normalize';

/**
 * 時間の書き方を分にする。読めなければ null
 * - ISO 8601 の期間(構造化データの形):PT15M、PT1H30M、P0DT0H20M
 * - 文字:「約15分」「1時間30分」「1時間半」「15分以内」
 */
export function parseMinutes(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = cleanText(text);
  const iso = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(t);
  if (iso && t.length > 1) {
    const [, d, h, m, s] = iso.map((v) => (v === undefined ? 0 : Number(v)));
    return positive(Math.round(d * 1440 + h * 60 + m + s / 60));
  }
  // 「10〜15分」は短い方にする
  const plain = t.replace(/[〜~\-–]\s*\d+\s*(?=分)/, '');
  const hm = /(\d+(?:\.\d+)?)\s*時間\s*(半)?(?:\s*(\d+)\s*分)?/.exec(plain);
  if (hm) {
    const hours = Number(hm[1]) + (hm[2] ? 0.5 : 0);
    return positive(Math.round(hours * 60 + (hm[3] ? Number(hm[3]) : 0)));
  }
  const m = /(\d+)\s*分/.exec(plain);
  return m ? positive(Number(m[1])) : null;
}

function positive(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 構造化データの時間:合計の時間、なければ調理+下ごしらえの時間 */
export function recipeMinutes(times: { totalTime?: string | null; cookTime?: string | null; prepTime?: string | null }): number | null {
  const total = parseMinutes(times.totalTime);
  if (total !== null) return total;
  const cook = parseMinutes(times.cookTime);
  const prep = parseMinutes(times.prepTime);
  if (cook === null && prep === null) return null;
  return (cook ?? 0) + (prep ?? 0);
}
