// 全データの書き出し・読み込み(純粋関数)
import { BACKUP_FORMAT_VERSION } from '../config/app';
import { ALLERGENS } from '../data/allergens';
import { COOKING_METHODS, FLAVORS, type CookingMethod } from '../data/tags';
import {
  TABLE_NAMES,
  type AllData,
  type Feedback,
  type Food,
  type Frequency,
  type HouseholdPrefs,
  type IgnoredWord,
  type MealSet,
  type MealStatus,
  type Member,
  type PantryItem,
  type PlanConditions,
  type Recipe,
  type Stock,
  type StockMove,
} from '../db/types';
import { toDateTimeString } from './date';
import { parseComboValue } from './feedback/target';
import { upgradeBackupDataV1, upgradeBackupDataV2, upgradeBackupDataV3 } from './migrate';
import {
  ValidationError,
  arr,
  bool,
  fail,
  num,
  numOrNull,
  obj,
  oneOf,
  oneOfArr,
  str,
  strArr,
  strOrNull,
  type Obj,
} from './validate';

const APP_ID = 'kondate';

interface BackupFile {
  app: typeof APP_ID;
  formatVersion: number;
  exportedAt: string;
  data: AllData;
}

/** 全データを JSON の文字列にする */
export function serializeBackup(data: AllData, now: Date): string {
  const file: BackupFile = {
    app: APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: toDateTimeString(now),
    data,
  };
  return JSON.stringify(file, null, 2);
}

/** 書き出すファイルの名前 */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `kondate-backup-${stamp}.json`;
}

export type ParseResult =
  | { ok: true; data: AllData; exportedAt: string }
  | { ok: false; error: string };

/** JSON の文字列を読んで、形を確かめる */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読めないファイルです' };
  }
  try {
    const root = obj(raw, 'ファイル');
    if (root.app !== APP_ID) return { ok: false, error: 'このアプリで書き出したファイルではありません' };
    const version = num(root, 'formatVersion', 'ファイル');
    if (version > BACKUP_FORMAT_VERSION) {
      return { ok: false, error: '新しい版のアプリで書き出したファイルです。アプリを更新してください' };
    }
    const exportedAt = str(root, 'exportedAt', 'ファイル');
    const d = obj(root.data, 'data');
    // 版1のファイルは、足りない項目を補ってから確かめる
    if (version < 2) upgradeBackupDataV1(d);
    // 版2までのファイルには読まない言葉がない
    if (version < 3) upgradeBackupDataV2(d);
    // 版3までのファイルの食材には、1単位あたりの重さがない
    if (version < 4) upgradeBackupDataV3(d);
    const data: AllData = {
      foods: arr(d, 'foods', 'data').map((v, i) => parseFood(v, `食材辞書[${i}]`)),
      stocks: arr(d, 'stocks', 'data').map((v, i) => parseStock(v, `在庫[${i}]`)),
      pantry: arr(d, 'pantry', 'data').map((v, i) => parsePantry(v, `常備調味料[${i}]`)),
      members: arr(d, 'members', 'data').map((v, i) => parseMember(v, `メンバー[${i}]`)),
      household: arr(d, 'household', 'data').map((v, i) => parseHousehold(v, `家庭の好み[${i}]`)),
      recipes: arr(d, 'recipes', 'data').map((v, i) => parseRecipe(v, `レシピ[${i}]`)),
      mealSets: arr(d, 'mealSets', 'data').map((v, i) => parseMealSet(v, `献立セット[${i}]`)),
      stockMoves: arr(d, 'stockMoves', 'data').map((v, i) => parseStockMove(v, `在庫の動き[${i}]`)),
      feedbacks: arr(d, 'feedbacks', 'data').map((v, i) => parseFeedback(v, `評価[${i}]`)),
      ignoredWords: arr(d, 'ignoredWords', 'data').map((v, i) => parseIgnoredWord(v, `読まない言葉[${i}]`)),
    };
    return { ok: true, data, exportedAt };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: `ファイルの中身が正しくありません:${e.message}` };
    throw e;
  }
}

/** 確認画面用:データの件数 */
export function countData(data: AllData): Record<(typeof TABLE_NAMES)[number], number> {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, data[t].length])) as Record<
    (typeof TABLE_NAMES)[number],
    number
  >;
}

// ───────── 各データの確認 ─────────

function parseFood(v: unknown, p: string): Food {
  const o = obj(v, p);
  return {
    id: str(o, 'id', p),
    name: str(o, 'name', p),
    aliases: strArr(o, 'aliases', p),
    unit: str(o, 'unit', p),
    usualAmount: num(o, 'usualAmount', p),
    kind: oneOf(o, 'kind', ['食材', '調味料'] as const, p),
    foodGroup: o.foodGroup === null ? null : oneOf(o, 'foodGroup', ['赤', '緑', '黄'] as const, p),
    shelfLifeDays: num(o, 'shelfLifeDays', p),
    isCondiment: bool(o, 'isCondiment', p),
    allergens: oneOfArr(o, 'allergens', ALLERGENS, p),
    allergenUncertain: bool(o, 'allergenUncertain', p),
    gramsPerUnit: numOrNull(o, 'gramsPerUnit', p),
  };
}

function parseStock(v: unknown, p: string): Stock {
  const o = obj(v, p);
  return { foodId: str(o, 'foodId', p), amount: num(o, 'amount', p), addedDate: str(o, 'addedDate', p) };
}

function parsePantry(v: unknown, p: string): PantryItem {
  const o = obj(v, p);
  return { foodId: str(o, 'foodId', p) };
}

function parseMember(v: unknown, p: string): Member {
  const o = obj(v, p);
  return {
    id: str(o, 'id', p),
    name: str(o, 'name', p),
    kind: oneOf(o, 'kind', ['家族', 'ゲスト'] as const, p),
    sex: oneOf(o, 'sex', ['男性', '女性'] as const, p),
    age: num(o, 'age', p),
    appetite: oneOf(o, 'appetite', ['少なめ', 'ふつう', '多め'] as const, p),
    portionOverride: numOrNull(o, 'portionOverride', p),
    likedFoodIds: strArr(o, 'likedFoodIds', p),
    dislikedFoodIds: strArr(o, 'dislikedFoodIds', p),
    allergyFoodIds: strArr(o, 'allergyFoodIds', p),
    allergyAllergens: oneOfArr(o, 'allergyAllergens', ALLERGENS, p),
    likedMethods: oneOfArr(o, 'likedMethods', COOKING_METHODS, p),
    dislikedMethods: oneOfArr(o, 'dislikedMethods', COOKING_METHODS, p),
    likedFlavors: oneOfArr(o, 'likedFlavors', FLAVORS, p),
    dislikedFlavors: oneOfArr(o, 'dislikedFlavors', FLAVORS, p),
  };
}

function parseHousehold(v: unknown, p: string): HouseholdPrefs {
  const o = obj(v, p);
  if (o.id !== 'household') fail(`${p}.id`, '「household」');
  const freq = obj(o.methodFrequency, `${p}.methodFrequency`);
  const methodFrequency = Object.fromEntries(
    COOKING_METHODS.map((m) => [m, oneOf(freq, m, ['好き', 'ふつう', '苦手'] as const, `${p}.methodFrequency`)]),
  ) as Record<CookingMethod, Frequency>;
  return {
    id: 'household',
    methodFrequency,
    dislikedFlavors: oneOfArr(o, 'dislikedFlavors', FLAVORS, p),
    shoppingLimitPerMeal: num(o, 'shoppingLimitPerMeal', p),
  };
}

function parseRecipe(v: unknown, p: string): Recipe {
  const o = obj(v, p);
  return {
    id: str(o, 'id', p),
    name: str(o, 'name', p),
    course: oneOf(o, 'course', ['主菜', '副菜', '汁物'] as const, p),
    ingredients: arr(o, 'ingredients', p).map((iv, i) => {
      const ip = `${p}.ingredients[${i}]`;
      const io = obj(iv, ip);
      return { foodId: str(io, 'foodId', ip), amount: num(io, 'amount', ip), main: bool(io, 'main', ip) };
    }),
    servings: num(o, 'servings', p),
    minutes: num(o, 'minutes', p),
    difficulty: oneOf(o, 'difficulty', [1, 2, 3] as const, p),
    methods: oneOfArr(o, 'methods', COOKING_METHODS, p),
    flavors: oneOfArr(o, 'flavors', FLAVORS, p),
    steps: strArr(o, 'steps', p),
    source: oneOf(o, 'source', ['初期', 'マイレシピ', 'URL'] as const, p),
    url: strOrNull(o, 'url', p),
    favorite: bool(o, 'favorite', p),
  };
}

const MEAL_STATUSES: readonly MealStatus[] = ['予定', '作った', 'キャンセル'];

function parseMealSet(v: unknown, p: string): MealSet {
  const o = obj(v, p);
  return {
    id: str(o, 'id', p),
    startDate: str(o, 'startDate', p),
    days: arr(o, 'days', p).map((dv, i) => {
      const dp = `${p}.days[${i}]`;
      const d: Obj = obj(dv, dp);
      return {
        date: str(d, 'date', dp),
        mainId: str(d, 'mainId', dp),
        sideId: str(d, 'sideId', dp),
        soupId: str(d, 'soupId', dp),
        memberIds: strArr(d, 'memberIds', dp),
        status: oneOf(d, 'status', MEAL_STATUSES, dp),
      };
    }),
    status: oneOf(o, 'status', MEAL_STATUSES, p),
    reserved: arr(o, 'reserved', p).map((rv, i) => {
      const rp = `${p}.reserved[${i}]`;
      const r = obj(rv, rp);
      return {
        dayIndex: num(r, 'dayIndex', rp),
        foodId: str(r, 'foodId', rp),
        amount: num(r, 'amount', rp),
        addedDate: strOrNull(r, 'addedDate', rp),
      };
    }),
    conditions: parseConditions(o.conditions, `${p}.conditions`),
    guests: arr(o, 'guests', p).map((gv, i) => {
      const gp = `${p}.guests[${i}]`;
      const g = obj(gv, gp);
      return { memberId: str(g, 'memberId', gp), fromDate: str(g, 'fromDate', gp), toDate: str(g, 'toDate', gp) };
    }),
    shopping: arr(o, 'shopping', p).map((sv, i) => {
      const sp = `${p}.shopping[${i}]`;
      const s = obj(sv, sp);
      return {
        dayIndex: num(s, 'dayIndex', sp),
        foodId: str(s, 'foodId', sp),
        amount: num(s, 'amount', sp),
        bought: bool(s, 'bought', sp),
      };
    }),
    overLimitDays: arr(o, 'overLimitDays', p).map((v, i) => {
      if (typeof v !== 'number') fail(`${p}.overLimitDays[${i}]`, '数字');
      return v;
    }),
  };
}

function parseConditions(v: unknown, p: string): PlanConditions {
  const o = obj(v, p);
  return {
    preset: oneOf(o, 'preset', ['らくらく', 'ふつう', 'しっかり'] as const, p),
    maxMinutes: numOrNull(o, 'maxMinutes', p),
    maxDifficulty: oneOf(o, 'maxDifficulty', [1, 2, 3] as const, p),
    forMemberId: strOrNull(o, 'forMemberId', p),
  };
}

function parseStockMove(v: unknown, p: string): StockMove {
  const o = obj(v, p);
  return {
    id: str(o, 'id', p),
    at: str(o, 'at', p),
    foodId: str(o, 'foodId', p),
    delta: num(o, 'delta', p),
    reason: oneOf(o, 'reason', ['購入', '夕飯', '昼食', '手直し', 'キャンセルで戻す'] as const, p),
    mealSetId: strOrNull(o, 'mealSetId', p),
  };
}

function parseFeedback(v: unknown, p: string): Feedback {
  const o = obj(v, p);
  const targetType = oneOf(o, 'targetType', ['食材', '料理法', '味付け', '料理法×味付け', 'レシピ'] as const, p);
  const targetValue = str(o, 'targetValue', p);
  const vp = `${p}.targetValue`;
  if (targetType === '料理法' && !(COOKING_METHODS as readonly string[]).includes(targetValue)) fail(vp, '調理法');
  if (targetType === '味付け' && !(FLAVORS as readonly string[]).includes(targetValue)) fail(vp, '味付け');
  if (targetType === '料理法×味付け' && parseComboValue(targetValue) === null) fail(vp, '「調理法×味付け」の形');
  return {
    id: str(o, 'id', p),
    at: str(o, 'at', p),
    targetType,
    targetValue,
    kind: oneOf(o, 'kind', ['提案時の嫌い', '食後の嫌い', '好き'] as const, p),
    originalText: str(o, 'originalText', p),
  };
}

function parseIgnoredWord(v: unknown, p: string): IgnoredWord {
  const o = obj(v, p);
  return { word: str(o, 'word', p), label: str(o, 'label', p), addedAt: str(o, 'addedAt', p) };
}
