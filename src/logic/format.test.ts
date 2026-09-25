import { describe, expect, it } from 'vitest';
import { parseAmount } from './forms';
import { amountToInput, formatAmount } from './format';

describe('量の表示', () => {
  it.each([
    [0.25, '個', '1/4個'],
    [1.5, '本', '1と1/2本'],
    [3, '個', '3個'],
    [0.5, 'g', '0.5g'],
    [250, 'g', '250g'],
    [0.1, '本', '0.1本'],
  ])('%d%s は「%s」', (amount, unit, expected) => {
    expect(formatAmount(amount, unit)).toBe(expected);
  });

  it('入力欄用の文字は、読み取ると元の数字に戻る', () => {
    for (const v of [0.25, 1.5, 2, 0.1, 1 / 3, 250]) {
      expect(parseAmount(amountToInput(v))).toBeCloseTo(v, 3);
    }
  });
});
