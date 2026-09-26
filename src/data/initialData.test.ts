// 初期データの中身のチェック
import { describe, expect, it } from 'vitest';
import { normalizeForSearch } from '../logic/foodSearch';
import { INITIAL_FOODS } from './foods';
import { INITIAL_RECIPES } from './recipes';
import { canBeMain } from '../logic/planner/mainFoods';
import { ALLERGENS } from './allergens';
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

  it('アレルギー物質は29品目の中から、重複なし', () => {
    expect(ALLERGENS.length).toBe(29);
    for (const f of INITIAL_FOODS) {
      for (const a of f.allergens) expect(ALLERGENS, f.id).toContain(a);
      expect(new Set(f.allergens).size, f.id).toBe(f.allergens.length);
    }
  });

  it('要確認の印は顆粒だし・サラダ油・ケチャップ・キムチ', () => {
    expect(INITIAL_FOODS.filter((f) => f.allergenUncertain).map((f) => f.id).sort()).toEqual(['dashi', 'ketchup', 'kimchi', 'salad_oil']);
  });

  it('薬味は食材だけ', () => {
    for (const f of INITIAL_FOODS) if (f.isCondiment) expect(f.kind, f.id).toBe('食材');
    expect(INITIAL_FOODS.filter((f) => f.isCondiment).map((f) => f.name)).toEqual(
      expect.arrayContaining(['長ねぎ', 'しょうが', 'にんにく', '大葉']),
    );
  });

  it('1単位あたりの重さ:g・ml・調味料以外の食材にはすべて目安があり、正の数', () => {
    for (const f of INITIAL_FOODS) {
      if (f.unit === 'g' || f.unit === 'ml' || f.kind === '調味料') expect(f.gramsPerUnit, f.name).toBeNull();
      else expect(f.gramsPerUnit, f.name).toBeGreaterThan(0);
    }
    expect(INITIAL_FOODS.find((f) => f.id === 'konnyaku')?.gramsPerUnit).toBe(250);
  });

  it('ほかの数え方:辞書の単位と違う単位で、量が正の数、同じ単位が2回ない', () => {
    for (const f of INITIAL_FOODS) {
      const units = f.altUnits.map((a) => a.unit);
      expect(new Set(units).size, f.name).toBe(units.length);
      for (const a of f.altUnits) {
        expect(a.unit, f.name).not.toBe(f.unit);
        expect(a.amount, f.name).toBeGreaterThan(0);
      }
    }
    expect(INITIAL_FOODS.find((f) => f.id === 'shiitake')?.altUnits).toEqual([{ unit: '枚', amount: 1 }]);
  });

  it('干ししいたけは、しいたけとは別の食材(枚、保存180日、アレルギー物質なし、要確認なし)', () => {
    expect(INITIAL_FOODS.find((f) => f.id === 'dried_shiitake')).toMatchObject({
      name: '干ししいたけ',
      unit: '枚',
      usualAmount: 10,
      foodGroup: '緑',
      shelfLifeDays: 180,
      allergens: [],
      allergenUncertain: false,
      isCondiment: false,
      gramsPerUnit: 3,
    });
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

  it('主菜・副菜・汁物がそれぞれ50件以上ある(追加2回目まで)', () => {
    for (const course of ['主菜', '副菜', '汁物'] as const) {
      expect(INITIAL_RECIPES.filter((r) => r.course === course).length, course).toBeGreaterThanOrEqual(50);
    }
  });

  it('料理名が重複していない', () => {
    const names = INITIAL_RECIPES.map((r) => r.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
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

  it('主な材料が1〜2個あり、薬味・調味料ではない', () => {
    const byId = new Map(INITIAL_FOODS.map((f) => [f.id, f]));
    for (const r of INITIAL_RECIPES) {
      const mains = r.ingredients.filter((i) => i.main);
      expect(mains.length, r.name).toBeGreaterThanOrEqual(1);
      expect(mains.length, r.name).toBeLessThanOrEqual(2);
      for (const m of mains) expect(canBeMain(byId.get(m.foodId)), `${r.name} の ${m.foodId}`).toBe(true);
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
