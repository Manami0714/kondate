// URL からのレシピ取り込みで使う数値と言葉の一覧
// 量の言い方や単位の書き方を足すときは、ここだけ直す
import type { Difficulty } from '../db/types';
import { TIME_PRESETS } from './scoring';

/** ショートカットがコピーする文字の印(docs/shortcut/kondate-import.js の MARK と同じ) */
export const SHORTCUT_MARK = 1;

/**
 * 数字でない量の言葉 → 小さじ何杯分とみなすか(確認画面で「量が数字ではありませんでした」と知らせて直してもらう)。
 * 比べる形(ひらがな→カタカナ)で書く。長いものから順に照らし合わせる
 */
export const VAGUE_AMOUNT_WORDS: readonly { word: string; teaspoons: number }[] = [
  { word: 'ヒトツマミ', teaspoons: 1 / 8 },
  { word: '少々', teaspoons: 1 / 8 },
  { word: '少量', teaspoons: 1 / 8 },
  { word: '少シ', teaspoons: 1 / 8 },
  { word: 'スコシ', teaspoons: 1 / 8 },
  { word: 'オ好ミデ', teaspoons: 1 },
  { word: 'オ好ミ', teaspoons: 1 },
  { word: '好ミデ', teaspoons: 1 },
  { word: '好ミ', teaspoons: 1 },
  { word: '適量', teaspoons: 1 },
  { word: '適宜', teaspoons: 1 },
];

/** かさの単位 → ml(大さじ・小さじ・カップの換算に使う) */
export const VOLUME_ML: Readonly<Record<string, number>> = {
  大さじ: 15,
  小さじ: 5,
  カップ: 200,
  ml: 1,
};

/**
 * 数の前に書く単位(「大さじ1」「小さじ1/2」「カップ1」)。比べる形で書く
 */
export const PREFIX_UNIT_WORDS: readonly { word: string; unit: string }[] = [
  { word: '大サジ', unit: '大さじ' },
  { word: '小サジ', unit: '小さじ' },
  { word: 'カップ', unit: 'カップ' },
];

/**
 * 数の後ろに書く単位 → 辞書の単位での書き方と、かける数。比べる形(英字は小文字)で書く。長いものから順に照らし合わせる
 */
export const SUFFIX_UNIT_WORDS: readonly { word: string; unit: string; factor: number }[] = [
  { word: 'kg', unit: 'g', factor: 1000 },
  { word: 'キロ', unit: 'g', factor: 1000 },
  { word: 'グラム', unit: 'g', factor: 1 },
  { word: 'g', unit: 'g', factor: 1 },
  { word: 'ml', unit: 'ml', factor: 1 },
  { word: 'cc', unit: 'ml', factor: 1 },
  { word: 'リットル', unit: 'ml', factor: 1000 },
  { word: 'l', unit: 'ml', factor: 1000 },
  { word: 'カップ', unit: 'カップ', factor: 1 },
  { word: '大サジ', unit: '大さじ', factor: 1 },
  { word: '小サジ', unit: '小さじ', factor: 1 },
  { word: 'パック', unit: 'パック', factor: 1 },
  { word: '切レ', unit: '切れ', factor: 1 },
  { word: '切', unit: '切れ', factor: 1 },
  { word: 'カケ', unit: 'かけ', factor: 1 },
  { word: '片', unit: 'かけ', factor: 1 },
  { word: '個', unit: '個', factor: 1 },
  { word: 'コ', unit: '個', factor: 1 },
  { word: 'ケ', unit: '個', factor: 1 },
  { word: 'ヶ', unit: '個', factor: 1 },
  { word: 'ツ', unit: '個', factor: 1 },
  { word: '本', unit: '本', factor: 1 },
  { word: '玉', unit: '玉', factor: 1 },
  { word: '丁', unit: '丁', factor: 1 },
  { word: '枚', unit: '枚', factor: 1 },
  { word: '袋', unit: '袋', factor: 1 },
  { word: '束', unit: '束', factor: 1 },
  { word: '把', unit: '束', factor: 1 },
  { word: '株', unit: '株', factor: 1 },
  { word: '缶', unit: '缶', factor: 1 },
  { word: '房', unit: '房', factor: 1 },
  { word: '尾', unit: '尾', factor: 1 },
  { word: '匹', unit: '匹', factor: 1 },
  { word: '合', unit: '合', factor: 1 },
  { word: '皿分', unit: '皿分', factor: 1 },
  { word: 'cm', unit: 'cm', factor: 1 },
  { word: 'センチ', unit: 'cm', factor: 1 },
];

/** 数える単位の材料で、単位が辞書と違うときに「ふつうの量×数」を初期値にしてよい単位(豚こま1パック → 300g) */
export const PACKAGE_UNITS: readonly string[] = ['パック', '袋', '缶'];

/**
 * 最初から「材料に入れない」にする言葉(在庫で管理しないもの)。名前と完全に同じときだけ(比べる形は normalizeForSearch)
 */
export const NOT_INGREDIENT_WORDS: readonly string[] = ['水', 'お水', 'お湯', '湯', '熱湯', 'ぬるま湯', '氷', '氷水', '冷水'];

/**
 * 材料の行の頭につく印(「●醤油」「★砂糖」「・塩」)。表示の形で書く
 */
export const INGREDIENT_MARKS = /^[\s●○◎◉★☆■□◆◇▲△▼▽・※*＊♪♡♥◯〇-]+/;

/**
 * 材料のまとまりの見出し(「<合わせ調味料>」「【A】」「(A)」)。行の頭にあれば取り、行全体なら見出しとして捨てる。
 * 括弧の中が6文字以内のものだけ(「(薄切り)」などの注記と区別するため、行の頭だけで見る)
 */
export const GROUP_LABEL = /^[(（\[［【<＜〈《『「]\s*[^()（）\[\]［］【】<>＜＞〈〉《》『』「」]{1,6}\s*[)）\]］】>＞〉》』」]/;

/** 行の頭の、まとまりの記号だけの英字(「A 醤油 大さじ1」の A) */
export const GROUP_LETTER = /^[A-Za-zＡ-Ｚａ-ｚ]\s+/;

/** 料理名から取る、サイト名などの飾り(ページの文字から読むとき) */
export const TITLE_DECORATIONS: readonly RegExp[] = [
  /\s*[|｜].*$/,
  /\s*[-–—]\s*[^-–—]*$/,
  /【[^】]*】/g,
  /\s*(?:の)?(?:簡単)?(?:レシピ|作り方)(?:・作り方|・レシピ)?\s*$/,
  /\s+by\s+.*$/i,
];

/**
 * 難易度の初期値:調理時間から決める(らくらく・ふつうの時間の上限を使う)。
 * 以内ならその難易度、それより長いか時間がわからなければ「むずかしい」
 */
export const DIFFICULTY_BY_MINUTES: readonly { maxMinutes: number; difficulty: Difficulty }[] = [
  { maxMinutes: TIME_PRESETS['らくらく'].maxMinutes ?? 20, difficulty: 1 },
  { maxMinutes: TIME_PRESETS['ふつう'].maxMinutes ?? 40, difficulty: 2 },
];

/**
 * ページの文字から読むとき、材料の始まりの見出し(「材料」「材料(2人分)」「材料 2〜3人前」)。
 * 「材料から探す」のようなサイトの案内とは区別する
 */
export const PAGE_INGREDIENTS_HEADING = /^材料\s*(?:[(:・]?\s*\d+(?:\s*[〜~-]\s*\d+)?\s*人(?:分|前)\s*\)?)?\s*$/;
/** ページの文字から読むとき、材料の終わりの見出し */
export const PAGE_STEPS_HEADING = /^(作り方|つくり方|手順|調理手順|作りかた)/;
/** ページの文字から読むとき、材料の中で捨てる行(サイトのボタンなど) */
export const PAGE_SKIP_LINES: readonly RegExp[] = [
  /買い物リスト/,
  /^人数/,
  /^\d+\s*人(分|前)\s*$/,
  /を(見る|追加|保存)/,
  /^(PR|広告)$/,
];
