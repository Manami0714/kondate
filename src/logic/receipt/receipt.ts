// よくある形のレシートの文字を商品に分ける(純粋関数)
// 形の例:「ﾀﾏｺﾞ 10ｺ ¥238」の1行、または商品の行の次に「2コX単98」の数量の行
import { RECEIPT_COUNT_LINE } from '../../config/receipt';
import { cleanProductName, isDropLine, isPriceOnlyLine, type ProductLine } from './lines';

export function parseReceiptLines(lines: readonly string[]): ProductLine[] {
  const products: ProductLine[] = [];
  for (const line of lines) {
    const count = RECEIPT_COUNT_LINE.exec(line);
    if (count) {
      // 数量の行は、1つ前の商品の個数にする
      const last = products[products.length - 1];
      if (last) last.count = Number(count[1]);
      continue;
    }
    if (isDropLine(line) || isPriceOnlyLine(line)) continue;
    const name = cleanProductName(line);
    if (name !== '' && !/^[\d\s,.¥\\-]+$/.test(name)) products.push({ name, count: 1 });
  }
  return products;
}
