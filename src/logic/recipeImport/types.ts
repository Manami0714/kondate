// URL からのレシピ取り込みで使う形(確認画面の中だけで使い、保存はしない)

/** 貼り付けた文字から取り出したもの */
export interface ImportedPage {
  from: '構造化データ' | 'ページの文字';
  url: string | null;
  name: string;
  /** 「豚こま切れ肉 200g」のような元の書き方 */
  ingredientLines: string[];
  minutes: number | null;
  servings: number | null;
}

export type IngredientStatus = '読み取った' | '自信がない' | '読めなかった' | '材料に入れない';

/**
 * 量の注意
 * - not-number:量が数字でなかった(少々・適量など)、または量が書いていなかった
 * - converted:大さじ・小さじ・g などを辞書の単位に換算した
 * - unit-mismatch:単位が辞書と違い、換算できなかった
 */
export type ImportAmountNote = 'not-number' | 'converted' | 'unit-mismatch';

/** 材料の1行を読んだ結果 */
export interface ImportIngredient {
  /** 元の行 */
  line: string;
  /** 材料名(印・見出し・( ) の注記を取ったもの)。別名として覚えるときもこれを使う */
  name: string;
  /** 量の部分(「大さじ1と1/2」など) */
  amountText: string;
  status: IngredientStatus;
  /** 当てはめた食材(読めなかった・材料に入れないときは null) */
  foodId: string | null;
  /** 見つかった食材の候補(自信がないときに選べるように) */
  candidateIds: string[];
  /** 辞書の単位での量。決められなければ null(確認画面で入れてもらう) */
  amount: number | null;
  note: ImportAmountNote | null;
}
