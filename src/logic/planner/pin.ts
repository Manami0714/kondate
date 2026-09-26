// 提案の画面で、1つの枠に料理を指定する(純粋関数)
// その枠だけを指定の料理にし、ぶつかる品(同じ日で主な材料がかぶる品と、ほかの枠で同じレシピを使っている品)だけを選び直す。
// 指定した品どうしがぶつかるときは選び直さない(注意を出すだけ)
import { prepareDays } from './context';
import { fixedRecipeId } from './fixed';
import { mainFoodIds } from './mainFoods';
import { summarizePlan } from './summary';
import { swapDish } from './swap';
import { COURSE_SLOTS, type Dishes, type PlannedDay, type PlannerData, type PlanRequest, type PlanResult } from './types';

/**
 * request.fixed には、今回の指定(dayIndex の key の枠)をすでに入れておく。
 * 選び直せない品があれば、指定を入れずに ok: false を返す
 */
export function pinDish(
  request: PlanRequest,
  data: PlannerData,
  current: readonly PlannedDay[],
  dayIndex: number,
  key: keyof Dishes,
): PlanResult {
  const prepared = prepareDays(request, data);
  if (!prepared.ok) return prepared;
  const slot = COURSE_SLOTS.find((s) => s.key === key);
  const pinned = slot ? prepared.days[dayIndex]?.fixed[slot.course] : undefined;
  if (!slot || !pinned) return { ok: false, error: '指定した料理が見つかりません' };

  const fixed = request.fixed ?? [];
  const isFixed = (i: number, k: keyof Dishes) => {
    const s = COURSE_SLOTS.find((c) => c.key === k);
    return s !== undefined && fixedRecipeId(fixed, i, s.course) !== null;
  };
  const recipesById = new Map(data.recipes.map((r) => [r.id, r]));
  const pinnedMains = new Set(mainFoodIds(pinned, data.foodsById));

  let days: PlannedDay[] = current.map((d, i) => (i === dayIndex ? { ...d, [key]: pinned.id } : { ...d }));

  // 選び直す枠:指定していない枠のうち、同じ日で主な材料がかぶる品と、同じレシピを使っている品
  const conflicts = days.flatMap((d, i) =>
    COURSE_SLOTS.filter((s) => {
      if ((i === dayIndex && s.key === key) || isFixed(i, s.key)) return false;
      if (d[s.key] === pinned.id) return true;
      const r = recipesById.get(d[s.key]);
      return i === dayIndex && r !== undefined && mainFoodIds(r, data.foodsById).some((id) => pinnedMains.has(id));
    }).map((s) => ({ dayIndex: i, key: s.key, course: s.course })),
  );

  for (const c of conflicts) {
    const result = swapDish(request, data, days, c.dayIndex, c.key, []);
    if (!result.ok) {
      return { ok: false, error: `指定した料理とかぶらない${c.course}の候補がありません。ほかの料理を選んでください` };
    }
    days = result.days;
  }

  // 買い足しの上限を超える日を計算し直す
  const limit = data.household.shoppingLimitPerMeal;
  const counts = summarizePlan(days, data).days.map((s) => s.shopping.size);
  return { ok: true, days: days.map((d, i) => ({ ...d, overLimit: counts[i] > limit })) };
}
