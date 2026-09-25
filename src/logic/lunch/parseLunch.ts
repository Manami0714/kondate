// 昼食の口頭入力の読み取り(純粋関数)
// 例:「昼に卵2個とキャベツ半分使った」→ 卵2個・キャベツ0.5個
import { LUNCH_FILLER_WORDS, LUNCH_PARTICLES, LUNCH_SEPARATORS } from '../../config/textInput';
import type { Food, Stock } from '../../db/types';
import { roundAmount } from '../stock';
import { findQuantities, toFoodAmount, type AmountNote, type Quantity } from '../textInput/amount';
import { cleanText, toMatchForm } from '../textInput/normalize';
import { findSpans, foodTerms } from '../textInput/spans';

/** 読み取った食材1つ */
export interface LunchItem {
  foodId: string;
  /** 減らす量(辞書の単位) */
  amount: number;
  note: AmountNote | null;
  /** 今の在庫の量(なければ 0) */
  stockAmount: number;
}

/** 食材が見つからなかった言葉(確認画面で食材を選ぶと、その食材の別名になる) */
export interface LunchUnread {
  word: string;
  /** 一緒に言った量(なければ null) */
  quantity: Quantity | null;
}

export interface LunchParse {
  items: LunchItem[];
  unread: LunchUnread[];
}

const FILLERS = [...LUNCH_FILLER_WORDS].sort((a, b) => b.length - a.length);

/** 言葉から、量と前後の助詞を取り除く */
function cleanFragment(fragment: string): { word: string; quantity: Quantity | null } {
  const quantities = findQuantities(toMatchForm(fragment));
  let word = fragment;
  // 後ろから消すと、前の位置がずれない
  for (const q of [...quantities].reverse()) word = word.slice(0, q.start) + ' ' + word.slice(q.end);
  word = word.replace(/\s+/g, ' ').trim();
  const particle = new RegExp(`^[${LUNCH_PARTICLES}\\s]+|[${LUNCH_PARTICLES}\\s]+$`, 'g');
  word = word.replace(particle, '');
  return { word, quantity: quantities[0]?.quantity ?? null };
}

/**
 * 昼食の口頭入力を読む。
 * - 食材の名前・別名を探し、その後ろから次の食材の前までの文字で量を読む
 * - 量がなければふつうの量(注意つき)。同じ食材が2回出たら量を足す
 * - 食材が見つからなかった言葉は unread に入れる
 */
export function parseLunch(text: string, foods: readonly Food[], stocks: readonly Stock[]): LunchParse {
  const clean = cleanText(text);
  const match = toMatchForm(clean);
  const stockOf = (foodId: string) => stocks.find((s) => s.foodId === foodId)?.amount ?? 0;
  const spans = findSpans(match, foodTerms(foods));

  const items: LunchItem[] = [];
  /** 読み取りに使った範囲(読めなかった言葉を探すときに消す) */
  const used: { start: number; end: number }[] = [];
  spans.forEach((span, i) => {
    const segEnd = spans[i + 1]?.start ?? match.length;
    const q = findQuantities(match.slice(span.end, segEnd))[0];
    used.push({ start: span.start, end: q ? span.end + q.end : span.end });
    const food = span.value;
    const stockAmount = stockOf(food.id);
    const { amount, note } = toFoodAmount(q?.quantity ?? null, food, stockAmount);
    const same = items.find((it) => it.foodId === food.id);
    if (same) {
      same.amount = roundAmount(same.amount + amount);
      same.note = same.note ?? note;
    } else {
      items.push({ foodId: food.id, amount, note, stockAmount });
    }
  });

  // 使った範囲と関係ない言葉(「昼に」「あと」など)を空白にして、残りを区切り文字で分ける
  let rest = clean;
  for (const u of [...used].reverse()) rest = rest.slice(0, u.start) + ' ' + rest.slice(u.end);
  for (const f of FILLERS) rest = rest.split(f).join(' ');
  const unread: LunchUnread[] = [];
  for (const fragment of rest.split(LUNCH_SEPARATORS)) {
    const { word, quantity } = cleanFragment(fragment);
    if (word !== '' && !unread.some((u) => u.word === word)) unread.push({ word, quantity });
  }
  return { items, unread };
}
