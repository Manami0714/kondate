// 入力フォームの内容を確かめて、保存する形にする(純粋関数)
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
}

export function validateFoodDraft(draft: FoodDraft, existing: readonly Food[], id: string): FormResult<Food> {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (name === '') errors.push('食材名を入れてください');
  else if (findFoodByExactName(existing, name)) errors.push(`「${name}」はすでに辞書にあります`);
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
  ingredients: { foodId: string; amount: string }[];
  servings: string;
  minutes: string;
  difficulty: Difficulty;
  methods: CookingMethod[];
  flavors: Flavor[];
  stepsText: string;
  /** お気に入り(フェーズ3で画面から変えられるようにする。ここでは値を引き継ぐだけ) */
  favorite: boolean;
}

export function validateRecipeDraft(draft: RecipeDraft, id: string): FormResult<Recipe> {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (name === '') errors.push('料理名を入れてください');
  if (draft.ingredients.length === 0) errors.push('材料を1つ以上入れてください');
  const ids = draft.ingredients.map((i) => i.foodId);
  if (new Set(ids).size !== ids.length) errors.push('同じ材料が2回入っています');
  const ingredients = draft.ingredients.map((ing, i) => {
    const amount = parseAmount(ing.amount);
    if (amount === null || amount <= 0) errors.push(`材料${i + 1}つ目の量を0より大きい数字にしてください`);
    return { foodId: ing.foodId, amount: amount ?? 0 };
  });
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
