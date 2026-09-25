// 貼り付けた文字を行に分け、商品の行だけにする(どのお店にも共通。純粋関数)
import { DATE_LINE, DROP_LINE_WORDS, NAME_PREFIX, NAME_PRICE_SUFFIX, PHONE_LINE, PRICE_ONLY_LINE } from '../../config/receipt';
import { cleanText, toMatchForm } from '../textInput/normalize';

/** 読み取った商品1つ(量はまだ読まない) */
export interface ProductLine {
  /** 商品名(値段や印を取ったもの。表示の形) */
  name: string;
  /** 点数・個数 */
  count: number;
  /** 2つの食材が見つかったので、行で分けて読んだ(写真の文字が紛れ込んだかもしれないので、自信のない食材にする) */
  split?: boolean;
}

/** 行に分けて、半角カナを全角に、空白を1つにそろえる。空の行は捨てる */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(cleanText)
    .filter((l) => l !== '');
}

/** 捨てる行か:「合計」「小計」「税」「ポイント」「TEL」などを含む行と、日付・電話番号の形の行 */
export function isDropLine(line: string): boolean {
  const m = toMatchForm(line);
  if (DROP_LINE_WORDS.some((w) => m.includes(w))) return true;
  return DATE_LINE.test(line) || PHONE_LINE.test(line);
}

/** 値段だけの行か */
export function isPriceOnlyLine(line: string): boolean {
  return PRICE_ONLY_LINE.test(line);
}

/** 商品名から、前の印(冷凍・冷蔵・記号)と後ろの値段を取る */
export function cleanProductName(line: string): string {
  return line.replace(NAME_PREFIX, '').replace(NAME_PRICE_SUFFIX, '').trim();
}
