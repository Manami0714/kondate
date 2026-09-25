// 「料理法×味付け」の評価のテスト:組み合わせだけに効き、和え物全部・胡麻味全部には効かない
import { describe, expect, it } from 'vitest';
import { SCORE } from '../../config/scoring';
import { feedbackMatches, isCandidate } from '../planner/filter';
import { scoreRecipe, type DayContext } from '../planner/score';
import { dishUse, toSimStock } from '../planner/simulate';
import { conditions, feedback, foodsById, member, plannerData, recipe } from '../planner/testing';
import type { Feedback, Recipe } from '../../db/types';
import { comboValue, parseComboValue, targetLabel } from './target';

const gomaae = recipe('gomaae', '副菜', [['spinach', 1, true]], { methods: ['和え物'], flavors: ['胡麻'] });
const otherAe = recipe('su_no_mono', '副菜', [['cucumber', 1, true]], { methods: ['和え物'], flavors: ['さっぱり'] });
const otherGoma = recipe('goma_salad', '副菜', [['burdock', 1, true]], { methods: ['茹で物'], flavors: ['胡麻'] });
const plain = recipe('ohitashi', '副菜', [['komatsuna', 1, true]], { methods: ['茹で物'], flavors: ['醤油'] });
const recipes = [gomaae, otherAe, otherGoma, plain];

const combo = (kind: Feedback['kind']) => feedback('料理法×味付け', comboValue('和え物', '胡麻'), kind);

/** 在庫なし・メンバー1人の日で点数を出す */
function score(r: Recipe, feedbacks: Feedback[]): number {
  const data = plannerData({ recipes, members: [member('a')], feedbacks });
  const ctx: DayContext = { date: '2026-09-25', members: [member('a')], forMember: null, stock: toSimStock([]), history: [] };
  const use = dishUse(ctx.stock, r.ingredients, data.pantryIds);
  return scoreRecipe(r, r.ingredients, use, ctx, data, conditions(), new Map(recipes.map((x) => [x.id, x])));
}

describe('組み合わせの値', () => {
  it('作った値を分けると元に戻る。形が違えば null', () => {
    expect(parseComboValue(comboValue('和え物', '胡麻'))).toEqual({ method: '和え物', flavor: '胡麻' });
    expect(parseComboValue('和え物')).toBeNull();
    expect(parseComboValue('和え物×のり')).toBeNull();
    expect(parseComboValue('空揚げ×胡麻')).toBeNull();
  });

  it('表示名は「胡麻味の和え物」', () => {
    expect(targetLabel({ targetType: '料理法×味付け', targetValue: '和え物×胡麻' }, foodsById, new Map())).toBe('胡麻味の和え物');
  });
});

describe('料理法×味付けの当てはまり', () => {
  it('両方のタグを持つレシピだけに当てはまる', () => {
    const f = combo('食後の嫌い');
    expect(recipes.filter((r) => feedbackMatches(f, r)).map((r) => r.id)).toEqual(['gomaae']);
  });

  it('食後の嫌い:胡麻和えだけ候補から外れ、ほかの和え物・ほかの胡麻味は残る', () => {
    const fbs = [combo('食後の嫌い')];
    const kept = recipes.filter((r) => isCandidate(r, [member('a')], conditions(), fbs, foodsById)).map((r) => r.id);
    expect(kept).toEqual(['su_no_mono', 'goma_salad', 'ohitashi']);
  });

  it('提案時の嫌い:胡麻和えだけ点数が下がる', () => {
    const fbs = [combo('提案時の嫌い')];
    expect(score(gomaae, fbs) - score(gomaae, [])).toBe(SCORE.suggestDislike);
    expect(score(otherAe, fbs)).toBe(score(otherAe, []));
    expect(score(otherGoma, fbs)).toBe(score(otherGoma, []));
  });
});

describe('評価の「好き」', () => {
  it('当てはまるレシピの点数が上がる', () => {
    expect(score(gomaae, [combo('好き')]) - score(gomaae, [])).toBe(SCORE.feedbackLiked);
    expect(score(plain, [combo('好き')])).toBe(score(plain, []));
  });

  it('何件重なっても上限を超えない', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...feedback('食材', 'spinach', '好き'), id: `f${i}` }));
    expect(score(gomaae, many) - score(gomaae, [])).toBe(SCORE.feedbackLikedMax);
  });
});
