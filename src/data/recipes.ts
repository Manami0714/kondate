// 初期レシピ集(開発時に新しく作ったもの。既存のレシピサイトの文章は写さない)
// 元データは recipeSeeds/ に、追加した回ごとにファイルを分けて置く
import type { Recipe } from '../db/types';
import * as basic from './recipeSeeds/basic';
import { MAINS as MAINS_1 } from './recipeSeeds/batch1Mains';
import { SIDES as SIDES_1 } from './recipeSeeds/batch1Sides';
import { SOUPS as SOUPS_1 } from './recipeSeeds/batch1Soups';
import { MAINS as MAINS_2 } from './recipeSeeds/batch2Mains';
import { SIDES as SIDES_2 } from './recipeSeeds/batch2Sides';
import { SOUPS as SOUPS_2 } from './recipeSeeds/batch2Soups';
import { build } from './recipeSeeds/seed';

export const INITIAL_RECIPES: Recipe[] = [
  ...build('主菜', [...basic.MAINS, ...MAINS_1, ...MAINS_2]),
  ...build('副菜', [...basic.SIDES, ...SIDES_1, ...SIDES_2]),
  ...build('汁物', [...basic.SOUPS, ...SOUPS_1, ...SOUPS_2]),
];
