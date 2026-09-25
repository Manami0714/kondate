import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../../data/foods';
import { INITIAL_RECIPES } from '../../data/recipes';
import { parseFeedback } from './parseFeedback';

const parse = (text: string) =>
  parseFeedback(text, INITIAL_FOODS, INITIAL_RECIPES).map((c) => [c.target.targetType, c.target.targetValue, c.kind]);

describe('口頭フィードバックの読み取り', () => {
  it('仕様の例:ほうれん草は好き、胡麻和えは組み合わせで提案時の嫌い', () => {
    expect(parse('ほうれん草は好きなんだけど、胡麻和えが微妙だった')).toEqual([
      ['食材', 'spinach', '好き'],
      ['料理法×味付け', '和え物×胡麻', '提案時の嫌い'],
    ]);
  });

  it('料理の言い方の書き方(ひらがな・カタカナ)が違っても同じ組み合わせになる', () => {
    expect(parse('ごまあえは苦手')).toEqual([['料理法×味付け', '和え物×胡麻', '提案時の嫌い']]);
    expect(parse('ゴマ和え微妙')).toEqual([['料理法×味付け', '和え物×胡麻', '提案時の嫌い']]);
  });

  it('調理法だけ・味付けだけの言い方', () => {
    expect(parse('揚げ物は好き')).toEqual([['料理法', '揚げ物', '好き']]);
    expect(parse('胡麻味が苦手')).toEqual([['味付け', '胡麻', '提案時の嫌い']]);
    expect(parse('味噌が嫌い')).toEqual([['味付け', '味噌', '提案時の嫌い']]);
  });

  it('レシピ名をまるごと言えばレシピの評価になり、中の食材・言い方は数えない', () => {
    expect(parse('ほうれん草の胡麻和えが好き')).toEqual([['レシピ', 'init_spinach_goma', '好き']]);
  });

  it('評価の言葉は対象の後ろを優先し、なければ前を使う', () => {
    expect(parse('ほうれん草と小松菜が好き')).toEqual([
      ['食材', 'spinach', '好き'],
      ['食材', 'komatsuna', '好き'],
    ]);
    expect(parse('好きなのはほうれん草')).toEqual([['食材', 'spinach', '好き']]);
    expect(parse('胡麻和えが微妙、ほうれん草は好き')).toEqual([
      ['料理法×味付け', '和え物×胡麻', '提案時の嫌い'],
      ['食材', 'spinach', '好き'],
    ]);
  });

  it('「好きじゃない」は嫌いの側', () => {
    expect(parse('ピーマンは好きじゃない')).toEqual([['食材', 'green_pepper', '提案時の嫌い']]);
  });

  it('嫌いの側の種類の初期値は、どんな言葉でも「提案時の嫌い」(食後の嫌いにはしない)', () => {
    for (const text of ['ピーマンが嫌い', 'ピーマンは食べてみて合わなかった', 'ピーマンは二度と食べたくない、まずい', 'ピーマン大嫌い']) {
      const kinds = parseFeedback(text, INITIAL_FOODS, INITIAL_RECIPES).map((c) => c.kind);
      expect(kinds).toEqual(['提案時の嫌い']);
    }
  });

  it('評価の言葉がなければ、種類は空(登録しない)', () => {
    expect(parse('ピーマンを使った')).toEqual([['食材', 'green_pepper', null]]);
  });

  it('同じ対象は1つにまとめ、調味料は食材として数えない', () => {
    expect(parse('ピーマンが好き、ピーマンいいね')).toEqual([['食材', 'green_pepper', '好き']]);
    expect(parse('かつお節が好き')).toEqual([]);
  });
});
