// 献立の中身をまとめる(純粋関数)
// 日ごとの量・在庫の見込み・買い足し・栄養バランス・アレルギーの注意を、1日目から順に計算する
import type { Member, Recipe, RecipeIngredient } from '../../db/types';
import { roundAmount } from '../stock';
import { totalPortion, scaleIngredients } from '../portion';
import { dayHasAllergy, uncertainFoodNames } from './allergyNotes';
import { safetyWarnings } from './fixed';
import { mealBalance, type MealBalance } from './balance';
import { applyUse, dishUse, toSimStock, type DishUse, type SimStock } from './simulate';
import { COURSE_SLOTS, type DayInput, type Dishes, type PlannerData } from './types';

export interface DishDetail {
  recipe: Recipe;
  /** 人数に合わせた材料の量 */
  ingredients: RecipeIngredient[];
  use: DishUse;
  /** アレルギーのある人がいる日に、注意を出す「要確認」の食材名 */
  uncertainFoods: string[];
  /** アレルギー・食後の嫌いに当てはまるときの注意(指定した料理で出る)。確定したあとも表示のたびに計算する */
  safetyWarnings: string[];
}

export interface DaySummary {
  date: string;
  members: Member[];
  total: number;
  dishes: DishDetail[];
  /** その日の分の買い足し(食材ID → 足りない量) */
  shopping: Map<string, number>;
  /** 食品グループ(黄はご飯で常にそろう扱い) */
  balance: MealBalance;
  /** アレルギーのある人がいる日 */
  allergyNote: boolean;
}

export interface PlanSummary {
  days: DaySummary[];
  /** 献立を全部作った後の在庫の見込み */
  finalStock: SimStock;
}

type Day = DayInput & Dishes;

export function summarizePlan(days: readonly Day[], data: PlannerData): PlanSummary {
  const recipesById = new Map(data.recipes.map((r) => [r.id, r]));
  let stock = toSimStock(data.stocks);
  const result: DaySummary[] = [];

  for (const day of days) {
    const members = day.memberIds.map((id) => data.membersById.get(id)).filter((m): m is Member => m !== undefined);
    const total = totalPortion(members);
    const dishes: DishDetail[] = [];
    const shopping = new Map<string, number>();
    for (const slot of COURSE_SLOTS) {
      const recipe = recipesById.get(day[slot.key]);
      if (!recipe) continue;
      const ingredients = scaleIngredients(recipe, total);
      const use = dishUse(stock, ingredients, data.pantryIds);
      stock = applyUse(stock, use.used);
      for (const [foodId, amount] of use.shortage) shopping.set(foodId, roundAmount((shopping.get(foodId) ?? 0) + amount));
      dishes.push({
        recipe,
        ingredients,
        use,
        uncertainFoods: uncertainFoodNames(recipe, members, data.foodsById),
        safetyWarnings: safetyWarnings(recipe, members, data.feedbacks, data.foodsById, recipesById).map((w) => w.text),
      });
    }
    result.push({
      date: day.date,
      members,
      total,
      dishes,
      shopping,
      balance: mealBalance(
        dishes.map((d) => d.recipe),
        data.foodsById,
      ),
      allergyNote: dayHasAllergy(members),
    });
  }
  return { days: result, finalStock: stock };
}
