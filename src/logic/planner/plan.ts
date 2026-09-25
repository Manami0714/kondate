// 3日分の献立を組む(純粋関数)
// 1日目から主菜→副菜→汁物の順に、条件を満たす中で点数+ランダムの高いものを選ぶ。
// これを何通りも作り、合計点(赤緑黄・使い切り・上限超えを含む)が最も高いものを返す
import { PLAN_EXPLORE_TOP, PLAN_TRIALS, SCORE } from '../../config/scoring';
import type { Recipe } from '../../db/types';
import { scaleIngredients } from '../portion';
import { prepareDays, type PreparedDay } from './context';
import { mainFoodIds } from './mainFoods';
import { isBalanced } from './balance';
import { scoreRecipe, type DayContext } from './score';
import { applyUse, dishUse, toSimStock, type SimStock } from './simulate';
import { COURSE_SLOTS, type Dishes, type HistoryEntry, type PlannedDay, type PlannerData, type PlanRequest, type PlanResult, type Rng } from './types';

interface Trial {
  days: PlannedDay[];
  total: number;
}

/** 使い切りの点数:最初に在庫にあって献立で使った食材が、使い切るかほぼ残らないなら加点 */
export function useUpPoints(initial: SimStock, final: SimStock, data: PlannerData): number {
  let points = 0;
  for (const [foodId, before] of initial) {
    const after = final.get(foodId)?.amount ?? 0;
    if (after >= before.amount) continue; // 使っていない
    const usual = data.foodsById.get(foodId)?.usualAmount ?? 0;
    if (after === 0 || after < usual * SCORE.useUpRatio) points += SCORE.useUpPoints;
  }
  return points;
}

interface DayState {
  stock: SimStock;
  history: HistoryEntry[];
  /** この献立セットで、すでに選んだレシピ(同じセットの中で同じレシピは出さない) */
  usedRecipeIds: ReadonlySet<string>;
}

interface BuiltDay extends DayState {
  dishes: Dishes;
  score: number;
  /** その日の買い足しの品数 */
  shopCount: number;
}

/**
 * 1日分の3品を選ぶ。enforceLimit が true なら、買い足しの上限を守れる候補だけから選ぶ(守れる候補がない枠は全候補から)。
 * explore が true なら、点数の上位 PLAN_EXPLORE_TOP 件の中からランダムに選ぶ(false なら最も高いもの)。
 * 主な材料がかぶらない組み合わせが作れなければ null
 */
function buildDay(
  day: PreparedDay,
  start: DayState,
  enforceLimit: boolean,
  explore: boolean,
  request: PlanRequest,
  data: PlannerData,
  recipesById: ReadonlyMap<string, Recipe>,
  rng: Rng,
): BuiltDay | null {
  const limit = data.household.shoppingLimitPerMeal;
  let { stock, history } = start;
  const usedRecipeIds = new Set(start.usedRecipeIds);
  const chosen: Recipe[] = [];
  const usedMains = new Set<string>();
  const shopFoods = new Set<string>();
  const ids: Partial<Dishes> = {};
  let score = 0;

  for (const slot of COURSE_SLOTS) {
    const ctx: DayContext = { date: day.date, members: day.members, forMember: day.forMember, stock, history };
    const options = day.candidates[slot.course]
      .filter((r) => !usedRecipeIds.has(r.id) && !mainFoodIds(r, data.foodsById).some((id) => usedMains.has(id)))
      .map((r) => {
        const ingredients = scaleIngredients(r, day.total);
        const use = dishUse(stock, ingredients, data.pantryIds);
        const points = scoreRecipe(r, ingredients, use, ctx, data, request.conditions, recipesById) + rng() * SCORE.random;
        const shopCount = new Set([...shopFoods, ...use.shortage.keys()]).size;
        return { r, use, points, within: shopCount <= limit };
      });
    if (options.length === 0) return null;
    const within = enforceLimit ? options.filter((o) => o.within) : [];
    const ranked = [...(within.length > 0 ? within : options)].sort((a, b) => b.points - a.points);
    const best = explore ? ranked[Math.floor(rng() * Math.min(PLAN_EXPLORE_TOP, ranked.length))] : ranked[0];

    ids[slot.key] = best.r.id;
    chosen.push(best.r);
    score += best.points;
    stock = applyUse(stock, best.use.used);
    for (const id of best.use.shortage.keys()) shopFoods.add(id);
    for (const id of mainFoodIds(best.r, data.foodsById)) usedMains.add(id);
    usedRecipeIds.add(best.r.id);
    history = [...history, { date: day.date, recipeId: best.r.id }];
  }

  if (isBalanced(chosen, data.foodsById)) score += SCORE.balancedMeal;
  const dishes: Dishes = { mainId: ids.mainId ?? '', sideId: ids.sideId ?? '', soupId: ids.soupId ?? '' };
  return { dishes, score, shopCount: shopFoods.size, stock, history, usedRecipeIds };
}

/** 1通りの献立を作る。主な材料がかぶらない組み合わせが作れなければ null */
function buildTrial(
  prepared: readonly PreparedDay[],
  request: PlanRequest,
  data: PlannerData,
  recipesById: ReadonlyMap<string, Recipe>,
  rng: Rng,
  explore: boolean,
): Trial | null {
  const initial = toSimStock(data.stocks);
  const limit = data.household.shoppingLimitPerMeal;
  let state: DayState = { stock: initial, history: [...data.history], usedRecipeIds: new Set() };
  let total = 0;
  const days: PlannedDay[] = [];

  for (const day of prepared) {
    let built = buildDay(day, state, true, explore, request, data, recipesById, rng);
    if (!built) return null;
    // 上限を守れない日は、上限を緩めて点数だけで選び直す(無理に上限に合わせて同じ料理が続くのを避ける)
    const overLimit = built.shopCount > limit;
    if (overLimit) built = buildDay(day, state, false, explore, request, data, recipesById, rng) ?? built;

    total += built.score - (overLimit ? SCORE.overLimitPenalty : 0);
    state = { stock: built.stock, history: built.history, usedRecipeIds: built.usedRecipeIds };
    days.push({ date: day.date, memberIds: day.memberIds, ...built.dishes, overLimit });
  }

  total += useUpPoints(initial, state.stock, data);
  return { days, total };
}

/** 3日分の献立を作る */
export function makePlan(request: PlanRequest, data: PlannerData, rng: Rng): PlanResult {
  const prepared = prepareDays(request, data);
  if (!prepared.ok) return prepared;
  const recipesById = new Map(data.recipes.map((r) => [r.id, r]));

  let best: Trial | null = null;
  for (let t = 0; t < PLAN_TRIALS; t++) {
    // 1通り目は点数の高い順にそのまま選び、2通り目以降はいろいろな組み合わせを試す
    const trial = buildTrial(prepared.days, request, data, recipesById, rng, t > 0);
    if (trial && (best === null || trial.total > best.total)) best = trial;
  }
  if (!best) {
    return { ok: false, error: '同じ料理を2回使わず、主な材料もかぶらない組み合わせが見つかりません。レシピを増やすか、条件を緩めてください' };
  }
  return { ok: true, days: best.days };
}
