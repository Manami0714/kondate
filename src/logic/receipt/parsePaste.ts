// レシート・ネットスーパーの貼り付けの読み取り(純粋関数)
// 商品ごとに、食材辞書と照らし合わせて「読み取った/自信がない/読めなかった/食材ではない」に分ける
import { COUNT_UNITS, GENERIC_COUNT_UNIT } from '../../config/textInput';
import { IGNORED_CONTAIN_MIN_LENGTH, PREPARED_WORDS } from '../../config/receipt';
import type { Food, IgnoredWord } from '../../db/types';
import { normalizeForSearch } from '../foodSearch';
import { roundAmount } from '../stock';
import { findQuantities, toFoodAmount, type AmountNote, type Quantity } from '../textInput/amount';
import { toMatchForm } from '../textInput/normalize';
import { findSpans, foodTerms } from '../textInput/spans';
import { splitLines, type ProductLine } from './lines';
import { looksLikeNetSuper, parseNetSuperLines } from './netSuper';
import { parseReceiptLines } from './receipt';

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

/** 商品名の量として使う数(単位つき、または「1/4カット」のような1より小さい数) */
function numberQuantities(name: string): { quantity: Quantity; start: number; end: number }[] {
  return findQuantities(toMatchForm(name)).filter(
    (q) => q.quantity.kind === 'number' && (q.quantity.unit !== null || q.quantity.value < 1),
  );
}

/** 別名・読まない言葉にする言葉:商品名から量を取り、空白と後ろの記号を整える */
export function productWord(name: string): string {
  let word = name;
  for (const q of [...numberQuantities(name)].reverse()) word = word.slice(0, q.start) + ' ' + word.slice(q.end);
  return word
    .replace(/カット/g, ' ')
    .replace(/[(（]\s*[)）]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s×x*・]+$/, '')
    .trim();
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

function isIgnored(word: string, ignored: readonly IgnoredWord[]): boolean {
  return matchingIgnoredWords(word, ignored).length > 0;
}

/** 食材に当てはめたときの量:商品名の量×点数。量がなければふつうの量×点数 */
export function purchaseAmount(item: Pick<PasteItem, 'name' | 'count'>, food: Food): { amount: number; note: AmountNote | null } {
  const { amount, note } = toFoodAmount(pickQuantity(item.name, food), food, 0);
  return { amount: roundAmount(amount * item.count), note };
}

function classify(product: ProductLine, foods: readonly Food[], byId: ReadonlyMap<string, Food>, ignored: readonly IgnoredWord[]): PasteItem {
  const word = productWord(product.name);
  const base = { name: product.name, word, count: product.count };
  const empty = { foodId: null, candidateIds: [], amount: 0, note: null, quantity: pickQuantity(product.name, null) };
  if (isIgnored(word, ignored)) return { ...base, ...empty, status: '食材ではない' };

  const match = toMatchForm(product.name);
  // かな1文字だけの一致(「ふんわり」の「ふ」=麩 など)は、ほかの言葉の一部なので数えない
  const spans = findSpans(match, foodTerms(foods)).filter((s) => s.end - s.start > 1 || !/[ァ-ヶー]/.test(match[s.start]));
  const candidateIds = [...new Set(spans.map((s) => s.value.id))];
  if (candidateIds.length === 0) return { ...base, ...empty, status: '読めなかった' };

  // 食材の名前に含まれない「炒め」「詰め」などがあれば、できあいの料理かもしれない
  const prepared = PREPARED_WORDS.some((w) => {
    for (let at = match.indexOf(w); at >= 0; at = match.indexOf(w, at + 1)) {
      if (!spans.some((s) => at >= s.start && at + w.length <= s.end)) return true;
    }
    return false;
  });
  // 1文字だけの一致(米・卵など)は、ほかの言葉の一部のことが多い
  const shortOnly = spans.every((s) => s.end - s.start <= 1);
  const status: PasteStatus = candidateIds.length === 1 && !prepared && !shortOnly ? '読み取った' : '自信がない';

  const food = byId.get(candidateIds[0]) as Food;
  const { amount, note } = purchaseAmount(product, food);
  return { ...base, status, foodId: food.id, candidateIds, amount, note, quantity: pickQuantity(product.name, food) };
}

/**
 * 貼り付けた文字を読む。
 * 「N 点 … 円」の行があればネットスーパーの画面、なければレシートとして商品に分け、食材辞書と照らし合わせる
 */
export function parsePaste(text: string, foods: readonly Food[], ignored: readonly IgnoredWord[]): PasteResult {
  const lines = splitLines(text);
  const netSuper = looksLikeNetSuper(lines);
  const products = netSuper ? parseNetSuperLines(lines) : parseReceiptLines(lines);
  const byId = new Map(foods.map((f) => [f.id, f]));
  return {
    source: netSuper ? 'ネットスーパー' : 'レシート',
    items: products.map((p) => classify(p, foods, byId, ignored)),
  };
}
