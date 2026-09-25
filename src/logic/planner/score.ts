// レシピの点数(純粋関数)
// 数値はすべて src/config/scoring.ts にある
import { METHOD_FREQUENCY, SCORE } from '../../config/scoring';
import type { CookingMethod } from '../../data/tags';
import type { DateString, Food, Frequency, Member, PlanConditions, Recipe, RecipeIngredient } from '../../db/types';
import { addDays, diffDays } from '../date';
import { feedbackMatches } from './filter';
import { daysToNearestCooked, methodCount } from './history';
import type { DishUse, SimStock } from './simulate';
import type { HistoryEntry, PlannerData } from './types';

/** 1日分の点数計算に使う状況 */
export interface DayContext {
  date: DateString;
  members: readonly Member[];
  /** 「誰向け」で選んだ人(その日にいなければ null) */
  forMember: Member | null;
  /** この料理を作る前の仮の在庫 */
  stock: SimStock;
  /** 実際の履歴+この献立で先に選んだ料理 */
  history: readonly HistoryEntry[];
}

const FREQUENCY_ORDER: readonly Frequency[] = ['苦手', 'ふつう', '好き'];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 在庫で作れる割合(0〜1)。常備調味料は数えない */
export function stockCoverage(ingredients: readonly RecipeIngredient[], use: DishUse, pantryIds: ReadonlySet<string>): number {
  const counted = ingredients.filter((i) => !pantryIds.has(i.foodId) && i.amount > 0);
  if (counted.length === 0) return 1;
  const sum = counted.reduce((acc, i) => acc + Math.min(1, (use.used.get(i.foodId) ?? 0) / i.amount), 0);
  return sum / counted.length;
}

/** 保存の目安が近い在庫を使う点数 */
function expiryPoints(use: DishUse, stock: SimStock, foodsById: ReadonlyMap<string, Food>, date: DateString): number {
  let points = 0;
  for (const foodId of use.used.keys()) {
    const s = stock.get(foodId);
    const food = foodsById.get(foodId);
    if (!s || !food) continue;
    const daysLeft = diffDays(date, addDays(s.addedDate, food.shelfLifeDays));
    const rule = SCORE.expirySoon.find((r) => daysLeft <= r.withinDays);
    if (rule) points += rule.points;
  }
  return points;
}

/** メンバーの好き・苦手と、家庭全体の苦手な味付け */
function preferencePoints(recipe: Recipe, ctx: DayContext, householdDislikedFlavors: readonly string[]): number {
  const foodIds = recipe.ingredients.map((i) => i.foodId);
  const count = (list: readonly string[], values: readonly string[]) => list.filter((v) => values.includes(v)).length;
  let points = 0;
  for (const m of ctx.members) {
    const weight = ctx.forMember?.id === m.id ? SCORE.forMemberFactor : 1;
    const liked = count(m.likedFoodIds, foodIds) + count(m.likedMethods, recipe.methods) + count(m.likedFlavors, recipe.flavors);
    const disliked =
      count(m.dislikedFoodIds, foodIds) + count(m.dislikedMethods, recipe.methods) + count(m.dislikedFlavors, recipe.flavors);
    points += weight * (liked * SCORE.liked + disliked * SCORE.disliked);
  }
  points += count(householdDislikedFlavors, recipe.flavors) * SCORE.disliked;
  return points;
}

/** 調理法の頻度:家庭の設定をその日のメンバーの好みで1段上げ下げした目標と、最近の実績の差 */
export function methodTargetLevel(method: CookingMethod, base: Frequency, members: readonly Member[]): Frequency {
  const liked = members.some((m) => m.likedMethods.includes(method));
  const disliked = members.some((m) => m.dislikedMethods.includes(method));
  const index = FREQUENCY_ORDER.indexOf(base) + (liked && !disliked ? 1 : 0) - (disliked && !liked ? 1 : 0);
  return FREQUENCY_ORDER[clamp(index, 0, FREQUENCY_ORDER.length - 1)];
}

function methodFrequencyPoints(recipe: Recipe, ctx: DayContext, data: PlannerData, recipesById: ReadonlyMap<string, Recipe>): number {
  let points = 0;
  for (const method of recipe.methods) {
    const level = methodTargetLevel(method, data.household.methodFrequency[method], ctx.members);
    const target = METHOD_FREQUENCY.targets[level];
    const actual = methodCount(method, ctx.history, recipesById, ctx.date, METHOD_FREQUENCY.windowDays);
    // この料理を作った後の回数と目標の差
    const gap = target - (actual + 1);
    points += clamp(gap * METHOD_FREQUENCY.perGap, -METHOD_FREQUENCY.maxAbs, METHOD_FREQUENCY.maxAbs);
  }
  return points;
}

/** レシピ1品の点数(ランダム性を除く) */
export function scoreRecipe(
  recipe: Recipe,
  ingredients: readonly RecipeIngredient[],
  use: DishUse,
  ctx: DayContext,
  data: PlannerData,
  conditions: PlanConditions,
  recipesById: ReadonlyMap<string, Recipe>,
): number {
  let points = 0;
  points += stockCoverage(ingredients, use, data.pantryIds) * SCORE.stockCoverage;
  points += expiryPoints(use, ctx.stock, data.foodsById, ctx.date);
  points += use.shortage.size * SCORE.perShoppingItem;
  points += preferencePoints(recipe, ctx, data.household.dislikedFlavors);
  if (recipe.favorite) points += SCORE.favorite;

  const suggestDislikes = data.feedbacks.filter((f) => f.kind === '提案時の嫌い' && feedbackMatches(f, recipe)).length;
  points += Math.max(suggestDislikes * SCORE.suggestDislike, SCORE.suggestDislikeMin);

  const since = daysToNearestCooked(recipe.id, ctx.history, ctx.date);
  const recent = since === null ? undefined : SCORE.recent.find((r) => since <= r.withinDays);
  if (recent) points += recent.points;

  points += methodFrequencyPoints(recipe, ctx, data, recipesById);

  if (conditions.preset === 'しっかり') {
    points += Math.floor(recipe.minutes / 10) * SCORE.hardyPer10Minutes + (recipe.difficulty - 1) * SCORE.hardyPerDifficulty;
  }
  return points;
}
