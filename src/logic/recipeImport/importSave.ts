// 取り込みの確認画面の内容から、保存するものを決める(純粋関数)
import { AUTO_MAIN_COUNT, DEFAULT_MINUTES, DEFAULT_SERVINGS, DIFFICULTY_BY_MINUTES } from '../../config/recipeImport';
import type { CookingMethod, Flavor } from '../../data/tags';
import type { Course, Difficulty, Food, Recipe } from '../../db/types';
import { withAlias } from '../aliases';
import { normalizeForSearch } from '../foodSearch';
import { amountToInput } from '../format';
import { parseAmount, validateRecipeDraft, type RecipeDraft } from '../forms';
import type { IdGenerator } from '../id';
import { canBeMain } from '../planner/mainFoods';
import { roundAmount } from '../stock';
import type { ImportedPage, ImportIngredient } from './types';

/** 確認画面の材料1行の状態 */
export interface ImportRowState {
  key: number;
  item: ImportIngredient;
  foodId: string | null;
  amountText: string;
  /** 主な材料の印 */
  main: boolean;
  /** 材料に入れない */
  skip: boolean;
  /** 食材が決まっている(読み取った、または確認画面で選んだ・「〜でよい」を押した) */
  confirmed: boolean;
}

/** 確認画面の全体の状態 */
export interface ImportFormState {
  name: string;
  url: string;
  course: Course;
  difficulty: Difficulty;
  minutes: string;
  servings: string;
  methods: CookingMethod[];
  flavors: Flavor[];
  rows: ImportRowState[];
}

/** 難易度の初期値:調理時間から決める(らくらく・ふつうの時間を超えれば「むずかしい」) */
export function initialDifficulty(minutes: number): Difficulty {
  return DIFFICULTY_BY_MINUTES.find((d) => minutes <= d.maxMinutes)?.difficulty ?? 3;
}

/**
 * 最初から「主」の印を付ける材料(行の番号)。材料は主役から先に書かれることが多いので、
 * 上から見て、食材が決まっていて主な材料にできる(調味料・薬味でない)、量が数字の材料を AUTO_MAIN_COUNT 個まで選ぶ
 */
export function autoMainIndexes(items: readonly ImportIngredient[], byId: ReadonlyMap<string, Food>): Set<number> {
  const picked = new Set<number>();
  items.forEach((item, i) => {
    if (picked.size >= AUTO_MAIN_COUNT) return;
    if (item.status === '材料に入れない' || item.vague || item.foodId === null) return;
    if (!canBeMain(byId.get(item.foodId))) return;
    // 同じ食材が2行あっても1つと数える
    if ([...picked].some((j) => items[j].foodId === item.foodId)) return;
    picked.add(i);
  });
  return picked;
}

/** 読み取った材料から、確認画面の1行を作る */
export function toRowState(item: ImportIngredient, key: number): ImportRowState {
  return {
    key,
    item,
    foodId: item.foodId,
    amountText: item.amount === null ? '' : amountToInput(item.amount),
    main: false,
    skip: item.status === '材料に入れない',
    confirmed: item.status === '読み取った',
  };
}

/**
 * 読み取ったページから、確認画面の初期状態を作る。
 * - 人数・時間が書かれていなければ初期値(2人分・30分)にする。難易度はその時間から決める
 * - 上から1〜2個の材料に「主」の印を付ける
 * - 区分・タグは選んでもらうので初期値なし
 */
export function initialFormState(
  page: ImportedPage,
  items: readonly ImportIngredient[],
  byId: ReadonlyMap<string, Food>,
): ImportFormState {
  const minutes = page.minutes ?? DEFAULT_MINUTES;
  const mains = autoMainIndexes(items, byId);
  return {
    name: page.name,
    url: page.url ?? '',
    course: '主菜',
    difficulty: initialDifficulty(minutes),
    minutes: String(minutes),
    servings: String(page.servings ?? DEFAULT_SERVINGS),
    methods: [],
    flavors: [],
    rows: items.map((item, i) => ({ ...toRowState(item, i), main: mains.has(i) })),
  };
}

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$)/;

/**
 * 比べる・保存するための URL の形。http(s) でなければ null。
 * 「#」から後ろと広告の計測用の項目(utm_ など)を取り、最後の「/」をそろえる
 */
export function normalizeRecipeUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString();
}

/** 同じ URL のレシピ */
export function findRecipeByUrl(recipes: readonly Recipe[], url: string): Recipe | undefined {
  const key = normalizeRecipeUrl(url);
  if (key === null) return undefined;
  return recipes.find((r) => r.url !== null && normalizeRecipeUrl(r.url) === key);
}

export type ImportSavePlan =
  | {
      ok: true;
      recipe: Recipe;
      /** 別名を足した食材 */
      updatedFoods: Food[];
      /** 上書きする前のレシピ(同じ URL のレシピがなければ null) */
      replaced: Recipe | null;
    }
  | { ok: false; errors: string[] };

/** 確認画面で食材を決めた行か(別名として覚える) */
function isCorrected(row: ImportRowState): boolean {
  return row.item.status !== '読み取った' || row.foodId !== row.item.foodId;
}

/**
 * 確認画面の内容から、保存するものを決める。
 * - 「材料に入れない」以外の行は、食材と量が決まっていなければ保存しない(どの行かを知らせる)
 * - 同じ食材が2行あれば量を合計する(「主」はどちらかについていればつける)
 * - 同じ URL のレシピがあれば、その ID とお気に入りを引き継いで上書きする
 * - 確認画面で食材を決めた行は、材料名を別名として足す(次から「読み取った」に入る)
 */
export function planImportSave(
  form: ImportFormState,
  foods: readonly Food[],
  recipes: readonly Recipe[],
  newId: IdGenerator,
): ImportSavePlan {
  const errors: string[] = [];
  const url = normalizeRecipeUrl(form.url);
  if (url === null) errors.push('レシピのページの URL を入れてください(https:// から始まる形)');

  const byId = new Map(foods.map((f) => [f.id, f]));
  const merged = new Map<string, { amount: number; main: boolean }>();
  const used = form.rows.filter((r) => !r.skip);
  for (const row of used) {
    const label = row.item.name;
    const food = row.foodId === null ? undefined : byId.get(row.foodId);
    if (!food) {
      errors.push(`「${label}」の食材を選ぶか、「材料に入れない」を押してください`);
      continue;
    }
    if (!row.confirmed) {
      errors.push(`「${label}」が${food.name}でよいか確かめてください`);
      continue;
    }
    const amount = parseAmount(row.amountText);
    if (amount === null || amount <= 0) {
      errors.push(`「${label}」の量を0より大きい数字にしてください`);
      continue;
    }
    const prev = merged.get(food.id);
    merged.set(food.id, { amount: roundAmount((prev?.amount ?? 0) + amount), main: (prev?.main ?? false) || row.main });
  }
  if (errors.length > 0) return { ok: false, errors };

  const replaced = findRecipeByUrl(recipes, url as string) ?? null;
  const draft: RecipeDraft = {
    name: form.name,
    course: form.course,
    ingredients: [...merged].map(([foodId, v]) => ({ foodId, amount: String(v.amount), main: v.main })),
    servings: form.servings,
    minutes: form.minutes,
    difficulty: form.difficulty,
    methods: form.methods,
    flavors: form.flavors,
    stepsText: '',
    favorite: replaced?.favorite ?? false,
  };
  const result = validateRecipeDraft(draft, replaced?.id ?? `url_${newId()}`, byId, { source: 'URL', url });
  if (!result.ok) return result;

  const current = new Map(byId);
  const changed = new Set<string>();
  for (const row of used) {
    if (row.foodId === null || !isCorrected(row) || normalizeForSearch(row.item.name) === '') continue;
    const food = current.get(row.foodId);
    const next = food ? withAlias(food, row.item.name, [...current.values()]) : null;
    if (next) {
      current.set(next.id, next);
      changed.add(next.id);
    }
  }
  return {
    ok: true,
    recipe: result.value,
    updatedFoods: [...changed].map((id) => current.get(id) as Food),
    replaced,
  };
}
