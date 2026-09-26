// 材料の1行を、材料名と量に分ける(純粋関数)
import { GROUP_LABEL, GROUP_LETTER, INGREDIENT_MARKS } from '../../config/recipeImport';
import { withoutParens } from '../receipt/productWord';
import { cleanText } from '../textInput/normalize';
import { startsWithAmount } from './recipeAmount';

/** 分けた結果。見出しの行(「<合わせ調味料>」など)は null */
export interface SplitLine {
  /** 材料名(印・見出し・( ) の注記を取ったもの) */
  name: string;
  /** 量の部分。書いていなければ空 */
  amountText: string;
}

/** 行の頭の印とまとまりの見出し(「●」「(A)」「【タレ】」「A 」)を取る */
export function stripMarks(text: string): string {
  let t = cleanText(text);
  for (;;) {
    const next = t.replace(INGREDIENT_MARKS, '').replace(GROUP_LABEL, '').replace(GROUP_LETTER, '').trim();
    if (next === t) return t;
    t = next;
  }
}

/** 見出しだけの行か(「<A>」「【合わせ調味料】」「A」「タレ:」) */
function isHeading(clean: string): boolean {
  const t = clean.replace(INGREDIENT_MARKS, '').trim();
  if (t === '') return true;
  if (GROUP_LABEL.test(t) && t.replace(GROUP_LABEL, '').trim() === '') return true;
  if (/^[A-Za-zＡ-Ｚａ-ｚ]$/.test(t)) return true;
  return /[::]$/.test(t);
}

/** 材料名を整える:( ) の注記を取り、後ろの記号を取る */
export function cleanIngredientName(name: string): string {
  return withoutParens(name)
    .replace(/[\s::…・、,((]+$/, '')
    .trim();
}

/**
 * 1行を材料名と量に分ける。
 * - 空白で区切られた最後のまとまりが量として読めれば、そこを量にする(「豚こま切れ肉 200g」「醤油 大さじ1と1/2」)
 * - 空白がなければ、量の書き始め(数字・大さじ・少々など)を前から探す(「醤油大さじ2」「塩少々」)
 * - 量がなければ、行全体を材料名にする
 */
export function splitIngredientLine(line: string): SplitLine | null {
  const clean = cleanText(line);
  if (isHeading(clean)) return null;
  const body = stripMarks(clean);
  if (body === '') return null;

  // 空白で区切る:前から順に、残りが量の書き始めで始まる区切りを探す(「大さじ 1」のように量の中に空白があってもよい)
  const parts = body.split(' ');
  for (let i = 1; i < parts.length; i++) {
    const amountText = parts.slice(i).join(' ');
    const name = parts.slice(0, i).join(' ');
    if (startsWithAmount(amountText)) {
      return { name: cleanIngredientName(name), amountText };
    }
  }
  // 空白なし:量の書き始めを探す(材料名は1文字以上)
  const start = findAmountStart(body);
  if (start !== null) return { name: cleanIngredientName(body.slice(0, start)), amountText: body.slice(start).trim() };
  return { name: cleanIngredientName(body), amountText: '' };
}

// 量の書き始めになる文字:数字・分数・大さじ・小さじ・カップ・少々などの言葉
const AMOUNT_START = /[0-9½¼¾⅓⅔]|大さじ|小さじ|大匙|小匙|カップ|少々|少量|適量|適宜|ひとつまみ|お好み|好みで|大(?=\d)|小(?=\d)/g;

function findAmountStart(text: string): number | null {
  for (const m of text.matchAll(AMOUNT_START)) {
    if (m.index === 0) continue;
    const rest = text.slice(m.index);
    const name = text.slice(0, m.index).replace(/[((]$/, '');
    if (name.trim() === '') continue;
    // ( ) の中の数字(「玉ねぎ(中)1個」はよいが、「卵(Mサイズ)」の中は量にしない)
    const open = (name.match(/[((]/g) ?? []).length;
    const close = (name.match(/[))]/g) ?? []).length;
    if (open > close) continue;
    if (startsWithAmount(rest)) return m.index;
  }
  return null;
}
