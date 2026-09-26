// 1品だけ入れ替える(純粋関数)
// 今の品と、すでに見せた品を除いた中から、次に点数の高いものを選ぶ(ランダム性なし)
import type { Recipe } from '../../db/types';
import { scaleIngredients } from '../portion';
import { prepareDays } from './context';
import { mainFoodIds } from './mainFoods';
import { scoreRecipe, type DayContext } from './score';
import { applyUse, dishUse, toSimStock } from './simulate';
import { summarizePlan } from './summary';
import { COURSE_SLOTS, type Dishes, type HistoryEntry, type PlannedDay, type PlannerData, type PlanRequest, type PlanResult } from './types';

export function swapDish(
  request: PlanRequest,
  data: PlannerData,
  current: readonly PlannedDay[],
  dayIndex: number,
  key: keyof Dishes,
  /** この枠で、すでに見せた品(今の品も含めてよい) */
  shownIds: readonly string[],
): PlanResult {
  const prepared = prepareDays(request, data);
  if (!prepared.ok) return prepared;
  const day = prepared.days[dayIndex];
  const slot = COURSE_SLOTS.find((s) => s.key === key);
  if (!day || !slot) return { ok: false, error: '入れ替える料理が見つかりません' };

  const recipesById = new Map(data.recipes.map((r) => [r.id, r]));
  const currentId = current[dayIndex][key];

  // 入れ替える品以外の料理をすべて作った後の在庫の見込みと、履歴
  let stock = toSimStock(data.stocks);
  const history: HistoryEntry[] = [...data.history];
  current.forEach((d, i) => {
    const prep = prepared.days[i];
    for (const s of COURSE_SLOTS) {
      if (i === dayIndex && s.key === key) continue;
      const r = recipesById.get(d[s.key]);
      if (!r || !prep) continue;
      stock = applyUse(stock, dishUse(stock, scaleIngredients(r, prep.total), data.pantryIds).used);
      history.push({ date: d.date, recipeId: r.id });
    }
  });

  // 同じ日のほかの2品と主な材料がかぶらないもの
  const otherMains = new Set(
    COURSE_SLOTS.filter((s) => s.key !== key).flatMap((s) => {
      const r = recipesById.get(current[dayIndex][s.key]);
      return r ? mainFoodIds(r, data.foodsById) : [];
    }),
  );
  // 同じ献立セットのほかの枠で使っているレシピ(同じセットの中で同じレシピは出さない)
  // (作り直しでは、同じセットのほかの日のレシピも request.excludeRecipeIds で渡される)
  const usedElsewhere = new Set([
    ...current.flatMap((d, i) => COURSE_SLOTS.filter((s) => !(i === dayIndex && s.key === key)).map((s) => d[s.key])),
    ...(request.excludeRecipeIds ?? []),
  ]);
  const options = day.candidates[slot.course].filter(
    (r) =>
      r.id !== currentId &&
      !usedElsewhere.has(r.id) &&
      !shownIds.includes(r.id) &&
      !mainFoodIds(r, data.foodsById).some((id) => otherMains.has(id)),
  );
  if (options.length === 0) return { ok: false, error: `ほかの${slot.course}の候補がありません` };

  const limit = data.household.shoppingLimitPerMeal;
  const ctx: DayContext = { date: day.date, members: day.members, forMember: day.forMember, stock, history };
  const evaluated = options.map((r: Recipe) => {
    const ingredients = scaleIngredients(r, day.total);
    const score = scoreRecipe(r, ingredients, dishUse(stock, ingredients, data.pantryIds), ctx, data, request.conditions, recipesById);
    const days = current.map((d, i) => (i === dayIndex ? { ...d, [key]: r.id } : d));
    const counts = summarizePlan(days, data).days.map((s) => s.shopping.size);
    return { days, score, counts, within: counts[dayIndex] <= limit };
  });

  const within = evaluated.filter((e) => e.within);
  const best = (within.length > 0 ? within : evaluated).reduce((a, b) => (b.score > a.score ? b : a));
  return { ok: true, days: best.days.map((d, i) => ({ ...d, overLimit: best.counts[i] > limit })) };
}
