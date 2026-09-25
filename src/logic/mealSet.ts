// 献立の確定・キャンセル・買い足し・作った(純粋関数)
// 在庫を変えるときは必ず「在庫の動き」を作り、確保した量を記録してキャンセルで元に戻せるようにする
import type {
  DateString,
  Food,
  GuestStay,
  MealDay,
  MealSet,
  MealStatus,
  PlanConditions,
  ReservedFood,
  ShoppingItem,
  Stock,
  StockMove,
  StockMoveReason,
} from '../db/types';
import type { IdGenerator } from './id';
import { scaleIngredients, totalPortion } from './portion';
import type { PlannedDay, PlannerData } from './planner/types';
import { COURSE_SLOTS } from './planner/types';
import { changeStock, roundAmount } from './stock';

/** 在庫への影響:変わった食材の新しい在庫(null なら在庫から消す)と、在庫の動き */
export interface StockEffect {
  stocks: Map<string, Stock | null>;
  moves: StockMove[];
}

export interface MealSetChange extends StockEffect {
  mealSet: MealSet;
}

export type MealSetResult = { ok: true; change: MealSetChange } | { ok: false; error: string };

/** 在庫を順に動かして、動きを記録する帳面 */
class Ledger {
  private readonly current: Map<string, Stock | null>;
  readonly touched = new Map<string, Stock | null>();
  readonly moves: StockMove[] = [];

  constructor(
    stocks: readonly Stock[],
    private readonly now: Date,
    private readonly newId: IdGenerator,
    private readonly mealSetId: string,
  ) {
    this.current = new Map(stocks.map((s) => [s.foodId, s]));
  }

  get(foodId: string): Stock | null {
    return this.current.get(foodId) ?? null;
  }

  /** 在庫を delta だけ動かす。実際に動いた量を返す */
  change(foodId: string, delta: number, reason: StockMoveReason, restoreAddedDate: DateString | null = null): number {
    const { stock, move } = changeStock({
      current: this.get(foodId),
      foodId,
      delta,
      reason,
      now: this.now,
      newId: this.newId,
      mealSetId: this.mealSetId,
      restoreAddedDate,
    });
    this.current.set(foodId, stock);
    this.touched.set(foodId, stock);
    if (move) this.moves.push(move);
    return move?.delta ?? 0;
  }

  /** 在庫にある分だけ使う(献立で確保する)。確保した量を記録用に返す */
  take(foodId: string, need: number, dayIndex: number): ReservedFood | null {
    const before = this.get(foodId);
    const amount = Math.min(before?.amount ?? 0, need);
    if (amount <= 0) return null;
    this.change(foodId, -amount, '夕飯');
    return { dayIndex, foodId, amount, addedDate: before?.addedDate ?? null };
  }

  effect(): StockEffect {
    return { stocks: this.touched, moves: this.moves };
  }
}

/** 日の状態から、セット全体の状態を決める */
function setStatus(days: readonly MealDay[]): MealStatus {
  if (days.some((d) => d.status === '予定')) return '予定';
  return days.some((d) => d.status === '作った') ? '作った' : 'キャンセル';
}

export interface ConfirmInput {
  id: string;
  startDate: DateString;
  days: readonly PlannedDay[];
  conditions: PlanConditions;
  guests: readonly GuestStay[];
  data: PlannerData;
  now: Date;
  newId: IdGenerator;
}

/** 献立を確定する:在庫にある分だけ減らし、足りない分を買い足しリストに出す(常備調味料は減らさない) */
export function confirmPlan(input: ConfirmInput): MealSetChange {
  const { data } = input;
  const recipesById = new Map(data.recipes.map((r) => [r.id, r]));
  const ledger = new Ledger(data.stocks, input.now, input.newId, input.id);
  const reserved: ReservedFood[] = [];
  const shopping: ShoppingItem[] = [];

  input.days.forEach((day, dayIndex) => {
    const members = day.memberIds.map((id) => data.membersById.get(id)).filter((m) => m !== undefined);
    const total = totalPortion(members);
    const lack = new Map<string, number>();
    for (const slot of COURSE_SLOTS) {
      const recipe = recipesById.get(day[slot.key]);
      if (!recipe) continue;
      for (const ing of scaleIngredients(recipe, total)) {
        if (data.pantryIds.has(ing.foodId)) continue;
        const r = ledger.take(ing.foodId, ing.amount, dayIndex);
        if (r) reserved.push(r);
        const short = roundAmount(ing.amount - (r?.amount ?? 0));
        if (short > 0) lack.set(ing.foodId, roundAmount((lack.get(ing.foodId) ?? 0) + short));
      }
    }
    for (const [foodId, amount] of lack) shopping.push({ dayIndex, foodId, amount, bought: false });
  });

  const mealSet: MealSet = {
    id: input.id,
    startDate: input.startDate,
    days: input.days.map((d) => ({
      date: d.date,
      mainId: d.mainId,
      sideId: d.sideId,
      soupId: d.soupId,
      memberIds: [...d.memberIds],
      status: '予定',
    })),
    status: '予定',
    reserved,
    conditions: input.conditions,
    guests: [...input.guests],
    shopping,
    overLimitDays: input.days.flatMap((d, i) => (d.overLimit ? [i] : [])),
  };
  return { mealSet, ...ledger.effect() };
}

/** 1食をキャンセルする:確保した食材を在庫に戻し(追加日も元どおり)、その日の買い足しを消す */
function cancelDays(
  set: MealSet,
  dayIndexes: readonly number[],
  stocks: readonly Stock[],
  now: Date,
  newId: IdGenerator,
): MealSetChange {
  const ledger = new Ledger(stocks, now, newId, set.id);
  const targets = new Set(dayIndexes);
  // 確保した順と逆に戻す
  for (const r of [...set.reserved].reverse()) {
    if (targets.has(r.dayIndex)) ledger.change(r.foodId, r.amount, 'キャンセルで戻す', r.addedDate);
  }
  const days = set.days.map((d, i) => (targets.has(i) ? { ...d, status: 'キャンセル' as const } : d));
  const mealSet: MealSet = {
    ...set,
    days,
    status: setStatus(days),
    reserved: set.reserved.filter((r) => !targets.has(r.dayIndex)),
    shopping: set.shopping.filter((s) => !targets.has(s.dayIndex)),
  };
  return { mealSet, ...ledger.effect() };
}

export function cancelDay(set: MealSet, dayIndex: number, stocks: readonly Stock[], now: Date, newId: IdGenerator): MealSetResult {
  const day = set.days[dayIndex];
  if (!day) return { ok: false, error: 'その日の献立が見つかりません' };
  if (day.status === '作った') return { ok: false, error: '「作った」の献立はキャンセルできません' };
  if (day.status === 'キャンセル') return { ok: false, error: 'すでにキャンセルしています' };
  return { ok: true, change: cancelDays(set, [dayIndex], stocks, now, newId) };
}

/** 献立セット全体をキャンセルする(「作った」の日はそのまま) */
export function cancelSet(set: MealSet, stocks: readonly Stock[], now: Date, newId: IdGenerator): MealSetResult {
  const targets = set.days.flatMap((d, i) => (d.status === '予定' ? [i] : []));
  if (targets.length === 0) return { ok: false, error: 'キャンセルできる献立がありません' };
  return { ok: true, change: cancelDays(set, targets, stocks, now, newId) };
}

/** 1食を「作った」にする */
export function markCooked(set: MealSet, dayIndex: number): MealSetResult {
  const day = set.days[dayIndex];
  if (!day || day.status !== '予定') return { ok: false, error: '「予定」の献立だけ「作った」にできます' };
  const days = set.days.map((d, i) => (i === dayIndex ? { ...d, status: '作った' as const } : d));
  return { ok: true, change: { mealSet: { ...set, days, status: setStatus(days) }, stocks: new Map(), moves: [] } };
}

/** 買い足しリストの1行(食材ごとにまとめたもの) */
export interface ShoppingLine {
  foodId: string;
  /** まだ買っていない不足量の合計 */
  amount: number;
  bought: boolean;
}

/** 食材ごとにまとめた買い足しリスト(キャンセルした日の分は含まない) */
export function shoppingLines(set: MealSet): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine>();
  for (const s of set.shopping) {
    const line = lines.get(s.foodId) ?? { foodId: s.foodId, amount: 0, bought: true };
    if (!s.bought) {
      line.amount = roundAmount(line.amount + s.amount);
      line.bought = false;
    }
    lines.set(s.foodId, line);
  }
  return [...lines.values()];
}

/** 買った量の初期値:辞書の「ふつうの量」。不足量より少なければ不足量 */
export function defaultBoughtAmount(food: Food | undefined, shortage: number): number {
  return Math.max(food?.usualAmount ?? 0, shortage);
}

/**
 * 「買った」:買った量を在庫に足し(購入)、献立で足りなかった分をすぐ引く(夕飯)。
 * 買った量が足りなければ、残りの不足は「まだ買っていない」のまま残す
 */
export function markBought(
  set: MealSet,
  foodId: string,
  boughtAmount: number,
  stocks: readonly Stock[],
  now: Date,
  newId: IdGenerator,
): MealSetResult {
  if (!(boughtAmount > 0)) return { ok: false, error: '買った量は0より大きくしてください' };
  const pending = set.shopping.filter((s) => s.foodId === foodId && !s.bought);
  if (pending.length === 0) return { ok: false, error: '買い足しリストにありません' };

  const ledger = new Ledger(stocks, now, newId, set.id);
  ledger.change(foodId, boughtAmount, '購入');
  const reserved = [...set.reserved];
  const shopping = set.shopping.map((s) => {
    if (s.foodId !== foodId || s.bought) return s;
    const r = ledger.take(foodId, s.amount, s.dayIndex);
    if (r) reserved.push(r);
    const rest = roundAmount(s.amount - (r?.amount ?? 0));
    return rest > 0 ? { ...s, amount: rest } : { ...s, bought: true };
  });
  return { ok: true, change: { mealSet: { ...set, reserved, shopping }, ...ledger.effect() } };
}
