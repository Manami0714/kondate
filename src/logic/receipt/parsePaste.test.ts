import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../../data/foods';
import type { Food, IgnoredWord } from '../../db/types';
import { withAlias } from '../aliases';
import { normalizeForSearch } from '../foodSearch';
import { NET_SUPER_SAMPLE, RECEIPT_SAMPLE } from './fixtures';
import { cleanProductName, isDropLine, splitLines } from './lines';
import { parseNetSuperLines } from './netSuper';
import { parsePaste, productWord } from './parsePaste';
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

describe('ネットスーパー', () => {
  it('2行に折り返した商品名を1商品にし、「N 点」を点数にする。前後の案内の行は商品にしない', () => {
    const products = parseNetSuperLines(splitLines(NET_SUPER_SAMPLE));
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

  it('読み取った・自信がない・読めなかったに分け、量×点数を辞書の単位にする', () => {
    const r = parsePaste(NET_SUPER_SAMPLE, INITIAL_FOODS, []);
    expect(r.source).toBe('ネットスーパー');
    expect(r.items.map((i) => [i.word, i.status, i.foodId, i.amount, i.note])).toEqual([
      ['国産鶏モモ肉からあげ用(バラ凍結)', '読み取った', 'chicken_thigh', 500, null],
      ['産地直送豚肩ロース切りおとし', '読めなかった', null, 0, null],
      // 食材名(ピーマン)があっても、できあいの料理らしいので自信がない
      ['やわらか肉詰めピーマン', '自信がない', 'green_pepper', 5, 'unit-mismatch'],
      ['白菜', '読み取った', 'chinese_cabbage', 0.25, null],
      ['大根', '読み取った', 'daikon', 0.5, null],
      // 辞書は本なので、g のときはふつうの量(3本)
      ['にんじん', '読み取った', 'carrot', 3, 'unit-mismatch'],
      // 辞書は袋なので、ふつうの量(1袋)×2点
      ['えのき茸', '読み取った', 'enoki', 2, 'unit-mismatch'],
      // 12個180g のうち、辞書の単位(g)に合う方を使う
      ['まろやかプロセスチーズ', '読み取った', 'cheese', 180, null],
      ['ふんわりトイレットロール 12ロール', '読めなかった', null, 0, null],
      ['はちみつりんご', '読めなかった', null, 0, null],
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

  it('「食材ではない」を選んだ品は、次回から「食材ではない」に入る(少し違う商品名でも)', () => {
    const ignored: IgnoredWord[] = ['ふんわりトイレットロール', 'はちみつりんご(大玉)'].map((label) => ({
      word: normalizeForSearch(label),
      label,
      addedAt: '2026-01-09T00:00:00.000Z',
    }));
    const items = parsePaste(NET_SUPER_SAMPLE, INITIAL_FOODS, ignored).items;
    expect(items.filter((i) => i.status === '食材ではない').map((i) => i.word)).toEqual(['ふんわりトイレットロール 12ロール', 'はちみつりんご']);
  });
});
