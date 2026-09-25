// 初期データの中身のチェック
import { describe, expect, it } from 'vitest';
import { normalizeForSearch } from '../logic/foodSearch';
import { INITIAL_FOODS } from './foods';
import { INITIAL_RECIPES } from './recipes';
import { COOKING_METHODS, FLAVORS } from './tags';

const foodIds = new Set(INITIAL_FOODS.map((f) => f.id));

describe('食材辞書の初期データ', () => {
  it('ID が重複していない', () => {
    expect(foodIds.size).toBe(INITIAL_FOODS.length);
  });

  it('名前・別名が食材どうしで重複していない', () => {
    const seen = new Map<string, string>();
    for (const f of INITIAL_FOODS) {
      for (const n of new Set([f.name, ...f.aliases].map(normalizeForSearch))) {
        expect(seen.get(n), `「${n}」が ${seen.get(n)} と ${f.id} で重複`).toBeUndefined();
        seen.set(n, f.id);
      }
    }
  });

  it('食材は食品グループを持ち、調味料は持たない', () => {
    for (const f of INITIAL_FOODS) {
      if (f.kind === '食材') expect(f.foodGroup, f.id).not.toBeNull();
      else expect(f.foodGroup, f.id).toBeNull();
    }
  });

  it('ふつうの量と保存日数が正の数', () => {
    for (const f of INITIAL_FOODS) {
      expect(f.usualAmount, f.id).toBeGreaterThan(0);
      expect(f.shelfLifeDays, f.id).toBeGreaterThan(0);
    }
  });
});

describe('初期レシピ', () => {
  it('ID が重複していない', () => {
    expect(new Set(INITIAL_RECIPES.map((r) => r.id)).size).toBe(INITIAL_RECIPES.length);
  });

  it('主菜・副菜・汁物がそれぞれ10件前後ある', () => {
    for (const course of ['主菜', '副菜', '汁物'] as const) {
      const n = INITIAL_RECIPES.filter((r) => r.course === course).length;
      expect(n, course).toBeGreaterThanOrEqual(8);
      expect(n, course).toBeLessThanOrEqual(12);
    }
  });

  it('材料がすべて食材辞書にあり、量が正の数', () => {
    for (const r of INITIAL_RECIPES) {
      for (const ing of r.ingredients) {
        expect(foodIds.has(ing.foodId), `${r.name} の ${ing.foodId}`).toBe(true);
        expect(ing.amount, `${r.name} の ${ing.foodId}`).toBeGreaterThan(0);
      }
    }
  });

  it('同じレシピに同じ材料が2回出てこない', () => {
    for (const r of INITIAL_RECIPES) {
      const ids = r.ingredients.map((i) => i.foodId);
      expect(new Set(ids).size, r.name).toBe(ids.length);
    }
  });

  it('タグが固定の一覧の中にある', () => {
    for (const r of INITIAL_RECIPES) {
      for (const m of r.methods) expect(COOKING_METHODS, r.name).toContain(m);
      for (const f of r.flavors) expect(FLAVORS, r.name).toContain(f);
    }
  });

  it('手順があり、出どころは「初期」', () => {
    for (const r of INITIAL_RECIPES) {
      expect(r.steps.length, r.name).toBeGreaterThan(0);
      expect(r.source).toBe('初期');
    }
  });
});
