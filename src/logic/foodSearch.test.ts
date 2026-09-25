import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../data/foods';
import { findFoodByExactName, normalizeForSearch, searchFoods } from './foodSearch';

describe('文字のそろえ方', () => {
  it('半角カナ・ひらがな・空白の違いを吸収する', () => {
    expect(normalizeForSearch('ﾀﾏﾈｷﾞ')).toBe('タマネギ');
    expect(normalizeForSearch('たまねぎ')).toBe('タマネギ');
    expect(normalizeForSearch(' 豚 こま ')).toBe('豚コマ');
  });
});

describe('食材の検索', () => {
  it('別名(半角カナ)でも見つかる', () => {
    expect(searchFoods(INITIAL_FOODS, 'ﾌﾞﾀｺﾏ')[0]?.id).toBe('pork_koma');
  });

  it('ひらがなでもカタカナの食材が見つかる', () => {
    expect(searchFoods(INITIAL_FOODS, 'きゃべつ')[0]?.id).toBe('cabbage');
  });

  it('完全一致が部分一致より先に来る', () => {
    const result = searchFoods(INITIAL_FOODS, 'トマト');
    expect(result[0]?.id).toBe('tomato');
    expect(result.map((f) => f.id)).toContain('cherry_tomato');
  });

  it('空の検索では何も返さない', () => {
    expect(searchFoods(INITIAL_FOODS, '  ')).toEqual([]);
  });

  it('辞書にないものは見つからない', () => {
    expect(searchFoods(INITIAL_FOODS, '洗剤')).toEqual([]);
  });

  it('名前・別名の完全一致で既存の食材を見つける', () => {
    expect(findFoodByExactName(INITIAL_FOODS, '玉子')?.id).toBe('egg');
    expect(findFoodByExactName(INITIAL_FOODS, '玉')).toBeUndefined();
  });
});
