// レシート・ネットスーパーの貼り付けの読み取り(純粋関数)
// 商品ごとに、食材辞書と照らし合わせて「読み取った/自信がない/読めなかった/食材ではない」に分ける
import { IGNORED_CONTAIN_MIN_LENGTH } from '../../config/receipt';
import { COUNT_UNITS, GENERIC_COUNT_UNIT } from '../../config/textInput';
import type { Food, IgnoredWord } from '../../db/types';
import { findFoodByExactName, normalizeForSearch } from '../foodSearch';
import { roundAmount } from '../stock';
import { toFoodAmount, type AmountNote, type Quantity } from '../textInput/amount';
import { toMatchForm } from '../textInput/normalize';
import { findSpans, foodTerms } from '../textInput/spans';
import { splitLines, type ProductLine } from './lines';
import { looksLikeNetSuper, parseNetSuperLines } from './netSuper';
import { numberQuantities, productWord, withoutParens } from './productWord';
import { parseReceiptLines } from './receipt';

export { productWord } from './productWord';

export type PasteStatus = '読み取った' | '自信がない' | '読めなかった' | '食材ではない';

/** 読み取った商品1つ */
export interface PasteItem {
  /** 商品名(表示用) */
  name: string;
  /** 別名・読まない言葉にするときの言葉(商品名から量を取ったもの) */
  word: string;
  count: number;
  /** 商品名の中の量(なければ null) */
  quantity: Quantity | null;
  status: PasteStatus;
  /** 当てはめた食材(読めなかった・食材ではないときは null) */
  foodId: string | null;
  /** 見つかった食材の候補(自信がないときに選べるように) */
  candidateIds: string[];
  /** 在庫に足す量(辞書の単位。食材がなければ 0) */
  amount: number;
  note: AmountNote | null;
}

export interface PasteResult {
  source: 'ネットスーパー' | 'レシート';
  items: PasteItem[];
}

/** 商品名の中の量から、食材の単位に合うものを選ぶ(「16個216g」なら、g の食材には216g) */
function pickQuantity(name: string, food: Food | null): Quantity | null {
  const list = numberQuantities(name).map((q) => q.quantity);
  if (food) {
    const fits = list.find(
      (q) =>
        q.kind === 'number' &&
        (q.unit === food.unit || (q.unit === GENERIC_COUNT_UNIT && COUNT_UNITS.includes(food.unit)) || q.unit === null),
    );
    if (fits) return fits;
    // 単位が合わなければ、重さで書かれた量(1単位あたりの重さで換算できる)を優先する
    if (food.gramsPerUnit !== null) {
      const grams = list.find((q) => q.kind === 'number' && q.unit === 'g');
      if (grams) return grams;
    }
  }
  return list[0] ?? null;
}

/** 当てはまる読まない言葉(同じ言葉か、十分に長ければ、どちらかがもう一方を含む) */
export function matchingIgnoredWords(word: string, ignored: readonly IgnoredWord[]): IgnoredWord[] {
  const key = normalizeForSearch(word);
  if (key === '') return [];
  return ignored.filter(
    (w) =>
      w.word === key ||
      (Math.min(w.word.length, key.length) >= IGNORED_CONTAIN_MIN_LENGTH && (key.includes(w.word) || w.word.includes(key))),
  );
}

/** 食材に当てはめたときの量:商品名の量×点数。量がなければふつうの量×点数 */
export function purchaseAmount(item: Pick<PasteItem, 'name' | 'count'>, food: Food): { amount: number; note: AmountNote | null } {
  const { amount, note } = toFoodAmount(pickQuantity(item.name, food), food, 0);
  return { amount: roundAmount(amount * item.count), note };
}

/** 商品名(量を取った言葉、または ( ) の中を取った言葉)が、辞書の名前・別名とまったく同じ食材 */
function exactFood(word: string, foods: readonly Food[]): Food | undefined {
  return findFoodByExactName(foods, word) ?? findFoodByExactName(foods, withoutParens(word));
}

/**
 * 1商品を分ける。
 * - 読み取った:商品名が辞書の名前・別名とまったく同じ(直した内容を別名に入れると、次からここに入る)
 * - 自信がない:商品名の一部だけが辞書と合った(「おさかなソーセージ」の「ソーセージ」など)、
 *   または行で分けて読んだ。迷ったらこちら(安全側)に倒す
 * - 読めなかった:辞書の食材が見つからない
 */
function classify(product: ProductLine, foods: readonly Food[], ignored: readonly IgnoredWord[]): PasteItem {
  const word = productWord(product.name);
  const base = { name: product.name, word, count: product.count };
  const empty = { foodId: null, candidateIds: [], amount: 0, note: null, quantity: pickQuantity(product.name, null) };
  if (matchingIgnoredWords(word, ignored).length > 0) return { ...base, ...empty, status: '食材ではない' };

  const exact = product.split ? undefined : exactFood(word, foods);
  const match = toMatchForm(product.name);
  // かな1文字だけの一致(「ふんわり」の「ふ」=麩 など)は、ほかの言葉の一部なので数えない
  const spans = findSpans(match, foodTerms(foods)).filter((s) => s.end - s.start > 1 || !/[ァ-ヶー]/.test(match[s.start]));
  const candidateIds = [...new Set([...(exact ? [exact.id] : []), ...spans.map((s) => s.value.id)])];
  if (candidateIds.length === 0) return { ...base, ...empty, status: '読めなかった' };

  const food = exact ?? (foods.find((f) => f.id === candidateIds[0]) as Food);
  const { amount, note } = purchaseAmount(product, food);
  return {
    ...base,
    status: exact ? '読み取った' : '自信がない',
    foodId: food.id,
    candidateIds,
    amount,
    note,
    quantity: pickQuantity(product.name, food),
  };
}

/**
 * 貼り付けた文字を読む。
 * 「N 点 … 円」の行があればネットスーパーの画面、なければレシートとして商品に分け、食材辞書と照らし合わせる
 */
export function parsePaste(text: string, foods: readonly Food[], ignored: readonly IgnoredWord[]): PasteResult {
  const lines = splitLines(text);
  const netSuper = looksLikeNetSuper(lines);
  const products = netSuper ? parseNetSuperLines(lines, foods, ignored) : parseReceiptLines(lines);
  return {
    source: netSuper ? 'ネットスーパー' : 'レシート',
    items: products.map((p) => classify(p, foods, ignored)),
  };
}
