import { describe, expect, it } from 'vitest';
import { ENERGY_TABLE } from '../data/energyTable';
import { INITIAL_RECIPES } from '../data/recipes';
import type { Appetite, Sex } from '../db/types';
import { autoPortion, energyRowFor, estimatedEnergy, formatDayTotal, portionOf, scaleIngredients, totalPortion } from './portion';

const person = (sex: Sex, age: number, appetite: Appetite = 'ふつう', portionOverride: number | null = null) => ({
  sex,
  age,
  appetite,
  portionOverride,
});

describe('推定エネルギー必要量の表', () => {
  it('年齢の低い順で、区分の境目の年齢で次の行になる', () => {
    for (let i = 1; i < ENERGY_TABLE.length; i++) expect(ENERGY_TABLE[i].minAge).toBeGreaterThan(ENERGY_TABLE[i - 1].minAge);
    expect(energyRowFor(29).label).toBe('18〜29歳');
    expect(energyRowFor(30).label).toBe('30〜49歳');
    expect(energyRowFor(0).label).toBe('0歳(6〜8か月の値)');
    expect(energyRowFor(100).label).toBe('75歳以上');
  });

  it('照合で直した値(女性18〜29歳、0歳は6〜8か月の値)', () => {
    expect(estimatedEnergy('女性', 25)).toBe(1950);
    expect([estimatedEnergy('男性', 0), estimatedEnergy('女性', 0)]).toEqual([650, 600]);
  });

  it('報告書から読み取れた6〜17歳の値と一致する', () => {
    expect([6, 8, 10, 12, 15].map((a) => [estimatedEnergy('男性', a), estimatedEnergy('女性', a)])).toEqual([
      [1550, 1450],
      [1850, 1700],
      [2250, 2100],
      [2600, 2400],
      [2850, 2300],
    ]);
  });
});

describe('1人分の倍率', () => {
  it('女性30〜49歳・ふつうが1.0倍', () => {
    expect(autoPortion('女性', 30, 'ふつう')).toBe(1);
    expect(autoPortion('女性', 49, 'ふつう')).toBe(1);
  });

  it('年齢・性別で変わる(表の値 ÷ 2050)', () => {
    expect(autoPortion('男性', 40, 'ふつう')).toBe(1.341); // 2750 / 2050
    expect(autoPortion('女性', 80, 'ふつう')).toBe(0.854); // 1750 / 2050
  });

  it('少なめは0.8倍、多めは1.2倍をかける', () => {
    expect(autoPortion('女性', 35, '少なめ')).toBe(0.8);
    expect(autoPortion('女性', 35, '多め')).toBe(1.2);
    expect(autoPortion('男性', 14, '多め')).toBe(1.522); // 2600 / 2050 × 1.2
  });

  it('手で入れた倍率があればそちらを優先する', () => {
    expect(portionOf(person('男性', 40, '多め', 0.7))).toBe(0.7);
    expect(portionOf(person('男性', 40, '多め'))).toBe(1.61);
  });

  it('その日のメンバーの倍率を合計する', () => {
    expect(totalPortion([person('女性', 40), person('女性', 40, '少なめ'), person('男性', 10, 'ふつう', 0.5)])).toBe(2.3);
    expect(totalPortion([])).toBe(0);
  });
});

describe('材料の量', () => {
  it('基準の人数で割って合計倍率をかける', () => {
    const nikujaga = INITIAL_RECIPES.find((r) => r.id === 'init_nikujaga');
    if (!nikujaga) throw new Error('肉じゃががない');
    const scaled = scaleIngredients(nikujaga, 3); // 2人分 → 3倍分
    expect(scaled.find((i) => i.foodId === 'beef_koma')?.amount).toBe(225);
    expect(scaled.find((i) => i.foodId === 'potato')?.amount).toBe(4.5);
    expect(scaled.find((i) => i.foodId === 'potato')?.main).toBe(true);
  });
});

describe('この日の合計の表示と量', () => {
  const a = { ...person('女性', 25, '多め'), name: 'A' }; // 1950 / 2050 × 1.2 ≒ 1.141
  const b = { ...person('女性', 80), name: 'B' }; // 1750 / 2050 ≒ 0.854

  it('多めの女性18〜29歳は約1.14倍。1人だけの日は1.14人分の量になる', () => {
    expect(portionOf(a)).toBe(1.141);
    const nikujaga = INITIAL_RECIPES.find((r) => r.id === 'init_nikujaga');
    if (!nikujaga) throw new Error('肉じゃががない');
    // 牛こま 150g(2人分)→ 1人分75g × 1.141
    expect(scaleIngredients(nikujaga, totalPortion([a])).find((i) => i.foodId === 'beef_koma')?.amount).toBe(85.575);
  });

  it('2人の合計がほぼ2倍なら、量もほぼ2人分になる。内訳で見分けられる', () => {
    expect(totalPortion([a, b])).toBe(1.995);
    expect(formatDayTotal([a, b])).toBe('この日の合計:2人分(A 1.14倍・B 0.85倍)');
    expect(formatDayTotal([a])).toBe('この日の合計:1.14人分(A 1.14倍)');
  });
});
