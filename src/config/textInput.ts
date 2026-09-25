// 文字の読み取り(昼食の口頭入力・レシート)で使う数値と言葉の一覧
// 量の言い方や単位の書き方を足すときは、ここだけ直す

/** 「半分」などの言葉をかける割合 */
export const HALF_RATIO = 0.5;

/** 重さ(g)から辞書の単位に換算したときの丸めの細かさ(米 5kg → 33.3合) */
export const CONVERTED_ROUND_STEP = 0.1;

/** 「少し」= 辞書の「ふつうの量」のこの割合 */
export const LITTLE_RATIO = 0.1;

/**
 * 数える単位。「半分」は1つの半分(キャベツ半分=0.5個)にする。
 * ここにない単位(g・ml・大さじ など)の「半分」は、今の在庫の半分にする
 */
export const COUNT_UNITS: readonly string[] = ['個', '本', '玉', '丁', '枚', '袋', 'パック', '束', '株', '切れ', '缶', '房', '片', '尾', '匹', '合'];

/**
 * 単位の書き方 → 辞書の単位と、かける数(kg → g は1000倍)。
 * 比べやすい形(カタカナ・英字は小文字)で書く。長いものから順に照らし合わせる
 */
export const UNIT_WORDS: readonly { word: string; unit: string; factor: number }[] = [
  { word: 'kg', unit: 'g', factor: 1000 },
  { word: 'キロ', unit: 'g', factor: 1000 },
  { word: 'グラム', unit: 'g', factor: 1 },
  { word: 'g', unit: 'g', factor: 1 },
  { word: 'ml', unit: 'ml', factor: 1 },
  { word: 'cc', unit: 'ml', factor: 1 },
  { word: 'l', unit: 'ml', factor: 1000 },
  { word: 'リットル', unit: 'ml', factor: 1000 },
  { word: 'パック', unit: 'パック', factor: 1 },
  { word: '切れ', unit: '切れ', factor: 1 },
  { word: '切', unit: '切れ', factor: 1 },
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
  { word: '片', unit: '片', factor: 1 },
  { word: '尾', unit: '尾', factor: 1 },
  { word: '匹', unit: '匹', factor: 1 },
  { word: '合', unit: '合', factor: 1 },
  { word: '大サジ', unit: '大さじ', factor: 1 },
  { word: '小サジ', unit: '小さじ', factor: 1 },
];

/** どの数える単位にも合わせてよい単位(「2個」「2つ」は、卵なら2個、大根なら2本として読む) */
export const GENERIC_COUNT_UNIT = '個';

/** 量を表す言葉(比べやすい形。長いものから順に照らし合わせる) */
export const AMOUNT_WORDS: readonly { word: string; kind: 'half' | 'little' | 'all' }[] = [
  { word: '半分', kind: 'half' },
  { word: 'ハンブン', kind: 'half' },
  { word: '半', kind: 'half' },
  { word: 'スコシ', kind: 'little' },
  { word: '少シ', kind: 'little' },
  { word: '少々', kind: 'little' },
  { word: 'チョット', kind: 'little' },
  { word: '残リ全部', kind: 'all' },
  { word: 'ノコリ全部', kind: 'all' },
  { word: '全部', kind: 'all' },
  { word: 'ゼンブ', kind: 'all' },
  { word: '全テ', kind: 'all' },
  { word: 'スベテ', kind: 'all' },
];

/** 数の言い方(比べやすい形) → 数 */
export const NUMBER_WORDS: readonly { word: string; value: number }[] = [
  { word: 'ヒトツ', value: 1 },
  { word: 'フタツ', value: 2 },
  { word: 'ミッツ', value: 3 },
  { word: 'ヨッツ', value: 4 },
  { word: 'イツツ', value: 5 },
  { word: '一', value: 1 },
  { word: '二', value: 2 },
  { word: '三', value: 3 },
  { word: '四', value: 4 },
  { word: '五', value: 5 },
  { word: '六', value: 6 },
  { word: '七', value: 7 },
  { word: '八', value: 8 },
  { word: '九', value: 9 },
  { word: '十', value: 10 },
];


/**
 * 昼食の口頭入力で、食材と関係ない言葉(読めなかった言葉を出すときに取り除く)。
 * 表示の形(ひらがな・漢字のまま)で書く。長いものから順に取り除く
 */
export const LUNCH_FILLER_WORDS: readonly string[] = [
  'お昼ごはん',
  '昼ごはん',
  'お昼',
  '昼食',
  'ランチ',
  '昼',
  '使いました',
  '使った',
  '食べました',
  '食べた',
  '作りました',
  '作った',
  'それから',
  'あとは',
  'あと',
];

/** 昼食の口頭入力で、言葉の前後から取り除く助詞 */
export const LUNCH_PARTICLES = 'をでにはがものへ';

/** 昼食の口頭入力で、言葉を区切る文字(表示の形で見る) */
export const LUNCH_SEPARATORS = /[と、,。・ や]/;
