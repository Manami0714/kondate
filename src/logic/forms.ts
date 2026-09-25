// 入力フォームの内容を確かめて、保存する形にする(純粋関数)
import type { Allergen } from '../data/allergens';
import type { CookingMethod, Flavor } from '../data/tags';
import type {
  Appetite,
  Course,
  Difficulty,
  Food,
  FoodGroup,
  FoodKind,
  Member,
  MemberKind,
  Recipe,
  Sex,
} from '../db/types';
import { findFoodByExactName } from './foodSearch';
import { canBeMain } from './planner/mainFoods';

export type FormResult<T> = { ok: true; value: T } | { ok: false, errors: string[] };

/**
 * 量の文字を数字にする。「0.5」「1/4」「1 1/2」「１／２」に対応。読めなければ null
 */
export function parseAmount(text: string): number | null {
  const t = text.normalize('NFKC').trim();
  if (t === '') return null;
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) {
    const den = Number(mixed[3]);
    return den === 0 ? null : Number(mixed[1]) + Number(mixed[2]) / den;
  }
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) {
    const den = Number(frac[2]);
    return den === 0 ? null : Number(frac[1]) / den;
  }
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return null;
  return Number(t);
}

// ───────── 食材辞書 ─────────

export interface FoodDraft {
  name: string;
  aliasesText: string;
  unit: string;
  usualAmount: string;
  kind: FoodKind;
  foodGroup: FoodGroup | null;
  shelfLifeDays: string;
  /** 薬味の印(食材のときだけ) */
  isCondiment: boolean;
  allergens: Allergen[];
  /** アレルギー物質は要確認の印 */
  allergenUncertain: boolean;
}

/** 辞書の食材を編集用の下書きにする */
export function foodToDraft(food: Food): FoodDraft {
  return {
    name: food.name,
    aliasesText: food.aliases.join('、'),
    unit: food.unit,
    usualAmount: String(food.usualAmount),
    kind: food.kind,
    foodGroup: food.foodGroup,
    shelfLifeDays: String(food.shelfLifeDays),
    isCondiment: food.isCondiment,
    allergens: [...food.allergens],
    allergenUncertain: food.allergenUncertain,
  };
}

/**
 * 食材の入力を確かめる。id が辞書にある食材なら編集として扱い、その食材自身とは重複を比べない
 */
export function validateFoodDraft(draft: FoodDraft, existing: readonly Food[], id: string): FormResult<Food> {
  const errors: string[] = [];
  const others = existing.filter((f) => f.id !== id);
  const name = draft.name.trim();
  if (name === '') errors.push('食材名を入れてください');
  else if (findFoodByExactName(others, name)) errors.push(`「${name}」はすでに辞書にあります`);
  for (const alias of splitList(draft.aliasesText)) {
    const dup = alias !== name ? findFoodByExactName(others, alias) : undefined;
    if (dup) errors.push(`別名「${alias}」は「${dup.name}」で使われています`);
  }
  const unit = draft.unit.trim();
  if (unit === '') errors.push('単位を入れてください');
  const usualAmount = parseAmount(draft.usualAmount);
  if (usualAmount === null || usualAmount <= 0) errors.push('ふつうの量は0より大きい数字にしてください');
  const shelf = parseAmount(draft.shelfLifeDays);
  if (shelf === null || shelf <= 0 || !Number.isInteger(shelf)) errors.push('保存の目安日数は1以上の整数にしてください');
  if (draft.kind === '食材' && draft.foodGroup === null) errors.push('食品グループを選んでください');
  if (errors.length > 0) return { ok: false, errors };
  const aliases = splitList(draft.aliasesText).filter((a) => a !== name);
  return {
    ok: true,
    value: {
      id,
      name,
      aliases,
      unit,
      usualAmount: usualAmount as number,
      kind: draft.kind,
      foodGroup: draft.kind === '調味料' ? null : draft.foodGroup,
      shelfLifeDays: shelf as number,
      isCondiment: draft.kind === '食材' && draft.isCondiment,
      allergens: [...draft.allergens],
      allergenUncertain: draft.allergenUncertain,
    },
  };
}

/** 「、」「,」改行で区切った文字を配列にする(空と重複は除く) */
export function splitList(text: string): string[] {
  const items = text
    .split(/[、,,\n]/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return [...new Set(items)];
}

// ───────── メンバー ─────────

export interface MemberDraft {
  name: string;
  kind: MemberKind;
  sex: Sex;
  age: string;
  appetite: Appetite;
  portionOverride: string;
  likedFoodIds: string[];
  dislikedFoodIds: string[];
  allergyFoodIds: string[];
  allergyAllergens: Allergen[];
  likedMethods: CookingMethod[];
  dislikedMethods: CookingMethod[];
  likedFlavors: Flavor[];
  dislikedFlavors: Flavor[];
}

export function validateMemberDraft(draft: MemberDraft, id: string): FormResult<Member> {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (name === '') errors.push('呼び名を入れてください');
  const age = parseAmount(draft.age);
  if (age === null || !Number.isInteger(age) || age > 120) errors.push('年齢は0〜120の整数にしてください');
  let portionOverride: number | null = null;
  if (draft.portionOverride.trim() !== '') {
    portionOverride = parseAmount(draft.portionOverride);
    if (portionOverride === null || portionOverride <= 0 || portionOverride > 5) {
      errors.push('倍率は0より大きく5以下の数字にしてください(空欄なら自動)');
    }
  }
  const overlap = (a: readonly string[], b: readonly string[]) => a.some((x) => b.includes(x));
  if (overlap(draft.likedFoodIds, draft.dislikedFoodIds)) errors.push('同じ食材が「好き」と「苦手」の両方にあります');
  if (overlap(draft.likedMethods, draft.dislikedMethods)) errors.push('同じ調理法が「好き」と「苦手」の両方にあります');
  if (overlap(draft.likedFlavors, draft.dislikedFlavors)) errors.push('同じ味付けが「好き」と「苦手」の両方にあります');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      name,
      kind: draft.kind,
      sex: draft.sex,
      age: age as number,
      appetite: draft.appetite,
      portionOverride,
      likedFoodIds: [...draft.likedFoodIds],
      dislikedFoodIds: [...draft.dislikedFoodIds],
      allergyFoodIds: [...draft.allergyFoodIds],
      allergyAllergens: [...draft.allergyAllergens],
      likedMethods: [...draft.likedMethods],
      dislikedMethods: [...draft.dislikedMethods],
      likedFlavors: [...draft.likedFlavors],
      dislikedFlavors: [...draft.dislikedFlavors],
    },
  };
}

// ───────── マイレシピ ─────────

export interface RecipeDraft {
  name: string;
  course: Course;
  ingredients: { foodId: string; amount: string; main: boolean }[];
  servings: string;
  minutes: string;
  difficulty: Difficulty;
  methods: CookingMethod[];
  flavors: Flavor[];
  stepsText: string;
  /** お気に入り(フェーズ3で画面から変えられるようにする。ここでは値を引き継ぐだけ) */
  favorite: boolean;
}

export function validateRecipeDraft(
  draft: RecipeDraft,
  id: string,
  byId: ReadonlyMap<string, Food>,
): FormResult<Recipe> {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (name === '') errors.push('料理名を入れてください');
  if (draft.ingredients.length === 0) errors.push('材料を1つ以上入れてください');
  const ids = draft.ingredients.map((i) => i.foodId);
  if (new Set(ids).size !== ids.length) errors.push('同じ材料が2回入っています');
  const ingredients = draft.ingredients.map((ing, i) => {
    const amount = parseAmount(ing.amount);
    if (amount === null || amount <= 0) errors.push(`材料${i + 1}つ目の量を0より大きい数字にしてください`);
    return { foodId: ing.foodId, amount: amount ?? 0, main: ing.main };
  });
  const mains = draft.ingredients.filter((i) => i.main);
  if (draft.ingredients.length > 0 && mains.length === 0) errors.push('主な材料を1つ以上選んでください');
  if (mains.some((i) => !canBeMain(byId.get(i.foodId)))) errors.push('薬味と調味料は主な材料にできません');
  const servings = parseAmount(draft.servings);
  if (servings === null || servings <= 0 || !Number.isInteger(servings)) errors.push('基準の人数は1以上の整数にしてください');
  const minutes = parseAmount(draft.minutes);
  if (minutes === null || minutes <= 0 || !Number.isInteger(minutes)) errors.push('調理時間は1以上の整数(分)にしてください');
  const steps = draft.stepsText
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      name,
      course: draft.course,
      ingredients,
      servings: servings as number,
      minutes: minutes as number,
      difficulty: draft.difficulty,
      methods: [...draft.methods],
      flavors: [...draft.flavors],
      steps,
      source: 'マイレシピ',
      url: null,
      favorite: draft.favorite,
    },
  };
}
