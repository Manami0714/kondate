// 商品名の中の量と、別名・読まない言葉にする言葉(純粋関数)
import { findQuantities, type QuantityMatch } from '../textInput/amount';
import { toMatchForm } from '../textInput/normalize';

/** 商品名の量として使う数(単位つき、または「1/4カット」のような1より小さい数) */
export function numberQuantities(name: string): QuantityMatch[] {
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

/** 商品名から ( ) の中を取った言葉(「梨(あきづき)」→「梨」)。辞書とまったく同じかを見るときに使う */
export function withoutParens(word: string): string {
  return word.replace(/[(（][^)）]*[)）]/g, ' ').replace(/\s+/g, ' ').trim();
}
