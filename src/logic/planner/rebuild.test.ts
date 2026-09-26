import { describe, expect, it } from 'vitest';
import type { MealSet, MealStatus, Stock } from '../../db/types';
import { sequentialIds } from '../id';
import { cancelDay, cancelSet, confirmPlan, markCooked, refillDay, unmarkCooked, type MealSetChange, type MealSetResult, type StockEffect } from '../mealSet';
import { seededRng } from '../random';
import {
  defaultStartDate,
  isVisibleMealSet,
  nextFreeStartDate,
  overlapMessage,
  overlappingDays,
  overlapsExisting,
} from './days';
import { mainFoodIds } from './mainFoods';
import { makePlan } from './plan';
import { canRebuildDay, otherDayRecipeIds, rebuildRequest } from './rebuild';
import { swapDish } from './swap';
import { conditions, days, fillerSidesAndSoups, foodsById, member, plannerData, recipe } from './testing';
import type { PlannedDay } from './types';

const now = new Date(2026, 8, 30, 18, 0, 0);

function ok(r: MealSetResult): MealSetChange {
  if (!r.ok) throw new Error(r.error);
  return r.change;
}

/** 在庫の影響を在庫の一覧に当てはめる(食材ID順に並べる) */
function apply(stocks: readonly Stock[], effect: StockEffect): Stock[] {
  const map = new Map(stocks.map((s) => [s.foodId, s]));
  for (const [foodId, s] of effect.stocks) {
    if (s) map.set(foodId, s);
    else map.delete(foodId);
  }
  return [...map.values()].sort((a, b) => a.foodId.localeCompare(b.foodId));
}

/** 日ごとの状態を決めた献立セット(日付の重なりを見るだけのもの) */
function setWith(id: string, entries: [string, MealStatus][]): MealSet {
  const statuses = entries.map(([, s]) => s);
  return {
    id,
    startDate: entries[0][0],
    days: entries.map(([date, status]) => ({ date, mainId: 'm', sideId: 's', soupId: 'p', memberIds: ['a'], status })),
    status: statuses.includes('予定') ? '予定' : statuses.includes('作った') ? '作った' : 'キャンセル',
    reserved: [],
    conditions: conditions(),
    guests: [],
    shopping: [],
    overLimitDays: [],
  };
}

describe('日付の重なり(キャンセルは数えない)', () => {
  it('全体をキャンセルしたセットと同じ日付で、新しいセットを作れる', () => {
    const s = setWith('s', [['2026-10-01', 'キャンセル'], ['2026-10-02', 'キャンセル'], ['2026-10-03', 'キャンセル']]);
    expect(overlapsExisting([s], '2026-10-01')).toBe(false);
    expect(defaultStartDate([s], '2026-10-01')).toBe('2026-10-01');
  });

  it('1日だけキャンセルした日から、新しいセットを作れる(ほかの日と重ならなければ)', () => {
    const s = setWith('s', [['2026-09-26', '予定'], ['2026-09-27', '予定'], ['2026-09-28', 'キャンセル']]);
    expect(overlapsExisting([s], '2026-09-28')).toBe(false);
    // 開始日の初期値も、キャンセルした日を数えない
    expect(defaultStartDate([s], '2026-09-26')).toBe('2026-09-28');
  });

  it('キャンセルしていない日と重なるときは作れず、重なった日と状態を知らせ、次に作れる日を返す', () => {
    const s = setWith('s', [['2026-10-01', 'キャンセル'], ['2026-10-02', '作った'], ['2026-10-03', 'キャンセル']]);
    const overlaps = overlappingDays([s], '2026-10-01');
    expect(overlaps.map((d) => [d.date, d.status])).toEqual([['2026-10-02', '作った']]);
    expect(overlapMessage(overlaps)).toBe('10/2(作った)の献立と重なります');
    expect(nextFreeStartDate([s], '2026-10-01')).toBe('2026-10-03');
    // 開始日の初期値は「作った」の日の翌日
    expect(defaultStartDate([s], '2026-09-30')).toBe('2026-10-03');
  });

  it('重なる日が2つ以上あれば並べて出し、次に作れる日は重なりを飛び越えて探す', () => {
    const a = setWith('a', [['2026-10-01', '予定'], ['2026-10-02', '作った'], ['2026-10-03', '予定']]);
    const b = setWith('b', [['2026-10-05', '予定'], ['2026-10-06', '予定'], ['2026-10-07', '予定']]);
    expect(overlapMessage(overlappingDays([a, b], '2026-10-02'))).toBe('10/2(作った)・10/3(予定)の献立と重なります');
    expect(nextFreeStartDate([a, b], '2026-10-01')).toBe('2026-10-08');
    expect(nextFreeStartDate([a, b], '2026-09-28')).toBe('2026-09-28');
  });
});

describe('献立の画面に出すセット', () => {
  it('「予定」の日があるか、今日以降に「作った」の日があるセットを出す。全部キャンセルしたセットは出さない', () => {
    const cookedAhead = setWith('a', [['2026-10-01', 'キャンセル'], ['2026-10-02', '作った'], ['2026-10-03', 'キャンセル']]);
    expect(isVisibleMealSet(cookedAhead, '2026-09-30')).toBe(true);
    expect(isVisibleMealSet(cookedAhead, '2026-10-03')).toBe(false);
    expect(isVisibleMealSet(setWith('b', [['2026-10-01', 'キャンセル'], ['2026-10-02', 'キャンセル']]), '2026-09-30')).toBe(false);
    expect(isVisibleMealSet(setWith('c', [['2026-09-01', '予定']]), '2026-09-30')).toBe(true);
  });
});

describe('「作った」の取り消し', () => {
  it('「予定」に戻り、在庫は動かさない。戻したあとはキャンセルできて在庫が戻る', () => {
    const stocks: Stock[] = [{ foodId: 'pork_koma', amount: 500, addedDate: '2026-09-29' }];
    const data = plannerData({ recipes: [recipe('m', '主菜', [['pork_koma', 100, true]]), ...fillerSidesAndSoups()], members: [member('a')], stocks });
    const planned = days(['a'], '2026-10-01').map((d) => ({ ...d, mainId: 'm', sideId: 'side_a', soupId: 'soup_a', overLimit: false }));
    const confirmed = confirmPlan({ id: 's', startDate: '2026-10-01', days: planned, conditions: conditions(), guests: [], data, now, newId: sequentialIds('c') });
    const afterConfirm = apply(stocks, confirmed);

    const cooked = ok(markCooked(confirmed.mealSet, 1)).mealSet;
    expect(cancelDay(cooked, 1, afterConfirm, now, sequentialIds('x')).ok).toBe(false);

    const undone = ok(unmarkCooked(cooked, 1));
    expect(undone.mealSet.days[1].status).toBe('予定');
    expect(undone.moves).toEqual([]);
    expect(undone.stocks.size).toBe(0);
    expect(unmarkCooked(undone.mealSet, 1).ok).toBe(false); // 「予定」は取り消せない

    const canceled = ok(cancelSet(undone.mealSet, afterConfirm, now, sequentialIds('y')));
    expect(apply(afterConfirm, canceled)).toEqual(stocks);
  });
});

describe('この日の献立を作り直す', () => {
  const recipes = [
    recipe('m_pork', '主菜', [['pork_koma', 150, true]], { favorite: true }),
    recipe('m_salmon', '主菜', [['salmon', 2, true]], { favorite: true }),
    recipe('m_chicken', '主菜', [['chicken_thigh', 200, true]]),
    recipe('m_cabbage', '主菜', [['cabbage', 0.5, true], ['pork_koma', 50]], { favorite: true }),
    recipe('s_cabbage', '副菜', [['cabbage', 0.25, true]], { favorite: true }),
    ...fillerSidesAndSoups(),
  ];
  const stocks: Stock[] = [
    { foodId: 'pork_koma', amount: 400, addedDate: '2026-09-29' },
    { foodId: 'cabbage', amount: 1, addedDate: '2026-09-28' },
    { foodId: 'spinach', amount: 2, addedDate: '2026-09-29' },
  ];
  const members = [member('a')];
  const data = plannerData({ recipes, members, stocks });
  const planned: PlannedDay[] = days(['a'], '2026-10-01').map((d, i) => ({
    ...d,
    ...[
      { mainId: 'm_pork', sideId: 'side_a', soupId: 'soup_a' },
      { mainId: 'm_salmon', sideId: 'side_b', soupId: 'soup_b' },
      { mainId: 'm_chicken', sideId: 'side_c', soupId: 'soup_c' },
    ][i],
    overLimit: false,
  }));
  const confirmed = confirmPlan({ id: 's', startDate: '2026-10-01', days: planned, conditions: conditions(), guests: [], data, now, newId: sequentialIds('c') });
  const stockAfterConfirm = apply(stocks, confirmed);

  /** 例:10/2 を「作った」にしてから「すべてキャンセル」 → 10/1・10/3 はキャンセル、10/2 は作った */
  const cooked = ok(markCooked(confirmed.mealSet, 1)).mealSet;
  const canceled = ok(cancelSet(cooked, stockAfterConfirm, now, sequentialIds('x')));
  const set = canceled.mealSet;
  const stockNow = apply(stockAfterConfirm, canceled);

  it('例の形で、「作った」の前にあるキャンセルした日(10/1)を作り直せる。過ぎた日・ほかのセットが使っている日は作り直せない', () => {
    expect(set.days.map((d) => d.status)).toEqual(['キャンセル', '作った', 'キャンセル']);
    expect(canRebuildDay(set, 0, [set], '2026-09-30')).toBe(true);
    expect(canRebuildDay(set, 1, [set], '2026-09-30')).toBe(false); // 作った
    expect(canRebuildDay(set, 0, [set], '2026-10-02')).toBe(false); // 過ぎた日
    const other = setWith('other', [['2026-10-03', '予定'], ['2026-10-04', '予定'], ['2026-10-05', '予定']]);
    expect(canRebuildDay(set, 2, [set, other], '2026-09-30')).toBe(false); // 10/3 から新しいセットを作った
  });

  it('作り直した日は、同じ日の中で主な材料がかぶらず、ほかの日と同じレシピを使わない', () => {
    // 10/2 の「作った」の料理(m_salmon など)は使えない
    expect(otherDayRecipeIds(set, 0)).toEqual(['m_salmon', 'side_b', 'soup_b']);
    const request = rebuildRequest(set, 0, members, conditions(), []);
    expect(request.days).toEqual([{ date: '2026-10-01', memberIds: ['a'] }]);
    const rebuildData = { ...data, stocks: stockNow };
    for (const seed of Array.from({ length: 20 }, (_, i) => i + 1)) {
      const r = makePlan(request, rebuildData, seededRng(seed));
      if (!r.ok) throw new Error(r.error);
      const day = r.days[0];
      const ids = [day.mainId, day.sideId, day.soupId];
      expect(ids).not.toContain('m_salmon');
      expect(ids).not.toContain('side_b');
      expect(ids).not.toContain('soup_b');
      const mains = ids.flatMap((id) => mainFoodIds(recipes.find((x) => x.id === id)!, foodsById));
      expect(new Set(mains).size).toBe(mains.length);
    }
  });

  it('入れ替えでも、ほかの日で使っているレシピは出ない', () => {
    const request = rebuildRequest(set, 0, members, conditions(), []);
    const current: PlannedDay[] = [{ date: '2026-10-01', memberIds: ['a'], mainId: 'm_pork', sideId: 'side_a', soupId: 'soup_a', overLimit: false }];
    const r = swapDish(request, data, current, 0, 'mainId', ['m_chicken', 'm_cabbage']);
    // 残る主菜は 10/2 の m_salmon だけなので、候補がない
    expect(r.ok).toBe(false);
  });

  it('確定するとその日が「予定」に戻り、在庫が減って買い足しに入る。その日をキャンセルすると確定前とまったく同じ在庫に戻る', () => {
    const day: PlannedDay = { date: '2026-10-01', memberIds: ['a'], mainId: 'm_cabbage', sideId: 'side_a', soupId: 'soup_a', overLimit: true };
    const refilled = ok(refillDay({ set, dayIndex: 0, day, data: { ...data, stocks: stockNow }, now, newId: sequentialIds('r') }));
    const m = refilled.mealSet;
    expect(m.days[0]).toMatchObject({ mainId: 'm_cabbage', sideId: 'side_a', soupId: 'soup_a', status: '予定' });
    expect(m.days[1].status).toBe('作った');
    expect(m.status).toBe('予定');
    expect(m.overLimitDays).toEqual([0]);

    const stockAfterRefill = apply(stockNow, refilled);
    // キャベツ・豚こま・ほうれん草は在庫から減る
    expect(stockAfterRefill.find((s) => s.foodId === 'cabbage')?.amount).toBeLessThan(1);
    expect(refilled.moves.every((mv) => mv.reason === '夕飯' && mv.mealSetId === 's')).toBe(true);
    // 在庫にないわかめは、その日の買い足しに入る
    expect(m.shopping.filter((s) => s.dayIndex === 0).map((s) => s.foodId)).toContain('wakame');

    const canceledAgain = ok(cancelDay(m, 0, stockAfterRefill, now, sequentialIds('z')));
    expect(apply(stockAfterRefill, canceledAgain)).toEqual(stockNow);
    expect(canceledAgain.mealSet.shopping.filter((s) => s.dayIndex === 0)).toEqual([]);
  });

  it('キャンセルしていない日や、日付の違う提案では埋めない', () => {
    const day: PlannedDay = { date: '2026-10-02', memberIds: ['a'], mainId: 'm_pork', sideId: 'side_a', soupId: 'soup_a', overLimit: false };
    expect(refillDay({ set, dayIndex: 1, day, data, now, newId: sequentialIds('r') }).ok).toBe(false);
    expect(refillDay({ set, dayIndex: 0, day, data, now, newId: sequentialIds('r') }).ok).toBe(false);
  });
});
