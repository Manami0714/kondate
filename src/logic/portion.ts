// 1人分の倍率と、材料の量の計算(純粋関数)
import { APPETITE_FACTORS, PORTION_BASE } from '../config/scoring';
import { ENERGY_TABLE, type EnergyRow } from '../data/energyTable';
import type { Appetite, Member, Recipe, RecipeIngredient, Sex } from '../db/types';
import { roundAmount } from './stock';

/** 年齢に当てはまる表の行(年齢の低い順に並んだ表から、minAge 以下で最も大きい行) */
export function energyRowFor(age: number): EnergyRow {
  let row = ENERGY_TABLE[0];
  for (const r of ENERGY_TABLE) if (age >= r.minAge) row = r;
  return row;
}

/** 推定エネルギー必要量(kcal/日) */
export function estimatedEnergy(sex: Sex, age: number): number {
  const row = energyRowFor(age);
  return sex === '男性' ? row.male : row.female;
}

/** 年齢・性別・食べる量から決める倍率(手入力の倍率は見ない) */
export function autoPortion(sex: Sex, age: number, appetite: Appetite): number {
  const base = estimatedEnergy(PORTION_BASE.sex, PORTION_BASE.age);
  return roundAmount((estimatedEnergy(sex, age) / base) * APPETITE_FACTORS[appetite]);
}

/** メンバーの1人分の倍率。手で入れた倍率があればそちらを優先する */
export function portionOf(member: Pick<Member, 'sex' | 'age' | 'appetite' | 'portionOverride'>): number {
  return member.portionOverride ?? autoPortion(member.sex, member.age, member.appetite);
}

/** その日のメンバー全員の倍率の合計 */
export function totalPortion(members: readonly Pick<Member, 'sex' | 'age' | 'appetite' | 'portionOverride'>[]): number {
  return roundAmount(members.reduce((sum, m) => sum + portionOf(m), 0));
}

/** レシピの材料を、合計倍率に合わせた量にする(基準の人数で割ってからかける) */
export function scaleIngredients(recipe: Pick<Recipe, 'ingredients' | 'servings'>, total: number): RecipeIngredient[] {
  return recipe.ingredients.map((i) => ({ ...i, amount: roundAmount((i.amount / recipe.servings) * total) }));
}

/** 画面表示用:「1.25倍」 */
export function formatPortion(value: number): string {
  return `${Math.round(value * 100) / 100}倍`;
}
