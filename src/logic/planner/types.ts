// 献立を選ぶロジックで使う型
import type {
  Course,
  DateString,
  Feedback,
  Food,
  HouseholdPrefs,
  Member,
  PlanConditions,
  Recipe,
  Stock,
} from '../../db/types';

/** 過去に作った(とみなす)料理1品 */
export interface HistoryEntry {
  date: DateString;
  recipeId: string;
}

/** 献立を選ぶのに使う登録データ。画面やデータベースから集めて渡す */
export interface PlannerData {
  recipes: readonly Recipe[];
  foodsById: ReadonlyMap<string, Food>;
  stocks: readonly Stock[];
  /** 常備調味料の食材ID */
  pantryIds: ReadonlySet<string>;
  membersById: ReadonlyMap<string, Member>;
  household: HouseholdPrefs;
  feedbacks: readonly Feedback[];
  history: readonly HistoryEntry[];
}

/** 1日分の条件:日付と、その日のメンバー */
export interface DayInput {
  date: DateString;
  memberIds: string[];
}

export interface PlanRequest {
  days: readonly DayInput[];
  conditions: PlanConditions;
}

/** 1日の3品 */
export interface Dishes {
  mainId: string;
  sideId: string;
  soupId: string;
}

export interface PlannedDay extends DayInput, Dishes {
  /** 買い足しの上限を緩めて組んだ日 */
  overLimit: boolean;
}

export type PlanResult = { ok: true; days: PlannedDay[] } | { ok: false; error: string };

/** 主菜・副菜・汁物の順と、それぞれの項目名 */
export const COURSE_SLOTS: readonly { course: Course; key: keyof Dishes }[] = [
  { course: '主菜', key: 'mainId' },
  { course: '副菜', key: 'sideId' },
  { course: '汁物', key: 'soupId' },
];

/** 乱数(0以上1未満)。テストでは固定の値を返す関数に差し替える */
export type Rng = () => number;
