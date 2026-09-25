// アレルギー表示の対象29品目(食品表示基準)
// 出典:消費者庁「アレルゲンを含む食品に関する表示について」(令和8年4月1日改正)
//   https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/
// 令和8年(2026年)4月1日の改正で、カシューナッツが特定原材料へ移り、ピスタチオが特定原材料に準ずるものに加わった

/** 特定原材料(表示義務)9品目 */
export const SPECIFIC_ALLERGENS = ['えび', 'かに', 'くるみ', '小麦', 'そば', '卵', '乳', '落花生', 'カシューナッツ'] as const;

/** 特定原材料に準ずるもの(表示推奨)20品目 */
export const RECOMMENDED_ALLERGENS = [
  'アーモンド',
  'あわび',
  'いか',
  'いくら',
  'オレンジ',
  'キウイフルーツ',
  '牛肉',
  'ごま',
  'さけ',
  'さば',
  '大豆',
  '鶏肉',
  'バナナ',
  'ピスタチオ',
  '豚肉',
  'マカダミアナッツ',
  'もも',
  'やまいも',
  'りんご',
  'ゼラチン',
] as const;

export const ALLERGENS = [...SPECIFIC_ALLERGENS, ...RECOMMENDED_ALLERGENS] as const;

export type Allergen = (typeof ALLERGENS)[number];
