import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../../data/foods';
import { foodsById } from '../planner/testing';
import { findQuantities, readQuantity, toFoodAmount } from './amount';
import { cleanText, toMatchForm } from './normalize';
import { findSpans, foodTerms } from './spans';

const food = (id: string) => {
  const f = foodsById.get(id);
  if (!f) throw new Error(id);
  return f;
};
const q = (text: string) => readQuantity(toMatchForm(cleanText(text)));

describe('文字をそろえる', () => {
  it('半角カナを全角に、全角数字を半角に、空白を1つに', () => {
    expect(cleanText(' ﾀﾏｺﾞ　１０ｺ  ')).toBe('タマゴ 10コ');
  });

  it('比べる形はひらがなをカタカナにし、文字数は変わらない', () => {
    const clean = cleanText('たまごとキャベツ');
    expect(toMatchForm(clean)).toBe('タマゴトキャベツ');
    expect(toMatchForm(clean).length).toBe(clean.length);
  });
});

describe('食材の位置を探す', () => {
  const terms = foodTerms(INITIAL_FOODS);
  const names = (text: string) => findSpans(toMatchForm(cleanText(text)), terms).map((s) => s.value.name);

  it('名前と別名(ひらがな・半角カナも)で見つかる', () => {
    expect(names('昼に卵2個とキャベツ半分使った')).toEqual(['卵', 'キャベツ']);
    expect(names('たまごとｷｬﾍﾞﾂ')).toEqual(['卵', 'キャベツ']);
  });

  it('長い言葉を優先し、重なる短い言葉は捨てる', () => {
    // 「豚ひき肉」の中の「豚ひき」、「ミニトマト」の中の「トマト」は数えない
    expect(names('豚ひき肉とミニトマト')).toEqual(['豚ひき肉', 'ミニトマト']);
  });
});

describe('量を読む', () => {
  it('数と単位', () => {
    expect(q('2個')).toEqual({ kind: 'number', value: 2, unit: '個' });
    expect(q('300g')).toEqual({ kind: 'number', value: 300, unit: 'g' });
    expect(q('5kg')).toEqual({ kind: 'number', value: 5000, unit: 'g' });
    expect(q('200g×2')).toEqual({ kind: 'number', value: 400, unit: 'g' });
    expect(q('10ｺ')).toEqual({ kind: 'number', value: 10, unit: '個' });
    expect(q('1/4カット')).toEqual({ kind: 'number', value: 0.25, unit: null });
    expect(q('1個半')).toEqual({ kind: 'number', value: 1.5, unit: '個' });
    expect(q('ふたつ')).toEqual({ kind: 'number', value: 2, unit: null });
    expect(q('2つ')).toEqual({ kind: 'number', value: 2, unit: '個' });
    expect(q('三本')).toEqual({ kind: 'number', value: 3, unit: '本' });
  });

  it('量の言葉', () => {
    expect(q('半分')).toEqual({ kind: 'half' });
    expect(q('少し')).toEqual({ kind: 'little' });
    expect(q('ちょっと')).toEqual({ kind: 'little' });
    expect(q('残り全部')).toEqual({ kind: 'all' });
  });

  it('量がなければ null', () => {
    expect(q('使った')).toBeNull();
  });

  it('前から順に全部見つける', () => {
    expect(findQuantities(toMatchForm('16個216g')).map((m) => m.quantity)).toEqual([
      { kind: 'number', value: 16, unit: '個' },
      { kind: 'number', value: 216, unit: 'g' },
    ]);
  });
});

describe('辞書の単位にする', () => {
  it('単位が同じ・単位なしはそのまま。「個」は数える単位に合わせる', () => {
    expect(toFoodAmount({ kind: 'number', value: 2, unit: '個' }, food('egg'), 10)).toEqual({ amount: 2, note: null });
    expect(toFoodAmount({ kind: 'number', value: 2, unit: null }, food('carrot'), 0)).toEqual({ amount: 2, note: null });
    expect(toFoodAmount({ kind: 'number', value: 2, unit: '個' }, food('carrot'), 0)).toEqual({ amount: 2, note: null });
  });

  it('半分:数える単位は1つの半分、g は在庫の半分', () => {
    expect(toFoodAmount({ kind: 'half' }, food('cabbage'), 1)).toEqual({ amount: 0.5, note: null });
    expect(toFoodAmount({ kind: 'half' }, food('pork_koma'), 250)).toEqual({ amount: 125, note: null });
    // 在庫がなければふつうの量(300g)の半分
    expect(toFoodAmount({ kind: 'half' }, food('pork_koma'), 0)).toEqual({ amount: 150, note: null });
  });

  it('少しはふつうの量の1割、全部は在庫', () => {
    expect(toFoodAmount({ kind: 'little' }, food('pork_koma'), 250)).toEqual({ amount: 30, note: null });
    expect(toFoodAmount({ kind: 'all' }, food('pork_koma'), 250)).toEqual({ amount: 250, note: null });
  });

  it('量がない・単位が違うときはふつうの量(注意つき)', () => {
    expect(toFoodAmount(null, food('egg'), 0)).toEqual({ amount: 10, note: 'no-amount' });
    // 人参 500g(辞書は本、ふつうの量3本)
    expect(toFoodAmount({ kind: 'number', value: 500, unit: 'g' }, food('carrot'), 0)).toEqual({ amount: 3, note: 'unit-mismatch' });
    // 豚こま 2パック(辞書は g、ふつうの量300g)
    expect(toFoodAmount({ kind: 'number', value: 2, unit: 'パック' }, food('pork_koma'), 0)).toEqual({ amount: 600, note: 'unit-mismatch' });
  });
});
