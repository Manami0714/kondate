import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../data/foods';
import type { Stock } from '../db/types';
import { sequentialIds } from './id';
import { addStock, changeStock, isPastShelfLife, removeStock, setStockAmount, tidyUpStocks } from './stock';

// テスト用の固定の日付(地域時刻で作る)
const day1 = new Date(2026, 8, 25, 10, 0, 0);
const day2 = new Date(2026, 8, 27, 18, 30, 0);
const day3 = new Date(2026, 9, 1, 9, 0, 0);

describe('在庫の追加', () => {
  it('在庫がない食材を追加すると、今日の日付で在庫ができ、「購入」の動きが残る', () => {
    const r = addStock(null, 'egg', 10, day1, sequentialIds());
    expect(r.stock).toEqual({ foodId: 'egg', amount: 10, addedDate: '2026-09-25' });
    expect(r.move).toEqual({
      id: 'id-1',
      at: day1.toISOString(),
      foodId: 'egg',
      delta: 10,
      reason: '購入',
      mealSetId: null,
    });
  });

  it('在庫が残っているうちに買い足しても、追加日は変わらない', () => {
    const current: Stock = { foodId: 'egg', amount: 3, addedDate: '2026-09-25' };
    const r = addStock(current, 'egg', 10, day2, sequentialIds());
    expect(r.stock).toEqual({ foodId: 'egg', amount: 13, addedDate: '2026-09-25' });
    expect(r.move?.delta).toBe(10);
  });

  it('0になって消えたあとに再び追加すると、新しい日付になる', () => {
    const ids = sequentialIds();
    const first = addStock(null, 'egg', 2, day1, ids);
    const gone = changeStock({ current: first.stock, foodId: 'egg', delta: -2, reason: '夕飯', now: day2, newId: ids });
    expect(gone.stock).toBeNull();
    const again = addStock(gone.stock, 'egg', 6, day3, ids);
    expect(again.stock?.addedDate).toBe('2026-10-01');
  });

  it('0以下の量は追加できない', () => {
    expect(() => addStock(null, 'egg', 0, day1, sequentialIds())).toThrow();
    expect(() => addStock(null, 'egg', -1, day1, sequentialIds())).toThrow();
  });
});

describe('在庫の減少と手直し', () => {
  it('減らすと量が減り、動きには負の数が残る', () => {
    const current: Stock = { foodId: 'cabbage', amount: 1, addedDate: '2026-09-25' };
    const r = changeStock({ current, foodId: 'cabbage', delta: -0.25, reason: '昼食', now: day2, newId: sequentialIds() });
    expect(r.stock).toEqual({ foodId: 'cabbage', amount: 0.75, addedDate: '2026-09-25' });
    expect(r.move?.delta).toBe(-0.25);
    expect(r.move?.reason).toBe('昼食');
  });

  it('0になったら在庫から消える', () => {
    const current: Stock = { foodId: 'cabbage', amount: 0.5, addedDate: '2026-09-25' };
    const r = changeStock({ current, foodId: 'cabbage', delta: -0.5, reason: '夕飯', now: day2, newId: sequentialIds() });
    expect(r.stock).toBeNull();
    expect(r.move?.delta).toBe(-0.5);
  });

  it('在庫より多く減らしても0で止まり、動きには実際に減った量が残る', () => {
    const current: Stock = { foodId: 'egg', amount: 2, addedDate: '2026-09-25' };
    const r = changeStock({ current, foodId: 'egg', delta: -5, reason: '夕飯', now: day2, newId: sequentialIds() });
    expect(r.stock).toBeNull();
    expect(r.move?.delta).toBe(-2);
  });

  it('量を手で直すと「手直し」として差分が残り、追加日は変わらない', () => {
    const current: Stock = { foodId: 'egg', amount: 10, addedDate: '2026-09-25' };
    const r = setStockAmount(current, 'egg', 7, day2, sequentialIds());
    expect(r.stock).toEqual({ foodId: 'egg', amount: 7, addedDate: '2026-09-25' });
    expect(r.move).toMatchObject({ delta: -3, reason: '手直し' });
  });

  it('同じ量に直したときは動きを残さない', () => {
    const current: Stock = { foodId: 'egg', amount: 10, addedDate: '2026-09-25' };
    const r = setStockAmount(current, 'egg', 10, day2, sequentialIds());
    expect(r.stock).toBe(current);
    expect(r.move).toBeNull();
  });

  it('削除すると在庫が消え、残っていた量がすべて減った動きが残る', () => {
    const current: Stock = { foodId: 'egg', amount: 4, addedDate: '2026-09-25' };
    const r = removeStock(current, day2, sequentialIds());
    expect(r.stock).toBeNull();
    expect(r.move).toMatchObject({ delta: -4, reason: '手直し' });
  });

  it('小数の誤差が出ない(0.1 + 0.2 = 0.3)', () => {
    const ids = sequentialIds();
    const a = addStock(null, 'x', 0.1, day1, ids);
    const b = addStock(a.stock, 'x', 0.2, day1, ids);
    expect(b.stock?.amount).toBe(0.3);
  });

  it('在庫の動きを逆に足すと、元の量に戻る', () => {
    const ids = sequentialIds();
    const start: Stock = { foodId: 'egg', amount: 3, addedDate: '2026-09-25' };
    const used = changeStock({ current: start, foodId: 'egg', delta: -5, reason: '夕飯', now: day2, newId: ids });
    const back = changeStock({
      current: used.stock,
      foodId: 'egg',
      delta: -(used.move?.delta ?? 0),
      reason: 'キャンセルで戻す',
      now: day2,
      newId: ids,
    });
    expect(back.stock?.amount).toBe(3);
  });
});

describe('キャンセルで戻すときの追加日', () => {
  const now = new Date(2026, 8, 25, 12, 0, 0);
  it('0から戻すときは元の追加日にし、残っている在庫より古ければ古い方にする', () => {
    const ids = sequentialIds();
    const fromZero = changeStock({ current: null, foodId: 'egg', delta: 2, reason: 'キャンセルで戻す', now, newId: ids, restoreAddedDate: '2026-09-20' });
    expect(fromZero.stock?.addedDate).toBe('2026-09-20');
    const older = changeStock({
      current: { foodId: 'egg', amount: 5, addedDate: '2026-09-24' },
      foodId: 'egg',
      delta: 2,
      reason: 'キャンセルで戻す',
      now,
      newId: ids,
      restoreAddedDate: '2026-09-20',
    });
    expect(older.stock?.addedDate).toBe('2026-09-20');
    const newer = changeStock({
      current: { foodId: 'egg', amount: 5, addedDate: '2026-09-18' },
      foodId: 'egg',
      delta: 2,
      reason: 'キャンセルで戻す',
      now,
      newId: ids,
      restoreAddedDate: '2026-09-20',
    });
    expect(newer.stock?.addedDate).toBe('2026-09-18');
  });
});

describe('在庫の整理', () => {
  const egg = INITIAL_FOODS.find((f) => f.id === 'egg')!; // 保存の目安 14日

  it('保存の目安は、追加日+目安日数の日までは過ぎておらず、その翌日から過ぎている', () => {
    const stock: Stock = { foodId: 'egg', amount: 6, addedDate: '2026-09-20' };
    expect(isPastShelfLife(stock, egg, '2026-10-04')).toBe(false);
    expect(isPastShelfLife(stock, egg, '2026-10-05')).toBe(true);
  });

  it('選んだ食材だけを在庫から消し、「整理で削除」の動きを残す。在庫にない食材と、2回選んだ食材は1回だけ扱う', () => {
    const stocks: Stock[] = [
      { foodId: 'egg', amount: 6, addedDate: '2026-09-20' },
      { foodId: 'onion', amount: 2.5, addedDate: '2026-09-10' },
      { foodId: 'milk', amount: 500, addedDate: '2026-09-24' },
    ];
    const result = tidyUpStocks(stocks, ['egg', 'onion', 'egg', 'cabbage'], day3, sequentialIds('t'));
    expect(result.map((r) => [r.foodId, r.change.stock])).toEqual([
      ['egg', null],
      ['onion', null],
    ]);
    expect(result.map((r) => [r.change.move?.delta, r.change.move?.reason])).toEqual([
      [-6, '整理で削除'],
      [-2.5, '整理で削除'],
    ]);
  });
});
