// 構造化データがないページの文字から、料理名・材料・時間・人数を読む(予備の読み取り。純粋関数)
import {
  PAGE_INGREDIENTS_HEADING,
  PAGE_SKIP_LINES,
  PAGE_STEPS_HEADING,
  TITLE_DECORATIONS,
} from '../../config/recipeImport';
import { cleanText } from '../textInput/normalize';
import { parseMinutes } from './duration';
import { splitIngredientLine } from './ingredientLine';
import { startsWithAmount } from './recipeAmount';
import { parseServings } from './servings';
import type { ImportedPage } from './types';

/** ページの題名から、サイト名などの飾りを取って料理名にする */
export function titleToName(title: string): string {
  const clean = cleanText(title);
  let name = clean;
  for (const re of TITLE_DECORATIONS) name = name.replace(re, '').trim();
  return name === '' ? clean : name;
}

const SERVINGS_IN_TEXT = /(\d+(?:\s*[〜~-]\s*\d+)?\s*人(?:分|前))/;

/**
 * 材料の範囲の行を、材料1つずつの行にする。
 * 名前と量が別の行に分かれている形(「豚こま切れ肉」の次の行に「200g」)は1行にまとめる
 */
export function joinIngredientLines(lines: readonly string[]): string[] {
  const result: string[] = [];
  let pending: string | null = null;
  for (const line of lines) {
    if (PAGE_SKIP_LINES.some((re) => re.test(line))) continue;
    if (startsWithAmount(line)) {
      // 量だけの行:前の名前の行とつなげる
      if (pending !== null) result.push(`${pending} ${line}`);
      pending = null;
      continue;
    }
    if (pending !== null) result.push(pending);
    pending = null;
    const split = splitIngredientLine(line);
    if (split === null) continue;
    if (split.amountText !== '') result.push(line);
    else pending = line;
  }
  if (pending !== null) result.push(pending);
  return result;
}

/** ページの文字から読む */
export function parsePageText(input: { title: string | null; text: string; url: string | null }): ImportedPage {
  const lines = input.text
    .split(/\r?\n/)
    .map(cleanText)
    .filter((l) => l !== '');
  const start = lines.findIndex((l) => PAGE_INGREDIENTS_HEADING.test(l));
  let ingredientLines: string[] = [];
  let servings: number | null = null;
  if (start >= 0) {
    const endAt = lines.findIndex((l, i) => i > start && PAGE_STEPS_HEADING.test(l));
    const headingServings = SERVINGS_IN_TEXT.exec(lines[start]);
    if (headingServings) servings = parseServings(headingServings[1]);
    const body = lines.slice(start + 1, endAt < 0 ? undefined : endAt);
    // 見出しの次の行が「(2人分)」だけのこともある
    if (servings === null && body.length > 0) {
      const first = SERVINGS_IN_TEXT.exec(body[0]);
      if (first) servings = parseServings(first[1]);
    }
    ingredientLines = joinIngredientLines(body);
  }
  if (servings === null) {
    const any = lines.map((l) => SERVINGS_IN_TEXT.exec(l)).find((m) => m !== null);
    if (any) servings = parseServings(any[1]);
  }
  return {
    from: 'ページの文字',
    url: input.url,
    // 題名がなければ料理名はわからないので空にする(確認画面で入れてもらう)
    name: input.title ? titleToName(input.title) : '',
    ingredientLines,
    minutes: findMinutes(lines),
    servings,
  };
}

const TIME_LABEL = /調理時間|所要時間|目安時間/;

/** 「調理時間」の行(またはその次の行)から時間を読む */
function findMinutes(lines: readonly string[]): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!TIME_LABEL.test(lines[i])) continue;
    const here = parseMinutes(lines[i].replace(/.*(調理時間|所要時間|目安時間)/, ''));
    if (here !== null) return here;
    const next = i + 1 < lines.length ? parseMinutes(lines[i + 1]) : null;
    if (next !== null) return next;
  }
  return null;
}
