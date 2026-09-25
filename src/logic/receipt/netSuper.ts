// ネットスーパーの「お届け内容」画面の文字を商品に分ける(純粋関数)
// 見本の形:商品名(2行に折り返すことがある)→「レシピ クチコミ投稿 問い合わせ」→「1 点 462 円☆」
import { NET_SUPER_COUNT_LINE, NET_SUPER_NOISE_WORDS } from '../../config/receipt';
import { toMatchForm } from '../textInput/normalize';
import { cleanProductName, isDropLine, isPriceOnlyLine, type ProductLine } from './lines';

/** ネットスーパーの画面の文字か(「N 点 … 円」の行がある) */
export function looksLikeNetSuper(lines: readonly string[]): boolean {
  return lines.some((l) => NET_SUPER_COUNT_LINE.test(l) && l.includes('円'));
}

function isNoise(line: string): boolean {
  const m = toMatchForm(line);
  return NET_SUPER_NOISE_WORDS.some((w) => m.includes(w)) || isDropLine(line) || isPriceOnlyLine(line);
}

/**
 * 「N 点」の行を1商品の終わりとして、その前の行をつなげて商品名にする。
 * 最後の「N 点」より後ろの行(セット商品の中身など)は商品にしない
 */
export function parseNetSuperLines(lines: readonly string[]): ProductLine[] {
  const products: ProductLine[] = [];
  let pending: string[] = [];
  for (const line of lines) {
    const count = NET_SUPER_COUNT_LINE.exec(line);
    if (count) {
      const name = cleanProductName(pending.join(''));
      if (name !== '') products.push({ name, count: Number(count[1]) });
      pending = [];
      continue;
    }
    if (!isNoise(line)) pending.push(line);
  }
  return products;
}
