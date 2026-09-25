// ネットスーパーの「お届け内容」画面の文字を商品に分ける(純粋関数)
//
// 実物をテキスト認識でコピーした形(例):
//   冷蔵                         ← 冷蔵・冷凍の印(1行で独立することも、商品名にくっつくこともある)
//   200gx2                       ← 量の行が商品名より前に来ることもある
//   豚徳用小間切(ペアパック)     ← 商品名(2行に折り返すこともある)
//   レシピ クチコミ投稿問い合わせ
//   1点 797円★                   ← 1商品の終わり
// 商品の写真に書かれた文字(箱の「ベビーチーズ」など)が、関係ない位置に紛れ込むことがある
import { NET_SUPER_COUNT_LINE, NET_SUPER_NOISE_WORDS, STORAGE_TAG } from '../../config/receipt';
import type { Food, IgnoredWord } from '../../db/types';
import { normalizeForSearch } from '../foodSearch';
import { toMatchForm } from '../textInput/normalize';
import { findSpans, foodTerms } from '../textInput/spans';
import { cleanProductName, isDropLine, isPriceOnlyLine, type ProductLine } from './lines';
import { productWord } from './productWord';

/** ネットスーパーの画面の文字か(「N 点 … 円」の行がある) */
export function looksLikeNetSuper(lines: readonly string[]): boolean {
  return lines.some((l) => NET_SUPER_COUNT_LINE.test(l) && l.includes('円'));
}

function isNoise(line: string): boolean {
  const m = toMatchForm(line);
  return NET_SUPER_NOISE_WORDS.some((w) => m.includes(w)) || isDropLine(line) || isPriceOnlyLine(line);
}

/** 量だけの行か(「200gx2」「240g」など、量を取ると何も残らない) */
function isQuantityOnly(line: string): boolean {
  return normalizeForSearch(productWord(line)) === '';
}

/** 「N 点」の行までの1まとまり */
interface Block {
  lines: string[];
  count: number;
}

/**
 * 行を「N 点」の行ごとのまとまりに分ける。
 * 冷蔵・冷凍の印は商品名の始まりなので、印より前の行(写真の文字など)は捨てる。ただし量だけの行は残す
 */
function collectBlocks(lines: readonly string[]): Block[] {
  const blocks: Block[] = [];
  let pending: string[] = [];
  for (const line of lines) {
    const count = NET_SUPER_COUNT_LINE.exec(line);
    if (count) {
      blocks.push({ lines: pending, count: Number(count[1]) });
      pending = [];
      continue;
    }
    if (isNoise(line)) continue;
    const tag = STORAGE_TAG.exec(line);
    if (tag) {
      pending = pending.filter(isQuantityOnly);
      const rest = line.slice(tag[0].length).trim();
      if (rest !== '') pending.push(rest);
      continue;
    }
    pending.push(line);
  }
  // 最後の「N 点」より後ろの行(セット商品の中身など)は商品にしない
  return blocks;
}

/**
 * 商品名に紛れ込んだ写真の文字らしい行か。
 * - 読まない言葉とまったく同じ
 * - ほかの商品の名前に含まれている(写真の文字は、たいてい商品名と同じ)
 */
function isStray(line: string, blockIndex: number, blockWords: readonly string[], ignored: readonly IgnoredWord[]): boolean {
  const word = normalizeForSearch(productWord(line));
  if (word.length < 2) return false;
  if (ignored.some((w) => w.word === word)) return true;
  return blockWords.some((other, j) => j !== blockIndex && other.includes(word));
}

/** 1行ごとに見つかる食材 */
function lineFoodIds(line: string, foods: readonly Food[]): string[] {
  return [...new Set(findSpans(toMatchForm(line), foodTerms(foods)).map((s) => s.value.id))];
}

/**
 * つなげた商品名から2つ以上の食材が見つかり、行ごとに別の食材があるときは、行で分けて別の商品にする。
 * 食材のない行(量だけの行など)は、前の商品(先頭なら次の商品)につける。点数は最後の商品につける
 */
function splitBlock(lines: readonly string[], count: number, foods: readonly Food[]): ProductLine[] | null {
  const joined = lineFoodIds(lines.join(''), foods);
  if (joined.length < 2) return null;
  const withFood = lines.map((l) => lineFoodIds(l, foods).length > 0);
  if (withFood.filter(Boolean).length < 2) return null;

  const groups: string[][] = [];
  let leading: string[] = [];
  lines.forEach((line, i) => {
    if (withFood[i]) {
      groups.push([...leading, line]);
      leading = [];
    } else if (groups.length === 0) {
      leading.push(line);
    } else {
      groups[groups.length - 1].push(line);
    }
  });
  return groups.map((g, i) => ({
    name: cleanProductName(g.join('')),
    count: i === groups.length - 1 ? count : 1,
    split: true,
  }));
}

/**
 * ネットスーパーの画面の行を商品に分ける。
 * 「N 点」の行を1商品の終わりとし、その前の行をつなげて商品名にする(量の行が前に来てもよい)
 */
export function parseNetSuperLines(lines: readonly string[], foods: readonly Food[], ignored: readonly IgnoredWord[]): ProductLine[] {
  const blocks = collectBlocks(lines);
  const blockWords = blocks.map((b) => normalizeForSearch(productWord(b.lines.join(''))));
  const products: ProductLine[] = [];
  blocks.forEach((block, i) => {
    let kept = block.lines.filter((l) => !isStray(l, i, blockWords, ignored));
    // 商品名が何も残らないなら、写真の文字ではなかったので元に戻す(同じ商品を2回買ったときなど)
    if (kept.every(isQuantityOnly)) kept = block.lines;
    if (kept.length === 0) return;
    const split = splitBlock(kept, block.count, foods);
    if (split) {
      products.push(...split.filter((p) => p.name !== ''));
      return;
    }
    const name = cleanProductName(kept.join(''));
    if (name !== '') products.push({ name, count: block.count, split: false });
  });
  return products;
}
