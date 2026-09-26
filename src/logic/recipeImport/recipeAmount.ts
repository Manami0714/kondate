// レシピの材料の量の読み取りと、辞書の単位への換算(純粋関数)
import {
  PACKAGE_UNITS,
  PREFIX_UNIT_WORDS,
  SUFFIX_UNIT_WORDS,
  VAGUE_AMOUNT_WORDS,
  VOLUME_ML,
} from '../../config/recipeImport';
import { COUNT_UNITS, GENERIC_COUNT_UNIT, HALF_RATIO } from '../../config/textInput';
import type { Food } from '../../db/types';
import { roundAmount } from '../stock';
import { cleanText, toMatchForm } from '../textInput/normalize';
import type { ImportAmountNote } from './types';

/** 読み取った量 */
export type RecipeQuantity =
  /** 数。unit は辞書での書き方にそろえた単位(大さじ・小さじ・カップ・g・ml・個…。なければ null) */
  | { kind: 'number'; value: number; unit: string | null }
  /** 少々・適量など。小さじ何杯分とみなすか */
  | { kind: 'vague'; teaspoons: number };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternation = (words: readonly string[]) => [...words].sort((a, b) => b.length - a.length).map(escape).join('|');

// 数:1、1.5、1/2、1と1/2、1・1/2、1 1/2。後ろに「〜2」のような幅がついてもよい(短い方を使う)
const NUMBER = '(\\d+(?:\\.\\d+)?(?:\\/\\d+)?)(?:\\s*[ト・]?\\s*(\\d+\\/\\d+))?(?:\\s*[〜~\\-ー]\\s*\\d+(?:\\.\\d+)?(?:\\/\\d+)?)?';
// 「大1」「小1/2」は大さじ・小さじの略として読む(数字がすぐ後に続くときだけ)
const PREFIX_RE = new RegExp(`(${alternation(PREFIX_UNIT_WORDS.map((u) => u.word))}|大(?=\\d)|小(?=\\d))\\s*${NUMBER}`);
const SUFFIX_RE = new RegExp(`${NUMBER}\\s*(${alternation(SUFFIX_UNIT_WORDS.map((u) => u.word))})?(半)?`);
const VAGUE = [...VAGUE_AMOUNT_WORDS].sort((a, b) => b.word.length - a.word.length);

function toNumber(text: string | undefined): number {
  if (!text) return 0;
  const frac = /^(\d+)\/(\d+)$/.exec(text);
  if (frac) return Number(frac[2]) === 0 ? 0 : Number(frac[1]) / Number(frac[2]);
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

// 「ひとかけ」「ふたつ」の「ひと」「ふた」(比べる形)。「ひとつまみ」は少々として読むので除く
const KANA_ONE = /ヒト(?=カケ|ツ(?!マミ)|切レ|房|束|株|玉|片)/g;
const KANA_TWO = /フタ(?=カケ|ツ|切レ|房|束|株|玉|片)/g;

/** 量の文字を比べる形にする(「½」は「1/2」、「ひとかけ」は「1カケ」にする) */
export function toAmountMatchForm(text: string): string {
  return toMatchForm(cleanText(text).replace(/⁄/g, '/'))
    .replace(KANA_ONE, '1')
    .replace(KANA_TWO, '2');
}

/** ( ) を取った部分と、( ) の中の部分 */
function splitParens(text: string): { outside: string; inside: string } {
  const inside = [...text.matchAll(/[(（]([^)）]*)[)）]/g)].map((m) => m[1]).join(' ');
  return { outside: text.replace(/[(（][^)）]*[)）]/g, ' '), inside };
}

function readPart(m: string): RecipeQuantity | null {
  const prefix = PREFIX_RE.exec(m);
  if (prefix) {
    const unitWord = PREFIX_UNIT_WORDS.find((u) => u.word === prefix[1]);
    const unit = unitWord?.unit ?? (prefix[1] === '大' ? '大さじ' : '小さじ');
    const value = toNumber(prefix[2]) + toNumber(prefix[3]);
    if (value > 0) return { kind: 'number', value: roundAmount(value), unit };
  }
  const suffix = SUFFIX_RE.exec(m);
  if (suffix) {
    const unitWord = suffix[3] ? SUFFIX_UNIT_WORDS.find((u) => u.word === suffix[3]) : undefined;
    const value = (toNumber(suffix[1]) + toNumber(suffix[2]) + (suffix[4] ? HALF_RATIO : 0)) * (unitWord?.factor ?? 1);
    if (value > 0) return { kind: 'number', value: roundAmount(value), unit: unitWord?.unit ?? null };
  }
  if (/半分/.test(m)) return { kind: 'number', value: HALF_RATIO, unit: null };
  const vague = VAGUE.find((v) => m.includes(v.word));
  if (vague) return { kind: 'vague', teaspoons: vague.teaspoons };
  return null;
}

/**
 * 量の文字を読む。読めなければ null。
 * 例:「200g」「大さじ1と1/2」「小さじ1/2」「1/4個」「1片」「カップ1」「少々」「適量」「各大さじ1」
 * ( ) の外を先に読み、読めなければ ( ) の中を読む(「1パック(200g)」はパック、「(200g)」は g)
 */
export function parseRecipeAmount(text: string): RecipeQuantity | null {
  return parseRecipeAmountCandidates(text)[0] ?? null;
}

/**
 * 量の候補:( ) の外で読めた量と、( ) の中で読めた量(この順)。
 * 「鶏むね肉 1枚(300g)」は、辞書の単位が g なら中の 300g を使えるように、両方を返す
 */
export function parseRecipeAmountCandidates(text: string): RecipeQuantity[] {
  const m = toAmountMatchForm(text).replace(/各/g, '');
  const { outside, inside } = splitParens(m);
  return [readPart(outside), inside !== '' ? readPart(inside) : null].filter((q): q is RecipeQuantity => q !== null);
}

const START_RE = new RegExp(
  `^(?:(?:${alternation(PREFIX_UNIT_WORDS.map((u) => u.word))}|大|小)\\s*\\d|\\d|半分|${alternation(VAGUE_AMOUNT_WORDS.map((v) => v.word))})`,
);

/**
 * 量の書き始めで始まり、量として読めるか(材料名と量を分けるときに使う)。
 * 前の「(」「各」「約」は飛ばす。「お好み焼き粉」のように途中に量の言葉があるだけのものは量としない
 */
export function startsWithAmount(text: string): boolean {
  const m = toAmountMatchForm(text).replace(/^[\s((]*(?:各|約)?\s*/, '');
  return START_RE.test(m) && parseRecipeAmount(text) !== null;
}

const isCountUnit = (unit: string) => COUNT_UNITS.includes(unit) || unit === 'かけ';

/** ml の量を、かさの単位・g(調味料だけ、1ml≒1g とみなす)に換算する。できなければ null */
function fromMl(ml: number, food: Food): number | null {
  const per = VOLUME_ML[food.unit];
  if (per !== undefined) return ml / per;
  if (food.unit === 'g' && food.kind === '調味料') return ml;
  return null;
}

/**
 * 読み取った量を、辞書の単位での量にする。決められなければ amount は null(確認画面で入れてもらう)
 * - 量がない・少々・適量:かさの単位や g の材料は「小さじ何杯分」を換算した量(注意つき)。数える単位の材料は null
 * - 単位がない・辞書と同じ:そのまま。「個」はどの数える単位にも合わせる。「片」と「かけ」は同じ
 * - 大さじ・小さじ・カップ・ml どうし:換算する。調味料の g とも 1ml≒1g で換算する(注意つき)
 * - g で書かれていて、辞書に1単位あたりの重さがある:換算する(注意つき)
 * - パック・袋・缶で辞書と違う:ふつうの量×数(注意つき)
 * - それ以外で辞書と違う:null(注意つき)
 */
export function toRecipeFoodAmount(
  quantity: RecipeQuantity | null,
  food: Food,
): { amount: number | null; note: ImportAmountNote | null } {
  const result = (amount: number | null, note: ImportAmountNote | null) => ({
    amount: amount === null ? null : roundAmount(amount),
    note,
  });
  if (quantity === null || quantity.kind === 'vague') {
    const teaspoons = quantity?.teaspoons ?? VAGUE_AMOUNT_WORDS.find((v) => v.word === '適量')?.teaspoons ?? 1;
    if (isCountUnit(food.unit)) return result(null, 'not-number');
    return result(fromMl(teaspoons * (VOLUME_ML['小さじ'] ?? 5), food), 'not-number');
  }
  const { value, unit } = quantity;
  if (unit === null || unit === food.unit) return result(value, null);
  if (unit === GENERIC_COUNT_UNIT && isCountUnit(food.unit)) return result(value, null);
  const ml = VOLUME_ML[unit];
  if (ml !== undefined) {
    const converted = fromMl(value * ml, food);
    return converted === null ? result(null, 'unit-mismatch') : result(converted, 'converted');
  }
  if (unit === 'g') {
    if (food.kind === '調味料' && VOLUME_ML[food.unit] !== undefined) return result(value / VOLUME_ML[food.unit], 'converted');
    if (food.gramsPerUnit !== null && food.gramsPerUnit > 0) return result(value / food.gramsPerUnit, 'converted');
  }
  if (PACKAGE_UNITS.includes(unit)) return result(food.usualAmount * value, 'unit-mismatch');
  return result(null, 'unit-mismatch');
}
