// データの型。SPEC.md 3章に対応する
import type { Allergen } from '../data/allergens';
import type { CookingMethod, Flavor } from '../data/tags';

/** 日付(YYYY-MM-DD) */
export type DateString = string;
/** 日時(ISO 8601 の文字列) */
export type DateTimeString = string;

// ───────── 設定・登録データ ─────────

export type FoodKind = '食材' | '調味料';
/** 食品グループ。赤=肉・魚・卵・豆、緑=野菜・海藻・きのこ、黄=穀物・いも・油 */
export type FoodGroup = '赤' | '緑' | '黄';

/** 食材辞書の1件 */
export interface Food {
  id: string;
  name: string;
  /** 別名(レシートの略し方も含む) */
  aliases: string[];
  /** 在庫とレシピで共通に使う単位 */
  unit: string;
  /** ふつうの量(量がわからないときに使う) */
  usualAmount: number;
  kind: FoodKind;
  /** 調味料は null */
  foodGroup: FoodGroup | null;
  /** 保存の目安日数 */
  shelfLifeDays: number;
  /** 薬味の印。薬味は主な材料にしない */
  isCondiment: boolean;
  /** 含まれるアレルギー物質(一般的に含まれることが多いもの) */
  allergens: Allergen[];
  /** アレルギー物質は要確認の印。商品によって差が大きく、上の一覧に自信がない食材 */
  allergenUncertain: boolean;
}

/** 在庫。食材ごとに1行 */
export interface Stock {
  foodId: string;
  amount: number;
  /** 在庫が0から増えた日。残っているうちに買い足しても変えない */
  addedDate: DateString;
}

/** 常備調味料。在庫管理しない */
export interface PantryItem {
  foodId: string;
}

export type MemberKind = '家族' | 'ゲスト';
export type Sex = '男性' | '女性';
export type Appetite = '少なめ' | 'ふつう' | '多め';

export interface Member {
  id: string;
  /** 呼び名 */
  name: string;
  kind: MemberKind;
  sex: Sex;
  age: number;
  appetite: Appetite;
  /** 手で決めた1人分の倍率。null なら年齢・性別・食べる量から自動で決める */
  portionOverride: number | null;
  likedFoodIds: string[];
  dislikedFoodIds: string[];
  /** アレルギーの食材(食材そのもので指定) */
  allergyFoodIds: string[];
  /** アレルギー物質(29品目から選ぶ) */
  allergyAllergens: Allergen[];
  likedMethods: CookingMethod[];
  dislikedMethods: CookingMethod[];
  likedFlavors: Flavor[];
  dislikedFlavors: Flavor[];
}

export type Frequency = '好き' | 'ふつう' | '苦手';

/** 家庭全体の好み。1行だけ持つ */
export interface HouseholdPrefs {
  id: 'household';
  methodFrequency: Record<CookingMethod, Frequency>;
  dislikedFlavors: Flavor[];
  /** 1食あたりの買い足し品数の上限 */
  shoppingLimitPerMeal: number;
}

export type Course = '主菜' | '副菜' | '汁物';
export type Difficulty = 1 | 2 | 3;
export type RecipeSource = '初期' | 'マイレシピ' | 'URL';

export interface RecipeIngredient {
  foodId: string;
  /** 食材辞書の単位での量 */
  amount: number;
  /** 主な材料の印。「同じ1食の中でかぶらない」の判定に使う */
  main: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  course: Course;
  ingredients: RecipeIngredient[];
  /** 基準の人数 */
  servings: number;
  /** 調理時間(分) */
  minutes: number;
  difficulty: Difficulty;
  methods: CookingMethod[];
  flavors: Flavor[];
  /** 手順。URL レシピは空 */
  steps: string[];
  source: RecipeSource;
  url: string | null;
  favorite: boolean;
}

// ───────── 履歴データ ─────────

export type MealStatus = '予定' | '作った' | 'キャンセル';

export interface MealDay {
  date: DateString;
  mainId: string;
  sideId: string;
  soupId: string;
  /** その日の人数構成(メンバーID) */
  memberIds: string[];
  status: MealStatus;
}

/** 献立で確保した食材と量(キャンセル時に戻すため) */
export interface ReservedFood {
  dayIndex: number;
  foodId: string;
  amount: number;
  /** 減らす前の在庫の追加日。在庫が消えた食材を戻すとき、追加日まで元どおりにするため */
  addedDate: DateString | null;
}

/** らくらく/ふつう/しっかり */
export type TimePreset = 'らくらく' | 'ふつう' | 'しっかり';

/** 献立を作ったときに選んだ条件 */
export interface PlanConditions {
  preset: TimePreset;
  /** 1品の最大調理時間(分)。null なら上限なし */
  maxMinutes: number | null;
  maxDifficulty: Difficulty;
  /** 「誰向け」で選んだメンバー。選ばなければ null */
  forMemberId: string | null;
}

/** ゲストの滞在。日付で持つので、献立セットをまたいでも引き継げる */
export interface GuestStay {
  memberId: string;
  fromDate: DateString;
  toDate: DateString;
}

/** 買い足しリストの1行(どの日の分か、ごとに持つ) */
export interface ShoppingItem {
  dayIndex: number;
  foodId: string;
  /** 足りない量 */
  amount: number;
  bought: boolean;
}

export interface MealSet {
  id: string;
  startDate: DateString;
  days: MealDay[];
  status: MealStatus;
  reserved: ReservedFood[];
  conditions: PlanConditions;
  guests: GuestStay[];
  shopping: ShoppingItem[];
  /** 買い足しの上限を緩めて組んだ日(0始まり) */
  overLimitDays: number[];
}

export type StockMoveReason = '購入' | '夕飯' | '昼食' | '手直し' | 'キャンセルで戻す';

/** 在庫の動き */
export interface StockMove {
  id: string;
  at: DateTimeString;
  foodId: string;
  /** 増減量(減るときは負の数) */
  delta: number;
  reason: StockMoveReason;
  mealSetId: string | null;
}

export type FeedbackTargetType = '食材' | '料理法' | '味付け' | 'レシピ';
export type FeedbackKind = '提案時の嫌い' | '食後の嫌い' | '好き';

/** 評価 */
export interface Feedback {
  id: string;
  at: DateTimeString;
  targetType: FeedbackTargetType;
  /** 食材ID・調理法・味付け・レシピIDのどれか */
  targetValue: string;
  kind: FeedbackKind;
  /** 元の発言 */
  originalText: string;
}

/** 全データ(書き出し・読み込みの単位) */
export interface AllData {
  foods: Food[];
  stocks: Stock[];
  pantry: PantryItem[];
  members: Member[];
  household: HouseholdPrefs[];
  recipes: Recipe[];
  mealSets: MealSet[];
  stockMoves: StockMove[];
  feedbacks: Feedback[];
}

export const TABLE_NAMES = [
  'foods',
  'stocks',
  'pantry',
  'members',
  'household',
  'recipes',
  'mealSets',
  'stockMoves',
  'feedbacks',
] as const satisfies readonly (keyof AllData)[];
