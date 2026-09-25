// 調理法タグと味付けタグの固定の一覧
// メンバーの好み・家庭全体の好み・レシピで共通に使う

export const COOKING_METHODS = [
  '揚げ物',
  '炒め物',
  '煮物',
  '焼き物',
  '蒸し物',
  '茹で物',
  '和え物',
  '生野菜',
  '汁物',
] as const;

export type CookingMethod = (typeof COOKING_METHODS)[number];

export const FLAVORS = [
  '醤油',
  '味噌',
  '塩',
  '甘辛',
  'さっぱり',
  '胡麻',
  'カレー',
  'トマト',
  '中華',
  '洋風',
  'ピリ辛',
] as const;

export type Flavor = (typeof FLAVORS)[number];

// 画面に出すときの補足
export const FLAVOR_HINTS: Partial<Record<Flavor, string>> = {
  さっぱり: '酢・ポン酢',
  洋風: 'バター・クリーム',
};

/** 味付けの表示名(補足つき) */
export function flavorLabel(f: Flavor): string {
  const hint = FLAVOR_HINTS[f];
  return hint ? `${f}(${hint})` : f;
}
