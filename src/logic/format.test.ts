import { describe, expect, it } from 'vitest';
import { parseAmount } from './forms';
import { amountToInput, formatAmount, formatStockAmount, STOCK_MOVE_REASON_LABELS } from './format';

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

describe('日付の表示', () => {
  it('曜日つき', async () => {
    const { formatDayLabel } = await import('./date');
    expect(formatDayLabel('2026-09-25')).toBe('9/25(金)');
    expect(formatDayLabel('2026-09-27')).toBe('9/27(日)');
  });
});

describe('計算した量の表示', () => {
  it('g・ml は整数、そのほかは 1/4 きざみ。0 にはしない', async () => {
    const { formatApproxAmount } = await import('./format');
    expect(formatApproxAmount(11.34, 'g')).toBe('11g');
    expect(formatApproxAmount(0.2, 'g')).toBe('1g');
    expect(formatApproxAmount(1.13, '大さじ')).toBe('1と1/4大さじ');
    expect(formatApproxAmount(2.27, '切れ')).toBe('2と1/4切れ');
    expect(formatApproxAmount(0.11, '小さじ')).toBe('1/4小さじ');
    expect(formatApproxAmount(3, '個')).toBe('3個');
  });
});

describe('在庫の量の表示', () => {
  it('1単位あたりの重さがある食材は、重さも添える', () => {
    expect(formatStockAmount(2, { unit: '袋', gramsPerUnit: 100 })).toBe('2袋(約200g)');
    expect(formatStockAmount(0.32, { unit: '枚', gramsPerUnit: 250 })).toBe('0.32枚(約80g)');
    expect(formatStockAmount(1.5, { unit: '本', gramsPerUnit: 150 })).toBe('1と1/2本(約225g)');
  });

  it('重さがない食材と、g・ml の食材はそのまま', () => {
    expect(formatStockAmount(2, { unit: '袋', gramsPerUnit: null })).toBe('2袋');
    expect(formatStockAmount(300, { unit: 'g', gramsPerUnit: null })).toBe('300g');
  });
});

describe('在庫の動きの理由の表示名', () => {
  it('「昼食」は「献立以外」と表示し、ほかはそのまま', () => {
    expect(STOCK_MOVE_REASON_LABELS['昼食']).toBe('献立以外');
    expect(STOCK_MOVE_REASON_LABELS['整理で削除']).toBe('整理で削除');
  });
});
