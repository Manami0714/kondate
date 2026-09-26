// 必ず外す条件(純粋関数)
// アレルギー・食後の嫌い・時間と難易度。主な材料のかぶりと買い足し上限は、組み合わせるときに見る
import type { Feedback, Food, Member, PlanConditions, Recipe } from '../../db/types';
import { parseComboValue } from '../feedback/target';

/** アレルギーに当てはまったメンバーと、当てはまった食材名・アレルギー物質 */
export interface AllergyHit {
  member: Member;
  items: string[];
}

/** レシピが当てはまる、その日のメンバーのアレルギー(食材そのもの+含まれるアレルギー物質) */
export function allergyHits(recipe: Recipe, members: readonly Member[], foodsById: ReadonlyMap<string, Food>): AllergyHit[] {
  return members.flatMap((m) => {
    const items = new Set<string>();
    for (const ing of recipe.ingredients) {
      const food = foodsById.get(ing.foodId);
      if (m.allergyFoodIds.includes(ing.foodId)) items.add(food?.name ?? '(辞書にない食材)');
      for (const a of food?.allergens ?? []) if (m.allergyAllergens.includes(a)) items.add(a);
    }
    return items.size > 0 ? [{ member: m, items: [...items] }] : [];
  });
}

/** レシピがその日のメンバーの誰かのアレルギーに当てはまるか */
export function hitsAllergy(recipe: Recipe, members: readonly Member[], foodsById: ReadonlyMap<string, Food>): boolean {
  return allergyHits(recipe, members, foodsById).length > 0;
}

/** 当てはまる「食後の嫌い」の評価 */
export function afterMealDislikes(recipe: Recipe, feedbacks: readonly Feedback[]): Feedback[] {
  return feedbacks.filter((f) => f.kind === '食後の嫌い' && feedbackMatches(f, recipe));
}

/**
 * 評価がそのレシピに当てはまるか(レシピ・食材・料理法・味付け・料理法×味付けのどれか)
 * 料理法×味付けは、両方のタグを持つレシピだけに当てはまる(和え物×胡麻なら、ほかの和え物・ほかの胡麻味には当てはまらない)
 */
export function feedbackMatches(f: Feedback, recipe: Recipe): boolean {
  switch (f.targetType) {
    case 'レシピ':
      return f.targetValue === recipe.id;
    case '食材':
      return recipe.ingredients.some((i) => i.foodId === f.targetValue);
    case '料理法':
      return (recipe.methods as readonly string[]).includes(f.targetValue);
    case '味付け':
      return (recipe.flavors as readonly string[]).includes(f.targetValue);
    case '料理法×味付け': {
      const combo = parseComboValue(f.targetValue);
      return combo !== null && recipe.methods.includes(combo.method) && recipe.flavors.includes(combo.flavor);
    }
  }
}

/** 「食後の嫌い」に当てはまるか */
export function hitsAfterMealDislike(recipe: Recipe, feedbacks: readonly Feedback[]): boolean {
  return afterMealDislikes(recipe, feedbacks).length > 0;
}

/** 選んだ時間・難易度の条件の中か */
export function withinTime(recipe: Recipe, conditions: PlanConditions): boolean {
  if (conditions.maxMinutes !== null && recipe.minutes > conditions.maxMinutes) return false;
  return recipe.difficulty <= conditions.maxDifficulty;
}

/** その日の候補にしてよいか(必ず外す条件に1つも当てはまらない) */
export function isCandidate(
  recipe: Recipe,
  dayMembers: readonly Member[],
  conditions: PlanConditions,
  feedbacks: readonly Feedback[],
  foodsById: ReadonlyMap<string, Food>,
): boolean {
  return (
    withinTime(recipe, conditions) &&
    !hitsAfterMealDislike(recipe, feedbacks) &&
    !hitsAllergy(recipe, dayMembers, foodsById)
  );
}
