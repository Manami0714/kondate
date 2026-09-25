import { describe, expect, it } from 'vitest';
import type { Stock } from '../db/types';
import { sequentialIds } from './id';
import {
  cancelDay,
  cancelSet,
  confirmPlan,
  defaultBoughtAmount,
  markBought,
  markCooked,
  shoppingLines,
  type MealSetChange,
  type MealSetResult,
  type StockEffect,
} from './mealSet';
import { conditions, days, foodsById, member, plannerData, recipe } from './planner/testing';
import type { PlannedDay } from './planner/types';

const now = new Date(2026, 8, 25, 18, 0, 0);

/** 在庫の影響を在庫の一覧に当てはめる(食材ID順に並べる) */
function apply(stocks: readonly Stock[], effect: StockEffect): Stock[] {
  const map = new Map(stocks.map((s) => [s.foodId, s]));
  for (const [foodId, s] of effect.stocks) {
    if (s) map.set(foodId, s);
    else map.delete(foodId);
  }
  return [...map.values()].sort((a, b) => a.foodId.localeCompare(b.foodId));
}

function ok(r: MealSetResult): MealSetChange {
  if (!r.ok) throw new Error(r.error);
  return r.change;
}

const recipes = [
  recipe('m', '主菜', [['pork_koma', 200, true], ['onion', 1], ['soy_sauce', 2]]),
  recipe('s', '副菜', [['spinach', 1, true], ['mirin', 1]]),
  recipe('p', '汁物', [['tofu', 0.5, true], ['green_onion', 0.2], ['miso', 1]]),
];
const initialStocks: Stock[] = [
  { foodId: 'green_onion', amount: 1, addedDate: '2026-09-20' },
  { foodId: 'onion', amount: 3, addedDate: '2026-09-10' },
  { foodId: 'pork_koma', amount: 250, addedDate: '2026-09-24' },
  { foodId: 'spinach', amount: 1, addedDate: '2026-09-23' },
  { foodId: 'tofu', amount: 1, addedDate: '2026-09-22' },
];
const planned: PlannedDay[] = days(['a', 'b']).map((d) => ({ ...d, mainId: 'm', sideId: 's', soupId: 'p', overLimit: false }));

function confirm(stocks = initialStocks, plan = planned, members = [member('a'), member('b')]) {
  const data = plannerData({ recipes, members, stocks, pantryIds: ['soy_sauce', 'miso'] });
  return confirmPlan({
    id: 'set1',
    startDate: plan[0].date,
    days: plan,
    conditions: conditions('ふつう'),
    guests: [],
    data,
    now,
    newId: sequentialIds('mv'),
  });
}

describe('確定', () => {
  it('在庫にある分だけ減らし、足りない分を日ごとの買い足しに出す。常備調味料は減らさない', () => {
    const c = confirm();
    const after = apply(initialStocks, c);
    // 豚こま:1日200g(2人分)× 3日。在庫250g → 1日目で200、2日目で50使い切り
    expect(after.find((s) => s.foodId === 'pork_koma')).toBeUndefined();
    expect(c.mealSet.shopping).toEqual(
      expect.arrayContaining([
        { dayIndex: 1, foodId: 'pork_koma', amount: 150, bought: false },
        { dayIndex: 2, foodId: 'pork_koma', amount: 200, bought: false },
        { dayIndex: 0, foodId: 'mirin', amount: 1, bought: false },
      ]),
    );
    expect(c.mealSet.shopping.some((s) => s.foodId === 'soy_sauce' || s.foodId === 'miso')).toBe(false);
    expect(c.moves.every((m) => m.reason === '夕飯' && m.mealSetId === 'set1' && m.delta < 0)).toBe(true);
    expect(c.mealSet.days.map((d) => d.status)).toEqual(['予定', '予定', '予定']);
  });

  it('ゲストがいる日だけ多く確保する', () => {
    const guest = member('g', { kind: 'ゲスト' });
    const plan = planned.map((d, i) => (i === 1 ? { ...d, memberIds: ['a', 'b', 'g'] } : d));
    const stocks: Stock[] = [{ foodId: 'onion', amount: 100, addedDate: '2026-09-10' }];
    const c = confirm(stocks, plan, [member('a'), member('b'), guest]);
    const onion = c.mealSet.reserved.filter((r) => r.foodId === 'onion').map((r) => r.amount);
    expect(onion).toEqual([1, 1.5, 1]);
  });
});

describe('キャンセルで確定前とまったく同じ在庫に戻る', () => {
  it('セット全体のキャンセル(使い切って消えた食材も、追加日まで元どおり)', () => {
    const c = confirm();
    const afterConfirm = apply(initialStocks, c);
    const cancel = ok(cancelSet(c.mealSet, afterConfirm, now, sequentialIds('c')));
    expect(apply(afterConfirm, cancel)).toEqual(initialStocks);
    expect(cancel.mealSet.status).toBe('キャンセル');
    expect(cancel.mealSet.reserved).toEqual([]);
    expect(cancel.mealSet.shopping).toEqual([]);
    expect(cancel.moves.every((m) => m.reason === 'キャンセルで戻す' && m.delta > 0)).toBe(true);
  });

  it('1食ずつキャンセルしても、全部戻せば同じ在庫になる', () => {
    const c = confirm();
    let stocks = apply(initialStocks, c);
    let set = c.mealSet;
    for (const dayIndex of [1, 0, 2]) {
      const change = ok(cancelDay(set, dayIndex, stocks, now, sequentialIds(`c${dayIndex}`)));
      stocks = apply(stocks, change);
      set = change.mealSet;
    }
    expect(stocks).toEqual(initialStocks);
  });

  it('1食だけのキャンセルは、その日の分だけ戻り、その日の買い足しが消える', () => {
    const c = confirm();
    const afterConfirm = apply(initialStocks, c);
    const cancel = ok(cancelDay(c.mealSet, 2, afterConfirm, now, sequentialIds('c')));
    const day2 = c.mealSet.reserved.filter((r) => r.dayIndex === 2);
    for (const r of day2) {
      const before = afterConfirm.find((s) => s.foodId === r.foodId)?.amount ?? 0;
      expect(apply(afterConfirm, cancel).find((s) => s.foodId === r.foodId)?.amount).toBeCloseTo(before + r.amount, 3);
    }
    expect(cancel.mealSet.shopping.some((s) => s.dayIndex === 2)).toBe(false);
    expect(cancel.mealSet.days.map((d) => d.status)).toEqual(['予定', '予定', 'キャンセル']);
    expect(cancel.mealSet.status).toBe('予定');
  });

  it('「買った」を挟んでも、キャンセル後は確定前+買った分になる', () => {
    const c = confirm();
    let stocks = apply(initialStocks, c);
    const bought = ok(markBought(c.mealSet, 'pork_koma', 400, stocks, now, sequentialIds('b')));
    stocks = apply(stocks, bought);
    // 不足350g(2日目150+3日目200)を買った400gからすぐ引き、50gが残る
    expect(stocks.find((s) => s.foodId === 'pork_koma')?.amount).toBe(50);
    const cancel = ok(cancelSet(bought.mealSet, stocks, now, sequentialIds('c')));
    // 追加日は、戻した豚こまの方が古いので元の日付になる
    const expected = initialStocks.map((s) => (s.foodId === 'pork_koma' ? { ...s, amount: 650 } : s));
    expect(apply(stocks, cancel)).toEqual(expected);
  });
});

describe('買い足し', () => {
  it('食材ごとにまとめ、買った量の初期値は「ふつうの量」(不足量より少なければ不足量)', () => {
    const c = confirm();
    const lines = shoppingLines(c.mealSet);
    expect(lines.find((l) => l.foodId === 'pork_koma')).toEqual({ foodId: 'pork_koma', amount: 350, bought: false });
    expect(defaultBoughtAmount(foodsById.get('pork_koma'), 350)).toBe(350); // ふつうの量300 < 350
    expect(defaultBoughtAmount(foodsById.get('mirin'), 3)).toBe(60);
  });

  it('買った量で足りなければ、残りの不足は「まだ買っていない」のまま残る', () => {
    const c = confirm();
    const stocks = apply(initialStocks, c);
    const bought = ok(markBought(c.mealSet, 'pork_koma', 200, stocks, now, sequentialIds('b')));
    expect(bought.mealSet.shopping.filter((s) => s.foodId === 'pork_koma')).toEqual([
      { dayIndex: 1, foodId: 'pork_koma', amount: 150, bought: true },
      { dayIndex: 2, foodId: 'pork_koma', amount: 150, bought: false },
    ]);
    expect(shoppingLines(bought.mealSet).find((l) => l.foodId === 'pork_koma')?.amount).toBe(150);
    expect(bought.moves.map((m) => [m.reason, m.delta])).toEqual([
      ['購入', 200],
      ['夕飯', -150],
      ['夕飯', -50],
    ]);
  });

  it('買った量が0以下・リストにない食材はエラー', () => {
    const c = confirm();
    expect(markBought(c.mealSet, 'pork_koma', 0, [], now, sequentialIds()).ok).toBe(false);
    expect(markBought(c.mealSet, 'egg', 1, [], now, sequentialIds()).ok).toBe(false);
  });
});

describe('作った', () => {
  it('「作った」の日はキャンセルできない。全部作ったらセットも「作った」', () => {
    const c = confirm();
    let set = ok(markCooked(c.mealSet, 0)).mealSet;
    expect(cancelDay(set, 0, [], now, sequentialIds()).ok).toBe(false);
    set = ok(markCooked(set, 1)).mealSet;
    set = ok(markCooked(set, 2)).mealSet;
    expect(set.status).toBe('作った');
    expect(markCooked(set, 0).ok).toBe(false);
  });

  it('セット全体のキャンセルは「作った」の日を残す', () => {
    const c = confirm();
    const stocks = apply(initialStocks, c);
    const cooked = ok(markCooked(c.mealSet, 0)).mealSet;
    const cancel = ok(cancelSet(cooked, stocks, now, sequentialIds('c')));
    expect(cancel.mealSet.days.map((d) => d.status)).toEqual(['作った', 'キャンセル', 'キャンセル']);
    expect(cancel.mealSet.status).toBe('作った');
    expect(cancel.mealSet.reserved.every((r) => r.dayIndex === 0)).toBe(true);
  });
});
