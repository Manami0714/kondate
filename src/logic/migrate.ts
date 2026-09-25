// データの形の移行(版1 → 版2)
// データベースの版上げと、版1の書き出しファイルの読み込みの両方で使う
// どれも「足りない項目だけを補う」ので、何度呼んでも結果は同じ
import { DEFAULT_SHOPPING_LIMIT_PER_MEAL, TIME_PRESETS } from '../config/scoring';
import { INITIAL_FOODS } from '../data/foods';
import { INITIAL_RECIPES } from '../data/recipes';
import type { Obj } from './validate';

const seedFoods = new Map(INITIAL_FOODS.map((f) => [f.id, f]));
const seedRecipes = new Map(INITIAL_RECIPES.map((r) => [r.id, r]));

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 食材:初期食材は初期データから薬味・アレルギー物質・要確認の印を写す。それ以外は印なし・空 */
export function upgradeFoodV1(o: Obj): void {
  const seed = typeof o.id === 'string' ? seedFoods.get(o.id) : undefined;
  if (o.isCondiment === undefined) o.isCondiment = seed?.isCondiment ?? false;
  if (o.allergens === undefined) o.allergens = seed ? [...seed.allergens] : [];
  if (o.allergenUncertain === undefined) o.allergenUncertain = seed?.allergenUncertain ?? false;
}

/** メンバー:アレルギー物質は空から始める */
export function upgradeMemberV1(o: Obj): void {
  if (o.allergyAllergens === undefined) o.allergyAllergens = [];
}

/** レシピ:初期レシピは初期データから主な材料の印を写す。マイレシピなどは印なし */
export function upgradeRecipeV1(o: Obj): void {
  const seed = o.source === '初期' && typeof o.id === 'string' ? seedRecipes.get(o.id) : undefined;
  const mainIds = new Set(seed?.ingredients.filter((i) => i.main).map((i) => i.foodId) ?? []);
  if (!Array.isArray(o.ingredients)) return;
  for (const ing of o.ingredients) {
    if (isObj(ing) && ing.main === undefined) ing.main = typeof ing.foodId === 'string' && mainIds.has(ing.foodId);
  }
}

/** 家庭の好み:買い足し上限の初期値 */
export function upgradeHouseholdV1(o: Obj): void {
  if (o.shoppingLimitPerMeal === undefined) o.shoppingLimitPerMeal = DEFAULT_SHOPPING_LIMIT_PER_MEAL;
}

/** 献立セット:新しい項目に空の値を入れる */
export function upgradeMealSetV1(o: Obj): void {
  if (o.conditions === undefined) o.conditions = { preset: 'ふつう', ...TIME_PRESETS['ふつう'], forMemberId: null };
  if (o.guests === undefined) o.guests = [];
  if (o.shopping === undefined) o.shopping = [];
  if (o.overLimitDays === undefined) o.overLimitDays = [];
  if (Array.isArray(o.reserved)) {
    for (const r of o.reserved) {
      if (isObj(r) && r.addedDate === undefined) r.addedDate = null;
    }
  }
}

/** 版1の書き出しファイルの data を、版2の形に直す(読み込み前に呼ぶ) */
export function upgradeBackupDataV1(data: Obj): void {
  const each = (key: string, fn: (o: Obj) => void) => {
    const list = data[key];
    if (Array.isArray(list)) for (const item of list) if (isObj(item)) fn(item);
  };
  each('foods', upgradeFoodV1);
  each('members', upgradeMemberV1);
  each('recipes', upgradeRecipeV1);
  each('household', upgradeHouseholdV1);
  each('mealSets', upgradeMealSetV1);

  // 版1の後に増えた初期食材・初期レシピを足す
  const ids = (key: string) =>
    new Set((Array.isArray(data[key]) ? data[key] : []).filter(isObj).map((o) => String(o.id)));
  const missing = missingSeeds(ids('foods'), ids('recipes'));
  if (Array.isArray(data.foods)) data.foods.push(...missing.foods);
  if (Array.isArray(data.recipes)) data.recipes.push(...missing.recipes);
}

/** 版2の書き出しファイルの data を、版3の形に直す(読まない言葉の表を足す) */
export function upgradeBackupDataV2(data: Obj): void {
  if (data.ignoredWords === undefined) data.ignoredWords = [];
}

/**
 * 初期データのうち、まだ入っていない食材とレシピ(初期レシピを追加したときに、既存の端末へ届けるため)。
 * 追加した回ごとにデータベースの版を上げ、その upgrade でこれを入れる
 */
export function missingSeeds(foodIds: ReadonlySet<string>, recipeIds: ReadonlySet<string>) {
  return {
    foods: INITIAL_FOODS.filter((f) => !foodIds.has(f.id)),
    recipes: INITIAL_RECIPES.filter((r) => !recipeIds.has(r.id)),
  };
}
