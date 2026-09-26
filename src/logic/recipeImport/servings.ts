// 何人分の読み取り(純粋関数)
import { cleanText } from '../textInput/normalize';

/**
 * 何人分を読む。読めなければ null
 * - 「2人分」「2人前」「2」「2 servings」→ 2
 * - 幅があるとき(「2〜3人分」)は小さい方
 * - 人数でないもの(「12個分」)は読まない
 * - 配列(構造化データの recipeYield)は、読めた最初のもの
 */
export function parseServings(value: readonly string[] | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const list = typeof value === 'string' ? [value] : value;
  for (const item of list) {
    const n = readOne(item);
    if (n !== null) return n;
  }
  return null;
}

function readOne(text: string): number | null {
  const t = cleanText(text);
  const m = /^(?:約)?(\d+(?:\.\d+)?)\s*(?:[〜~\-–ー]\s*\d+(?:\.\d+)?\s*)?(人分|人前|人|servings?|serves)?/i.exec(t);
  if (!m) return null;
  const rest = t.slice(m[0].length).trim();
  // 数字のあとに人数以外の単位(個分・枚など)が続くときは読まない
  if (!m[2] && rest !== '' && !/^[((]/.test(rest)) return null;
  const n = Math.floor(Number(m[1]));
  return n >= 1 ? n : null;
}
