// 口頭フィードバックで使う「料理の言い方」の一覧(開発時に新しく作ったもの)
// 言い方 → 調理法・味付け。両方あるものは「調理法×味付け」の組み合わせとして評価する
// (「胡麻和えが微妙」で、和え物全部・胡麻味全部を下げないため)
// ひらがな・カタカナの違いは読み取り側でそろえるので、どちらか一方を書けばよい
// 調味料の名前(味噌・醤油・ごま)は、食材ではなく味付けとして読む
import type { CookingMethod, Flavor } from './tags';

export interface DishWord {
  words: string[];
  method?: CookingMethod;
  flavor?: Flavor;
}

export const DISH_WORDS: readonly DishWord[] = [
  // ── 調理法×味付け ──
  { words: ['胡麻和え', 'ごま和え', 'ごまあえ', '胡麻あえ'], method: '和え物', flavor: '胡麻' },
  { words: ['白和え', 'しらあえ'], method: '和え物', flavor: '胡麻' },
  { words: ['おかか和え', 'おかかあえ'], method: '和え物', flavor: '醤油' },
  { words: ['酢の物', 'すのもの'], method: '和え物', flavor: 'さっぱり' },
  { words: ['ナムル'], method: '和え物', flavor: '中華' },
  { words: ['中華和え'], method: '和え物', flavor: '中華' },
  { words: ['味噌煮', 'みそ煮'], method: '煮物', flavor: '味噌' },
  { words: ['甘辛煮'], method: '煮物', flavor: '甘辛' },
  { words: ['トマト煮'], method: '煮物', flavor: 'トマト' },
  { words: ['クリーム煮'], method: '煮物', flavor: '洋風' },
  { words: ['カレー煮'], method: '煮物', flavor: 'カレー' },
  { words: ['照り焼き', '照焼', 'てりやき'], method: '焼き物', flavor: '甘辛' },
  { words: ['生姜焼き', 'しょうが焼き'], method: '焼き物', flavor: '醤油' },
  { words: ['塩焼き'], method: '焼き物', flavor: '塩' },
  { words: ['味噌焼き', 'みそ焼き'], method: '焼き物', flavor: '味噌' },
  { words: ['ムニエル'], method: '焼き物', flavor: '洋風' },
  { words: ['味噌炒め', 'みそ炒め'], method: '炒め物', flavor: '味噌' },
  { words: ['中華炒め'], method: '炒め物', flavor: '中華' },
  { words: ['塩炒め'], method: '炒め物', flavor: '塩' },
  { words: ['カレー炒め'], method: '炒め物', flavor: 'カレー' },
  { words: ['南蛮漬け'], method: '揚げ物', flavor: 'さっぱり' },
  { words: ['竜田揚げ', '竜田'], method: '揚げ物', flavor: '醤油' },
  { words: ['浅漬け'], method: '生野菜', flavor: '塩' },
  { words: ['味噌汁', 'みそ汁'], method: '汁物', flavor: '味噌' },
  { words: ['すまし汁', 'お吸い物'], method: '汁物', flavor: '醤油' },
  { words: ['中華スープ'], method: '汁物', flavor: '中華' },
  { words: ['コンソメスープ'], method: '汁物', flavor: '洋風' },
  { words: ['トマトスープ'], method: '汁物', flavor: 'トマト' },

  // ── 調理法だけ ──
  { words: ['揚げ物', '揚げもの', '唐揚げ', 'から揚げ', 'からあげ', '天ぷら', 'てんぷら', 'フライ', 'カツ', '素揚げ'], method: '揚げ物' },
  { words: ['炒め物', '炒めもの', '炒め'], method: '炒め物' },
  { words: ['煮物', '煮もの', '煮付け', '煮つけ', '煮込み'], method: '煮物' },
  { words: ['焼き物', '焼きもの', '焼き魚'], method: '焼き物' },
  { words: ['蒸し物', '蒸しもの', '蒸し料理'], method: '蒸し物' },
  { words: ['茹で物', 'ゆで物', 'おひたし', 'お浸し'], method: '茹で物' },
  { words: ['和え物', 'あえ物', 'あえもの'], method: '和え物' },
  { words: ['生野菜', 'サラダ'], method: '生野菜' },
  { words: ['汁物', 'スープ'], method: '汁物' },

  // ── 味付けだけ ──
  { words: ['胡麻', 'ごま', '胡麻味', 'ごま味'], flavor: '胡麻' },
  { words: ['味噌', 'みそ', '味噌味', 'みそ味'], flavor: '味噌' },
  { words: ['醤油', 'しょうゆ', '醤油味', 'しょうゆ味'], flavor: '醤油' },
  { words: ['塩味', 'しお味'], flavor: '塩' },
  { words: ['甘辛', '甘辛い'], flavor: '甘辛' },
  { words: ['さっぱり味', 'さっぱり系', '酸っぱい'], flavor: 'さっぱり' },
  { words: ['カレー', 'カレー味'], flavor: 'カレー' },
  { words: ['トマト味'], flavor: 'トマト' },
  { words: ['中華', '中華味', '中華風'], flavor: '中華' },
  { words: ['洋風', '洋食', 'クリーム'], flavor: '洋風' },
  { words: ['ピリ辛', '辛い', 'からい'], flavor: 'ピリ辛' },
];
