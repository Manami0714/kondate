// レシピの材料を食材辞書と照らし合わせる(純粋関数)
import { NOT_INGREDIENT_WORDS } from '../../config/recipeImport';
import type { Food } from '../../db/types';
import { findFoodByExactName, normalizeForSearch } from '../foodSearch';
import { findSpans, foodTerms } from '../textInput/spans';
import { splitIngredientLine } from './ingredientLine';
import { parseRecipeAmountCandidates, toRecipeFoodAmount } from './recipeAmount';
import type { ImportAmountNote, ImportIngredient } from './types';

const NOT_INGREDIENT_KEYS = new Set(NOT_INGREDIENT_WORDS.map(normalizeForSearch));

/** 最初から「材料に入れない」にする材料か(水・お湯など) */
export function isNotIngredient(name: string): boolean {
  return NOT_INGREDIENT_KEYS.has(normalizeForSearch(name));
}

/**
 * 材料の量の文字を、その食材の辞書の単位での量にする。
 * ( ) の外と中の量のうち、辞書の単位にそのまま合うものを優先する(「1枚(300g)」で辞書が g なら 300g)
 */
export function ingredientAmount(amountText: string, food: Food): { amount: number | null; note: ImportAmountNote | null } {
  const candidates = amountText.trim() === '' ? [] : parseRecipeAmountCandidates(amountText);
  if (candidates.length === 0) return toRecipeFoodAmount(null, food);
  const results = candidates.map((q) => toRecipeFoodAmount(q, food));
  return results.find((r) => r.amount !== null && r.note !== 'unit-mismatch') ?? results[0];
}

/**
 * 材料1行を読む。見出しの行は null。
 * - 材料に入れない:水・お湯など(固定の一覧と完全に同じ名前)
 * - 読み取った:材料名が辞書の名前・別名とまったく同じ(確認画面で選び直すと別名になり、次からここに入る)
 * - 自信がない:材料名の一部だけが辞書と合った(「豚こま切れ肉」の「豚こま切れ」、「塩こしょう」の「塩」と「こしょう」)
 * - 読めなかった:辞書の食材が見つからない
 */
export function readIngredientLine(line: string, foods: readonly Food[]): ImportIngredient | null {
  const split = splitIngredientLine(line);
  if (split === null || split.name === '') return null;
  const base = { line: line.trim(), name: split.name, amountText: split.amountText };
  const empty = { foodId: null, candidateIds: [], amount: null, note: null };
  if (isNotIngredient(split.name)) return { ...base, ...empty, status: '材料に入れない' };

  const exact = findFoodByExactName(foods, split.name);
  const text = normalizeForSearch(split.name);
  // かな1文字だけの一致(「ふ」=麩 など)は、ほかの言葉の一部なので数えない
  const spans = findSpans(text, foodTerms(foods)).filter((s) => s.end - s.start > 1 || !/[ァ-ヶー]/.test(text[s.start]));
  const candidateIds = [...new Set([...(exact ? [exact.id] : []), ...spans.map((s) => s.value.id)])];
  if (candidateIds.length === 0) return { ...base, ...empty, status: '読めなかった' };

  const food = exact ?? (foods.find((f) => f.id === candidateIds[0]) as Food);
  return {
    ...base,
    status: exact ? '読み取った' : '自信がない',
    foodId: food.id,
    candidateIds,
    ...ingredientAmount(split.amountText, food),
  };
}

/** 材料の行をすべて読む(見出しの行は捨てる) */
export function readIngredients(lines: readonly string[], foods: readonly Food[]): ImportIngredient[] {
  return lines.map((l) => readIngredientLine(l, foods)).filter((i): i is ImportIngredient => i !== null);
}
