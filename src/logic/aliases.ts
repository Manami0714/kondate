// 確認画面で直した言葉を、食材の別名として覚える(純粋関数)
import type { Food } from '../db/types';
import { findFoodByExactName, normalizeForSearch } from './foodSearch';

/**
 * 食材に別名を足した新しい食材を返す。
 * 空の言葉や、すでにどれかの食材の名前・別名になっている言葉(この食材自身も含む)なら null(足さない)
 */
export function withAlias(food: Food, word: string, foods: readonly Food[]): Food | null {
  const alias = word.trim();
  if (normalizeForSearch(alias) === '') return null;
  if (findFoodByExactName([food, ...foods], alias)) return null;
  return { ...food, aliases: [...food.aliases, alias] };
}

/**
 * 食材から、その言葉とまったく同じ別名を外した新しい食材を返す(ひらがな・カタカナ・半角の違いは同じとみなす)。
 * 外す別名がなければ null。食材名そのものは外さない
 */
export function withoutAlias(food: Food, word: string): Food | null {
  const key = normalizeForSearch(word);
  if (key === '') return null;
  const aliases = food.aliases.filter((a) => normalizeForSearch(a) !== key);
  return aliases.length === food.aliases.length ? null : { ...food, aliases };
}
