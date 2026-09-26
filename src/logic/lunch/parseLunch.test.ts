import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../../data/foods';
import type { Food, Stock } from '../../db/types';
import { withAlias } from '../aliases';
import { parseLunch } from './parseLunch';

const stocks: Stock[] = [
  { foodId: 'egg', amount: 10, addedDate: '2026-09-20' },
  { foodId: 'cabbage', amount: 1, addedDate: '2026-09-20' },
  { foodId: 'pork_koma', amount: 250, addedDate: '2026-09-24' },
];

describe('昼食の口頭入力', () => {
  it('「昼に卵2個とキャベツ半分使った」→ 卵2個・キャベツ0.5個', () => {
    const r = parseLunch('昼に卵2個とキャベツ半分使った', INITIAL_FOODS, stocks);
    expect(r.items).toEqual([
      { foodId: 'egg', amount: 2, note: null, stockAmount: 10 },
      { foodId: 'cabbage', amount: 0.5, note: null, stockAmount: 1 },
    ]);
    expect(r.unread).toEqual([]);
  });

  it('朝ごはん・お弁当などの言い方も取り除いて読む(「食材を使った」)', () => {
    const r = parseLunch('朝に卵2個、お弁当にキャベツ半分使った', INITIAL_FOODS, stocks);
    expect(r.items.map((i) => [i.foodId, i.amount])).toEqual([
      ['egg', 2],
      ['cabbage', 0.5],
    ]);
    expect(r.unread).toEqual([]);
  });

  it('食材ごとのほかの数え方で換算する(キャベツ2枚=0.2個、鶏もも肉1枚=250g、大根5cm=0.15本)', () => {
    const r = parseLunch('キャベツ2枚と鶏もも肉1枚と大根5cm使った', INITIAL_FOODS, stocks);
    expect(r.items.map((i) => [i.foodId, i.amount, i.note])).toEqual([
      ['cabbage', 0.2, 'alt-unit'],
      ['chicken_thigh', 250, 'alt-unit'],
      ['daikon', 0.15, 'alt-unit'],
    ]);
  });

  it('ほかの数え方がない食材は、今まで通り(卵2枚は卵のふつうの量)', () => {
    const r = parseLunch('卵2枚', INITIAL_FOODS, stocks);
    expect(r.items.map((i) => [i.foodId, i.amount, i.note])).toEqual([['egg', 20, 'unit-mismatch']]);
  });

  it('g の食材の「半分」は在庫の半分、「少し」はふつうの量の1割', () => {
    const r = parseLunch('豚こま半分と卵少し', INITIAL_FOODS, stocks);
    expect(r.items.map((i) => [i.foodId, i.amount])).toEqual([
      ['pork_koma', 125],
      ['egg', 1],
    ]);
  });

  it('量がなければふつうの量(注意つき)。在庫がない食材は在庫0として返す', () => {
    const r = parseLunch('ほうれん草を使った', INITIAL_FOODS, stocks);
    expect(r.items).toEqual([{ foodId: 'spinach', amount: 1, note: 'no-amount', stockAmount: 0 }]);
  });

  it('同じ食材が2回出たら量を足す', () => {
    const r = parseLunch('卵1個と、あと卵2個', INITIAL_FOODS, stocks);
    expect(r.items).toEqual([{ foodId: 'egg', amount: 3, note: null, stockAmount: 10 }]);
    expect(r.unread).toEqual([]);
  });

  it('食材が見つからなかった言葉を、量と一緒に返す', () => {
    const r = parseLunch('お昼に卵1個とパセリ少し使いました', INITIAL_FOODS, stocks);
    expect(r.items.map((i) => i.foodId)).toEqual(['egg']);
    expect(r.unread).toEqual([{ word: 'パセリ', quantity: { kind: 'little' } }]);
  });

  it('読めなかった言葉を別名に足すと、次から読める', () => {
    const first = parseLunch('たまご2個とエッグ1個', INITIAL_FOODS, stocks);
    expect(first.unread.map((u) => u.word)).toEqual(['エッグ']);
    const egg = INITIAL_FOODS.find((f) => f.id === 'egg') as Food;
    const updated = withAlias(egg, 'エッグ', INITIAL_FOODS) as Food;
    const foods = INITIAL_FOODS.map((f) => (f.id === 'egg' ? updated : f));
    const second = parseLunch('たまご2個とエッグ1個', foods, stocks);
    expect(second.items).toEqual([{ foodId: 'egg', amount: 3, note: null, stockAmount: 10 }]);
    expect(second.unread).toEqual([]);
  });
});

describe('別名の追加', () => {
  const egg = INITIAL_FOODS.find((f) => f.id === 'egg') as Food;

  it('新しい言葉なら別名に足す', () => {
    expect(withAlias(egg, ' エッグ ', INITIAL_FOODS)?.aliases).toEqual([...egg.aliases, 'エッグ']);
  });

  it('すでにどれかの名前・別名なら足さない(ひらがな・カタカナの違いも同じとみなす)', () => {
    expect(withAlias(egg, 'タマゴ', INITIAL_FOODS)).toBeNull();
    expect(withAlias(egg, 'きゃべつ', INITIAL_FOODS)).toBeNull();
    expect(withAlias(egg, '  ', INITIAL_FOODS)).toBeNull();
  });
});
