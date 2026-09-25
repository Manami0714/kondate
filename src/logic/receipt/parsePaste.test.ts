import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../../data/foods';
import type { Food, IgnoredWord } from '../../db/types';
import { withAlias } from '../aliases';
import { normalizeForSearch } from '../foodSearch';
import { NET_SUPER_REAL_SAMPLE, NET_SUPER_SAMPLE, RECEIPT_SAMPLE } from './fixtures';
import { cleanProductName, isDropLine, splitLines } from './lines';
import { parseNetSuperLines } from './netSuper';
import { matchingIgnoredWords, parsePaste, productWord } from './parsePaste';
import { parseReceiptLines } from './receipt';

const summary = (text: string, foods: readonly Food[] = INITIAL_FOODS, ignored: IgnoredWord[] = []) =>
  parsePaste(text, foods, ignored).items.map((i) => [i.word, i.status, i.foodId, i.amount]);

describe('どのお店にも共通の部分', () => {
  it('半角カナを全角に、空白を1つにそろえ、空の行は捨てる', () => {
    expect(splitLines('ﾀﾏｺﾞ  10ｺ\n\n  ｷｬﾍﾞﾂ ')).toEqual(['タマゴ 10コ', 'キャベツ']);
  });

  it('合計・小計・税・ポイント・TEL を含む行と、日付・電話番号の形の行を捨てる', () => {
    for (const line of ['小計 ¥1,446', '合計 ¥1,561', '外税 ¥115', 'ポイント 14P', 'TEL 000-0000-0000', '2026年1月9日(金) 18:30', '2026/01/09', '000-0000-0000']) {
      expect(isDropLine(line)).toBe(true);
    }
    expect(isDropLine('タマゴ 10コ ¥238※')).toBe(false);
  });

  it('商品名の前の印と後ろの値段を取る', () => {
    expect(cleanProductName('冷凍 国産鶏モモ肉 500g')).toBe('国産鶏モモ肉 500g');
    expect(cleanProductName('タマゴ 10コ ¥238※')).toBe('タマゴ 10コ');
  });

  it('別名にする言葉は、商品名から量を取ったもの', () => {
    expect(productWord('産地直送豚肩ロース切りおとし250g')).toBe('産地直送豚肩ロース切りおとし');
    expect(productWord('白菜(カット) 1/4カット')).toBe('白菜');
    expect(productWord('えのき茸 200g')).toBe('えのき茸');
  });
});

describe('レシート', () => {
  it('数量の行「2コX単38」を前の商品の個数にし、値段・合計などの行は商品にしない', () => {
    const products = parseReceiptLines(splitLines(RECEIPT_SAMPLE));
    expect(products).toEqual([
      { name: 'テスト食品館 サンプル店', count: 1 },
      { name: 'タマゴ 10コ', count: 1 },
      { name: 'トリモモ 300g', count: 1 },
      { name: 'キャベツ', count: 1 },
      { name: 'モヤシ', count: 2 },
      { name: 'センタクセンザイ', count: 1 },
      { name: 'トウフ', count: 1 },
      { name: '(8%対象 ¥1,048)', count: 1 },
    ]);
  });

  it('食材は量まで読み、洗剤や店名は読めなかった行になる', () => {
    expect(summary(RECEIPT_SAMPLE)).toEqual([
      ['テスト食品館 サンプル店', '読めなかった', null, 0],
      ['タマゴ', '読み取った', 'egg', 10],
      ['トリモモ', '読み取った', 'chicken_thigh', 300],
      ['キャベツ', '読み取った', 'cabbage', 1],
      ['モヤシ', '読み取った', 'bean_sprouts', 2],
      ['センタクセンザイ', '読めなかった', null, 0],
      ['トウフ', '読み取った', 'tofu', 1],
      ['(8%対象 ¥1,048)', '読めなかった', null, 0],
    ]);
  });
});

describe('ネットスーパー(架空の見本)', () => {
  it('2行に折り返した商品名を1商品にし、「N 点」を点数にする。前後の案内の行は商品にしない', () => {
    const products = parseNetSuperLines(splitLines(NET_SUPER_SAMPLE), INITIAL_FOODS, []);
    expect(products.map((p) => [p.name, p.count])).toEqual([
      ['国産鶏モモ肉からあげ用(バラ凍結)500g', 1],
      ['産地直送豚肩ロース切りおとし250g', 1],
      ['やわらか肉詰めピーマン 150g', 1],
      ['白菜(カット) 1/4カット', 1],
      ['大根(カット) 1/2カット', 1],
      ['にんじん 450g', 1],
      ['えのき茸 200g', 2],
      ['まろやかプロセスチーズ 12個180g', 1],
      ['ふんわりトイレットロール 12ロール', 1],
      ['はちみつりんご 3玉', 1],
    ]);
  });

  it('商品名が辞書とまったく同じなら読み取った、一部だけ合ったら自信がない。量×点数を辞書の単位にする', () => {
    const r = parsePaste(NET_SUPER_SAMPLE, INITIAL_FOODS, []);
    expect(r.source).toBe('ネットスーパー');
    expect(r.items.map((i) => [i.word, i.status, i.foodId, i.amount, i.note])).toEqual([
      // 「鶏モモ肉」は商品名の一部だけなので、自信がない(一度選べば次から読み取った)
      ['国産鶏モモ肉からあげ用(バラ凍結)', '自信がない', 'chicken_thigh', 500, null],
      ['産地直送豚肩ロース切りおとし', '読めなかった', null, 0, null],
      ['やわらか肉詰めピーマン', '自信がない', 'green_pepper', 5, 'unit-mismatch'],
      ['白菜', '読み取った', 'chinese_cabbage', 0.25, null],
      ['大根', '読み取った', 'daikon', 0.5, null],
      // 辞書は本なので、g のときはふつうの量(3本)
      ['にんじん', '読み取った', 'carrot', 3, 'unit-mismatch'],
      // 辞書は袋なので、ふつうの量(1袋)×2点
      ['えのき茸', '読み取った', 'enoki', 2, 'unit-mismatch'],
      // 12個180g のうち、辞書の単位(g)に合う方を使う
      ['まろやかプロセスチーズ', '自信がない', 'cheese', 180, null],
      ['ふんわりトイレットロール 12ロール', '読めなかった', null, 0, null],
      ['はちみつりんご', '読めなかった', null, 0, null],
    ]);
  });
});

describe('ネットスーパー(実物をテキスト認識でコピーした文字)', () => {
  it('写真の文字を取り除き、量の行が前に来る形・冷蔵の印の2つの形・★の値段の行を読める', () => {
    const products = parseNetSuperLines(splitLines(NET_SUPER_REAL_SAMPLE), INITIAL_FOODS, []);
    expect(products.map((p) => [p.name, p.count])).toEqual([
      // 「お届け商品」の後の「ベビーチーズ」(写真の文字)はつなげない
      ['までっこ鶏モモ肉唐揚用徳用(バラ凍結)620g', 1],
      ['ベビーチーズ 16個216g', 1],
      ['なめこ 80g', 2],
      ['200gx2豚徳用小間切(ペアパック)', 1],
      ['おさかなソーセージ 4本240g', 1],
      ['おまかせ産直米(無洗米)5kg', 1],
      ['梨(あきづき)2玉', 1],
      ['徳用NZ産有機サンゴールドキウイ(特大パック)800g', 1],
      ['ごぼう 250g', 1],
      ['えのき茸 200g', 1],
    ]);
  });

  it('一部だけ合った品(魚肉ソーセージ→ウインナーなど)は自信がない。米5kgは1合150gで33.3合', () => {
    const items = parsePaste(NET_SUPER_REAL_SAMPLE, INITIAL_FOODS, []).items;
    expect(items.map((i) => [i.word, i.status, i.foodId, i.amount, i.note])).toEqual([
      ['までっこ鶏モモ肉唐揚用徳用(バラ凍結)', '自信がない', 'chicken_thigh', 620, null],
      ['ベビーチーズ', '自信がない', 'cheese', 216, null],
      ['なめこ', '読み取った', 'nameko', 2, 'unit-mismatch'],
      ['豚徳用小間切(ペアパック)', '読めなかった', null, 0, null],
      ['おさかなソーセージ', '自信がない', 'sausage', 4, null],
      ['おまかせ産直米(無洗米)', '自信がない', 'rice', 33.3, 'converted'],
      ['梨(あきづき)', '読めなかった', null, 0, null],
      ['徳用NZ産有機サンゴールドキウイ(特大パック)', '読めなかった', null, 0, null],
      ['ごぼう', '読み取った', 'burdock', 1, 'unit-mismatch'],
      ['えのき茸', '読み取った', 'enoki', 1, 'unit-mismatch'],
    ]);
  });
});

describe('写真の文字への対策', () => {
  const names = (lines: string[], ignored: IgnoredWord[] = []) =>
    parseNetSuperLines(splitLines(lines.join('\n')), INITIAL_FOODS, ignored).map((p) => [p.name, p.count, p.split]);

  it('冷蔵・冷凍の印がなくても、ほかの商品名に含まれる行はつなげない', () => {
    expect(names(['ベビーチーズ', 'ごぼう 250g', '1点 204円★', 'ベビーチーズ 16個216g', '1点 549円★'])).toEqual([
      ['ごぼう 250g', 1, false],
      ['ベビーチーズ 16個216g', 1, false],
    ]);
  });

  it('読まない言葉とまったく同じ行はつなげない', () => {
    const ignored: IgnoredWord[] = [{ word: normalizeForSearch('ハッピーボックス'), label: 'ハッピーボックス', addedAt: '' }];
    expect(names(['ハッピーボックス', 'ごぼう 250g', '1点 204円★'], ignored)).toEqual([['ごぼう 250g', 1, false]]);
  });

  it('同じ商品を2回買ったときは、お互いを写真の文字として消さない', () => {
    expect(names(['ごぼう 250g', '1点 204円★', 'ごぼう 250g', '1点 204円★'])).toEqual([
      ['ごぼう 250g', 1, false],
      ['ごぼう 250g', 1, false],
    ]);
  });

  it('つなげた商品名から2つの食材が見つかったら、行で分けて読み、どちらも自信がないにする。点数は後ろの商品につける', () => {
    expect(names(['キャベツ', '200g', 'ごぼう', '2点 204円★'])).toEqual([
      ['キャベツ200g', 1, true],
      ['ごぼう', 2, true],
    ]);
    const items = parsePaste(['キャベツ', '200g', 'ごぼう', '2点 204円★'].join('\n'), INITIAL_FOODS, []).items;
    expect(items.map((i) => [i.word, i.status, i.foodId, i.count])).toEqual([
      ['キャベツ', '自信がない', 'cabbage', 1],
      ['ごぼう', '自信がない', 'burdock', 2],
    ]);
  });
});

describe('直した内容を次回から自動で読む', () => {
  it('読めなかった行に食材を選んで別名にすると、同じ文をもう一度読んだときに自動で読める', () => {
    const first = parsePaste(NET_SUPER_SAMPLE, INITIAL_FOODS, []).items.find((i) => i.word.startsWith('産地直送'));
    expect(first?.status).toBe('読めなかった');
    const loin = INITIAL_FOODS.find((f) => f.id === 'pork_loin') as Food;
    const updated = withAlias(loin, first?.word ?? '', INITIAL_FOODS) as Food;
    const foods = INITIAL_FOODS.map((f) => (f.id === loin.id ? updated : f));
    const second = parsePaste(NET_SUPER_SAMPLE, foods, []).items.find((i) => i.word.startsWith('産地直送'));
    expect([second?.status, second?.foodId, second?.amount]).toEqual(['読み取った', 'pork_loin', 250]);
  });

  it('「食材ではない」を選んだ品は、次回から「食材ではない」に入る(読まない言葉を含む長い商品名でも)', () => {
    const ignored: IgnoredWord[] = ['ふんわりトイレットロール', 'はちみつりんご'].map((label) => ({
      word: normalizeForSearch(label),
      label,
      addedAt: '2026-01-09T00:00:00.000Z',
    }));
    const items = parsePaste(NET_SUPER_SAMPLE, INITIAL_FOODS, ignored).items;
    expect(items.filter((i) => i.status === '食材ではない').map((i) => i.word)).toEqual(['ふんわりトイレットロール 12ロール', 'はちみつりんご']);
  });
});

describe('読まない言葉の決まり', () => {
  const ignoredOf = (...labels: string[]): IgnoredWord[] =>
    labels.map((label) => ({ word: normalizeForSearch(label), label, addedAt: '2026-01-09T00:00:00.000Z' }));
  const hits = (product: string, ...labels: string[]) => matchingIgnoredWords(product, ignoredOf(...labels)).length > 0;

  it('まったく同じなら、短い言葉でも効く(ひらがな・カタカナ・半角・空白の違いは同じとみなす)', () => {
    expect(hits('チーズ', 'チーズ')).toBe(true);
    expect(hits('ﾁｰｽﾞ', 'ちーず')).toBe(true);
    expect(hits('トイレット ペーパー', 'トイレットペーパー')).toBe(true);
  });

  it('4文字以上の読まない言葉は、それを含む長い商品名にも効く', () => {
    expect(hits('徳用NZ産有機サンゴールドキウイ(特大パック)', '徳用NZ産有機サンゴールドキウイ')).toBe(true);
    expect(hits('まろやかプロセスチーズ', 'プロセスチーズ')).toBe(true);
  });

  it('3文字以下の読まない言葉は、まったく同じときだけ効く(「チーズ」で「ピザ用チーズ」は読まなくならない)', () => {
    expect(hits('ピザ用チーズ', 'チーズ')).toBe(false);
  });

  it('逆向き(商品名が読まない言葉に含まれる)は効かない', () => {
    expect(hits('中華スープ', '中華スープの素セット')).toBe(false);
    expect(hits('徳用NZ産有機サンゴールドキウイ', '徳用NZ産有機サンゴールドキウイ(特大パック)')).toBe(false);
    // 読まない言葉の中の食材らしい部分と同じ名前の商品は、ふつうに読まれる
    const items = parsePaste(['ごぼう', '1点 204円★'].join('\n'), INITIAL_FOODS, ignoredOf('ごぼうとにんじんの詰め合わせ箱')).items;
    expect(items.map((i) => [i.word, i.status])).toEqual([['ごぼう', '読み取った']]);
  });
});
