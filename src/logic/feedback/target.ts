// 評価の対象の値を作る・読む・表示する(純粋関数)
// 「料理法×味付け」の値は「和え物×胡麻」の形の文字で持つ。作る・分けるのはこのファイルの関数だけで行う
import { COOKING_METHODS, FLAVORS, type CookingMethod, type Flavor } from '../../data/tags';
import type { Feedback, FeedbackKind, FeedbackTargetType, Food, Recipe } from '../../db/types';

const COMBO_SEPARATOR = '×';

/** 料理法と味付けの組み合わせの値を作る(例:「和え物×胡麻」) */
export function comboValue(method: CookingMethod, flavor: Flavor): string {
  return `${method}${COMBO_SEPARATOR}${flavor}`;
}

/** 組み合わせの値を料理法と味付けに分ける。形が違えば null */
export function parseComboValue(value: string): { method: CookingMethod; flavor: Flavor } | null {
  const parts = value.split(COMBO_SEPARATOR);
  if (parts.length !== 2) return null;
  const [method, flavor] = parts;
  if (!(COOKING_METHODS as readonly string[]).includes(method)) return null;
  if (!(FLAVORS as readonly string[]).includes(flavor)) return null;
  return { method: method as CookingMethod, flavor: flavor as Flavor };
}

/** 評価の対象(種類と値)の組 */
export interface FeedbackTarget {
  targetType: FeedbackTargetType;
  targetValue: string;
}

/** 対象の表示名。食材・レシピは名前に直す(辞書やレシピが消えていれば「(消えた食材)」など) */
export function targetLabel(
  target: FeedbackTarget,
  foodsById: ReadonlyMap<string, Food>,
  recipesById: ReadonlyMap<string, Recipe>,
): string {
  switch (target.targetType) {
    case '食材':
      return foodsById.get(target.targetValue)?.name ?? '(消えた食材)';
    case 'レシピ':
      return recipesById.get(target.targetValue)?.name ?? '(消えたレシピ)';
    case '料理法':
      return target.targetValue;
    case '味付け':
      return `${target.targetValue}味`;
    case '料理法×味付け': {
      const combo = parseComboValue(target.targetValue);
      return combo ? `${combo.flavor}味の${combo.method}` : target.targetValue;
    }
  }
}

/** 対象の種類の表示名 */
export const TARGET_TYPE_LABELS: Record<FeedbackTargetType, string> = {
  食材: '食材',
  料理法: '調理法',
  味付け: '味付け',
  '料理法×味付け': '調理法×味付け',
  レシピ: 'レシピ',
};

/** 評価の種類の並び(画面の選択肢の順) */
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ['好き', '提案時の嫌い', '食後の嫌い'];

/** 同じ対象か */
export function sameTarget(a: FeedbackTarget, b: FeedbackTarget): boolean {
  return a.targetType === b.targetType && a.targetValue === b.targetValue;
}

/** 評価を新しい順に並べる */
export function sortFeedbacksNewestFirst(list: readonly Feedback[]): Feedback[] {
  return [...list].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
