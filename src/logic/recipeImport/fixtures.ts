// テスト用の見本(架空のレシピ)。各サイトの構造化データの「形」だけをまね、中身は新しく作ったもの
// 実際のレシピの文章は写さない。作り方(recipeInstructions)は、取り込みで読まないことを確かめるために入れてある

/** 作り方の文章(取り込んだ結果に入ってはいけない) */
export const STEP_TEXT = 'テスト用の作り方の文章です。この文章は取り込まれてはいけません';

/** クックパッドの形:Recipe が1つ。時間なし、人数は「2人分」、量が「大1」のような略し方 */
export const COOKPAD_LIKE = {
  '@context': 'http://schema.org',
  '@type': 'Recipe',
  name: 'テスト用 豚こまのしょうが焼き風',
  recipeYield: '2人分',
  recipeIngredient: [
    '豚こま切れ肉 200g',
    '玉ねぎ 1/2個',
    '★しょうゆ 大1',
    '★みりん 大さじ1',
    '★生姜(チューブ) 小さじ1',
    '塩こしょう 少々',
    'サラダ油 適量',
  ],
  recipeInstructions: [{ '@type': 'HowToStep', text: STEP_TEXT }],
};

/** クラシルの形:@graph の中に Recipe。時間は ISO 8601、人数は「2人前」、まとまりの印は (A) */
export const KURASHIRU_LIKE = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'テスト用サイト' },
    {
      '@type': 'Recipe',
      name: 'テスト用 ほうれん草と卵の炒め物',
      recipeYield: '2人前',
      totalTime: 'PT15M',
      cookTime: 'PT10M',
      recipeIngredient: [
        'ほうれん草 1束',
        '卵 2個',
        '(A)しょうゆ 小さじ2',
        '(A)砂糖 小さじ1/2',
        'ごま油 大さじ1',
        '水 50ml',
      ],
      recipeInstructions: [{ '@type': 'HowToStep', text: STEP_TEXT }],
    },
  ],
};

/** デリッシュキッチンの形:配列の中に Recipe(@type も配列)。時間は cookTime だけ、材料に「〇」の印と「1と1/2」 */
export const DELISH_LIKE = [
  { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] },
  {
    '@context': 'https://schema.org',
    '@type': ['Recipe'],
    name: 'テスト用 鶏むね肉のみそ煮',
    recipeYield: ['2', '2人分'],
    cookTime: 'PT1H',
    prepTime: 'PT10M',
    recipeIngredient: [
      '鶏むね肉 1枚(300g)',
      '大根 1/4本',
      '〇みそ 大さじ1と1/2',
      '〇砂糖 大さじ1',
      '〇酒 大さじ2',
      '水 200cc',
      '小ねぎ お好みで',
    ],
    recipeInstructions: STEP_TEXT,
  },
];

/** 構造化データがないページの文字(予備の読み取り用)。名前と量が別の行に分かれている */
export const PAGE_TEXT = [
  '材料から探す',
  'テスト用 キャベツとツナのサラダ',
  '調理時間:約10分',
  '材料(2人分)',
  'キャベツ',
  '1/4個',
  'ツナ缶',
  '1缶',
  '<ドレッシング>',
  'マヨネーズ 大さじ2',
  '塩 少々',
  '買い物リストに入れる',
  '作り方',
  STEP_TEXT,
].join('\n');

/**
 * 実際のページで見た書き方をまねた、ショートカットの出力(架空のレシピ)。
 * クックパッドの形:人数・時間なし(recipeYield が空)、料理名の前後に記号、行の頭に ✿ ♡ ☆、「(又は…)」、全角の「ｇ」「～」
 */
export const COOKPAD_SHORTCUT_OUTPUT = JSON.stringify({
  kondate: 1,
  kind: 'recipe',
  url: 'https://cookpad.example/jp/recipes/1',
  name: '✿テスト用 鶏そぼろ丼✿',
  recipeIngredient: ['鶏ひき肉(又は豚ひき肉) 150ｇ～200ｇ', '卵 2～3個', '✿しょうゆ 大2', '✿砂糖 大1', '♡塩 少々', '♡白ゴマ 適量', '☆酒 大1'],
  totalTime: null,
  cookTime: null,
  prepTime: null,
  recipeYield: [],
});

/** クラシルの形:「1 servings」、数える単位の材料に「適量」、お湯・氷水 */
export const KURASHIRU_SHORTCUT_OUTPUT = JSON.stringify({
  kondate: 1,
  kind: 'recipe',
  url: 'https://kurashiru.example/recipes/abc',
  name: 'テスト用 のりとツナのうどん',
  recipeIngredient: ['のり 適量', 'うどん 1玉', 'ツナ缶 1缶', 'めんつゆ 大さじ1', 'お湯 適量', '氷水 適量'],
  totalTime: 'PT10M',
  cookTime: 'PT10M',
  prepTime: 'PT0M',
  recipeYield: ['1 servings'],
});

/** デリッシュキッチンの形:料理名に「の作り方が動画でわかる!…」、時間が秒、「1/2節(100g)」 */
export const DELISH_SHORTCUT_OUTPUT = JSON.stringify({
  kondate: 1,
  kind: 'recipe',
  url: 'https://delish.example/recipes/9',
  name: 'テスト用 根菜の煮物の作り方が動画でわかる!テスト用のレシピ',
  recipeIngredient: ['鶏もも肉 150g', 'れんこん 1/2節(100g)', 'ごぼう 1/2本(90g)', 'しょうゆ 大さじ2'],
  totalTime: 'PT3000S',
  cookTime: 'PT3000S',
  prepTime: 'PT0M',
  recipeYield: ['4人分'],
});

/** 長い作り方の文章(材料の行より長い) */
export const LONG_STEP_TEXT = 'テスト用の長い作り方の文章です。鍋に材料を入れて弱火でゆっくり煮て、最後に味を見て整えます';

/**
 * 構造化データがないページの文字(むずかしい形):
 * 時間が見出しの次の行に分かれている・人数が別の行・「作り方」の見出しがなく、材料のすぐ後に長い作り方の文章が続く
 */
export const PAGE_TEXT_NO_STEPS_HEADING = [
  'テスト用 大根と油揚げの煮物',
  'テスト用のページの紹介文です。このページはテストのために作った架空のページです',
  '調理時間',
  '約30分',
  '材料',
  '2人分',
  '大根 1/4本',
  '油揚げ 1枚',
  'めんつゆ 大さじ2',
  LONG_STEP_TEXT,
  STEP_TEXT,
].join('\n');
