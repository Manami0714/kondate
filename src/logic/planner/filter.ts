// 必ず外す条件(純粋関数)
// アレルギー・食後の嫌い・時間と難易度。主な材料のかぶりと買い足し上限は、組み合わせるときに見る
import type { Feedback, Food, Member, PlanConditions, Recipe } from '../../db/types';

/** レシピがその日のメンバーの誰かのアレルギーに当てはまるか(食材そのもの+含まれるアレルギー物質) */
export function hitsAllergy(recipe: Recipe, members: readonly Member[], foodsById: ReadonlyMap<string, Food>): boolean {
  return recipe.ingredients.some((ing) => {
    const food = foodsById.get(ing.foodId);
    return members.some(
      (m) =>
        m.allergyFoodIds.includes(ing.foodId) ||
        (food !== undefined && food.allergens.some((a) => m.allergyAllergens.includes(a))),
    );
  });
}

/** 評価がそのレシピに当てはまるか(レシピ・食材・料理法・味付けのどれか) */
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
  }
}

/** 「食後の嫌い」に当てはまるか */
export function hitsAfterMealDislike(recipe: Recipe, feedbacks: readonly Feedback[]): boolean {
  return feedbacks.some((f) => f.kind === '食後の嫌い' && feedbackMatches(f, recipe));
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
