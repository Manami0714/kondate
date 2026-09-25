// 量の読み取りと、辞書の単位への換算(純粋関数)
import {
  AMOUNT_WORDS,
  COUNT_UNITS,
  GENERIC_COUNT_UNIT,
  HALF_RATIO,
  LITTLE_RATIO,
  NUMBER_WORDS,
  UNIT_WORDS,
} from '../../config/textInput';
import type { Food } from '../../db/types';
import { roundAmount } from '../stock';

/** 読み取った量 */
export type Quantity =
  /** 数。unit は辞書の単位の書き方にそろえたもの(単位がなければ null) */
  | { kind: 'number'; value: number; unit: string | null }
  | { kind: 'half' }
  | { kind: 'little' }
  | { kind: 'all' };

/** 読み取った位置つきの量 */
export interface QuantityMatch {
  quantity: Quantity;
  start: number;
  end: number;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byLength = <T extends { word: string }>(list: readonly T[]) => [...list].sort((a, b) => b.word.length - a.word.length);

const UNITS = byLength(UNIT_WORDS);
const NUMBERS = byLength(NUMBER_WORDS);
const WORDS = byLength(AMOUNT_WORDS);

// 数(1、1.5、1/4、漢数字、ひとつ…)+ 単位(なくてもよい)+「半」(1個半)+「×2」
const NUMBER_PART = `(\\d+(?:\\.\\d+)?(?:\\/\\d+)?|${NUMBERS.map((n) => escape(n.word)).join('|')})`;
const UNIT_PART = `(${UNITS.map((u) => escape(u.word)).join('|')})?`;
const QUANTITY_RE = new RegExp(`${NUMBER_PART}\\s*${UNIT_PART}(半)?(?:\\s*[×x*]\\s*(\\d+))?`, 'g');
const WORD_RE = new RegExp(WORDS.map((w) => escape(w.word)).join('|'), 'g');

function toNumber(text: string): number | null {
  const word = NUMBERS.find((n) => n.word === text);
  if (word) return word.value;
  const frac = /^(\d+)\/(\d+)$/.exec(text);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * 比べる形の文(toMatchForm 済み)から、量の書き方をすべて探す(前から順)。
 * 例:「2個」「300g」「5kg」「200g×2」「1/4」「1個半」「半分」「少し」「全部」
 */
export function findQuantities(matchText: string): QuantityMatch[] {
  const found: QuantityMatch[] = [];
  for (const m of matchText.matchAll(QUANTITY_RE)) {
    const base = toNumber(m[1]);
    if (base === null) continue;
    const unitWord = m[2] ? UNITS.find((u) => u.word === m[2]) : undefined;
    const value = (base + (m[3] ? HALF_RATIO : 0)) * (unitWord?.factor ?? 1) * (m[4] ? Number(m[4]) : 1);
    found.push({
      quantity: { kind: 'number', value: roundAmount(value), unit: unitWord?.unit ?? null },
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  for (const m of matchText.matchAll(WORD_RE)) {
    // 「1個半」の「半」は数の方で読んでいる
    if (found.some((f) => m.index >= f.start && m.index < f.end)) continue;
    const word = WORDS.find((w) => w.word === m[0]);
    if (word) found.push({ quantity: { kind: word.kind }, start: m.index, end: m.index + m[0].length });
  }
  return found.sort((a, b) => a.start - b.start);
}

/** 最初に出てくる量。なければ null */
export function readQuantity(matchText: string): Quantity | null {
  return findQuantities(matchText)[0]?.quantity ?? null;
}

/** 量の注意:量が読めなかった/単位が辞書と違ったので「ふつうの量」を使った */
export type AmountNote = 'no-amount' | 'unit-mismatch';

export const AMOUNT_NOTE_LABELS: Record<AmountNote, string> = {
  'no-amount': '量が読めなかったので、ふつうの量にしました',
  'unit-mismatch': '単位が辞書と違うので、ふつうの量にしました',
};

/**
 * 読み取った量を、辞書の単位での量にする。
 * - 量がない → ふつうの量(注意つき)
 * - 単位が辞書と同じ・単位がない → そのまま。「個」はどの数える単位にも合わせる(大根2個=2本)
 * - 数える単位で辞書と違う(豚こま1パック、辞書は g)→ ふつうの量×数(注意つき)
 * - 重さ・かさで辞書と違う(人参 500g、辞書は本)→ ふつうの量(注意つき)
 * - 半分:数える単位は1つの半分、それ以外は今の在庫の半分(在庫がなければふつうの量の半分)
 * - 少し:ふつうの量の1割
 * - 全部:今の在庫(在庫がなければふつうの量)
 */
export function toFoodAmount(
  quantity: Quantity | null,
  food: Food,
  stockAmount: number,
): { amount: number; note: AmountNote | null } {
  const isCountUnit = COUNT_UNITS.includes(food.unit);
  const result = (amount: number, note: AmountNote | null = null) => ({ amount: roundAmount(amount), note });
  if (quantity === null) return result(food.usualAmount, 'no-amount');
  switch (quantity.kind) {
    case 'half':
      if (isCountUnit) return result(HALF_RATIO);
      return result((stockAmount > 0 ? stockAmount : food.usualAmount) * HALF_RATIO);
    case 'little':
      return result(food.usualAmount * LITTLE_RATIO);
    case 'all':
      return result(stockAmount > 0 ? stockAmount : food.usualAmount);
    case 'number': {
      const { value, unit } = quantity;
      if (unit === null || unit === food.unit) return result(value);
      if (unit === GENERIC_COUNT_UNIT && isCountUnit) return result(value);
      if (COUNT_UNITS.includes(unit)) return result(food.usualAmount * value, 'unit-mismatch');
      return result(food.usualAmount, 'unit-mismatch');
    }
  }
}
