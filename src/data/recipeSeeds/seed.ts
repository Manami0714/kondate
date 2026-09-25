// 初期レシピの元データの形と、レシピにする関数
// 分量は食材辞書の単位で書く。基準の人数はすべて2人分
import type { CookingMethod, Flavor } from '../tags';
import type { Course, Difficulty, Recipe } from '../../db/types';

export interface RecipeSeed {
  id: string;
  /** 主な材料の食材ID(1〜2個) */
  main: string[];
  name: string;
  minutes: number;
  difficulty: Difficulty;
  methods: CookingMethod[];
  flavors: Flavor[];
  /** [食材ID, 量] の組 */
  ingredients: [string, number][];
  steps: string[];
}

export function build(course: Course, seeds: RecipeSeed[]): Recipe[] {
  return seeds.map((s) => ({
    id: `init_${s.id}`,
    name: s.name,
    course,
    ingredients: s.ingredients.map(([foodId, amount]) => ({ foodId, amount, main: s.main.includes(foodId) })),
    servings: 2,
    minutes: s.minutes,
    difficulty: s.difficulty,
    methods: s.methods,
    flavors: s.flavors,
    steps: s.steps,
    source: '初期',
    url: null,
    favorite: false,
  }));
}
