// 献立を選ぶときの数値をまとめた設定ファイル
// 倍率・上限・頻度の目標などは、すべてここで変える
import type { Difficulty, Sex, TimePreset } from '../db/types';

/** らくらく/ふつう/しっかり の1品ごとの上限。maxMinutes が null なら上限なし */
export const TIME_PRESETS: Record<TimePreset, { maxMinutes: number | null; maxDifficulty: Difficulty }> = {
  らくらく: { maxMinutes: 20, maxDifficulty: 1 },
  ふつう: { maxMinutes: 40, maxDifficulty: 2 },
  しっかり: { maxMinutes: null, maxDifficulty: 3 },
};

/** 1食あたりの買い足し品数の上限(初期値。設定画面で変えられる) */
export const DEFAULT_SHOPPING_LIMIT_PER_MEAL = 2;

// ───────── 量の計算 ─────────

/** 1.0倍にする基準の人:女性30〜49歳(src/data/energyTable.ts の表から引く) */
export const PORTION_BASE: { sex: Sex; age: number } = { sex: '女性', age: 30 };

/** 食べる量ごとにかける倍率 */
export const APPETITE_FACTORS = { 少なめ: 0.8, ふつう: 1.0, 多め: 1.2 } as const;

// ───────── 点数 ─────────

export const SCORE = {
  /** 在庫で作れる割合(0〜1)にかける点数。常備調味料は数えない */
  stockCoverage: 40,
  /** 保存の目安が近い在庫を使う:残り日数ごとの点数(食材ごと) */
  expirySoon: [
    { withinDays: 1, points: 15 },
    { withinDays: 3, points: 8 },
  ],
  /** 3日で使い切る:使い切る、またはふつうの量のこの割合未満しか残らない食材ごとの点数 */
  useUpRatio: 0.2,
  useUpPoints: 10,
  /** 買い足し1品ごと */
  perShoppingItem: -8,
  /** 1食で赤・緑・黄がそろう */
  balancedMeal: 15,
  /** その日のメンバーの好き(食材・調理法・味付け)1件ごと */
  liked: 5,
  /** その日のメンバーの苦手(食材・調理法・味付け)1件ごと。家庭全体の苦手な味付けも同じ */
  disliked: -8,
  /** 「誰向け」で選んだ人の好き・苦手にかける倍率 */
  forMemberFactor: 2,
  /** お気に入り */
  favorite: 10,
  /** 提案時の嫌い1件ごとと、その下限 */
  suggestDislike: -10,
  suggestDislikeMin: -40,
  /** 最近作った料理:何日以内ならいくつ下げるか(近いものから順に見る) */
  recent: [
    { withinDays: 7, points: -50 },
    { withinDays: 14, points: -30 },
  ],
  /** しっかり:調理時間10分ごとの点数と、難易度1段ごとの点数 */
  hardyPer10Minutes: 2,
  hardyPerDifficulty: 5,
  /** 最後に足すランダムな点数の幅(0〜この値) */
  random: 10,
  /** 買い足しの上限を緩めた日ごとに、献立全体の合計点から引く点数(上限を守れる組み合わせを優先するため) */
  overLimitPenalty: 1000,
} as const;

/** 調理法の頻度の目標(何日あたり何回か) */
export const METHOD_FREQUENCY = {
  windowDays: 28,
  targets: { 好き: 12, ふつう: 4, 苦手: 1 },
  /** 目標との差1回ごとの点数と、その上限 */
  perGap: 5,
  maxAbs: 20,
} as const;

/** 献立を何通り作って、合計点の最も高いものを選ぶか */
export const PLAN_TRIALS = 30;

/** 1回の献立セットの日数 */
export const DAYS_PER_SET = 3;

/** 2通り目以降の献立では、各枠で点数の上位この数の中からランダムに選ぶ(いろいろな組み合わせを試すため) */
export const PLAN_EXPLORE_TOP = 3;
