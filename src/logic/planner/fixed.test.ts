import { describe, expect, it } from 'vitest';
import type { FixedDish } from '../../db/types';
import { seededRng } from '../random';
import { fixedDishWarnings, needsConfirm, removeFixed, setFixed } from './fixed';
import { mainFoodIds } from './mainFoods';
import { pinDish } from './pin';
import { makePlan } from './plan';
import { summarizePlan } from './summary';
import { conditions, days, feedback, fillerSidesAndSoups, foodsById, member, plannerData, recipe } from './testing';
import type { PlannedDay, PlanRequest } from './types';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function planOrThrow(...args: Parameters<typeof makePlan>): PlannedDay[] {
  const r = makePlan(...args);
  if (!r.ok) throw new Error(r.error);
  return r.days;
}

const allIds = (plan: PlannedDay[]) => plan.flatMap((d) => [d.mainId, d.sideId, d.soupId]);

/** 主な材料がばらばらの主菜 */
const MAINS = [
  recipe('m_pork', '主菜', [['pork_koma', 200, true]], { favorite: true }),
  recipe('m_salmon', '主菜', [['salmon', 2, true]], { favorite: true }),
  recipe('m_chicken', '主菜', [['chicken_thigh', 200, true]], { favorite: true }),
  recipe('m_cod', '主菜', [['cod', 2, true]], { favorite: true }),
];

const fix = (dayIndex: number, course: FixedDish['course'], recipeId: string): FixedDish => ({ dayIndex, course, recipeId });

describe('指定の一覧', () => {
  it('同じ枠に指定し直すと置き換わり、日と区分の順に並ぶ', () => {
    let fixed = setFixed([], fix(1, '汁物', 'a'));
    fixed = setFixed(fixed, fix(0, '主菜', 'b'));
    fixed = setFixed(fixed, fix(1, '主菜', 'c'));
    fixed = setFixed(fixed, fix(1, '汁物', 'd'));
    expect(fixed).toEqual([fix(0, '主菜', 'b'), fix(1, '主菜', 'c'), fix(1, '汁物', 'd')]);
    expect(removeFixed(fixed, 1, '主菜')).toEqual([fix(0, '主菜', 'b'), fix(1, '汁物', 'd')]);
  });
});

describe('指定した料理を固定して献立を組む', () => {
  it('指定した料理は、何通り試しても指定した枠に入る(お気に入りでない料理でも)', () => {
    const plain = recipe('plain', '主菜', [['mackerel', 2, true]]);
    const data = plannerData({ recipes: [...MAINS, plain, ...fillerSidesAndSoups()], members: [member('a')] });
    const req: PlanRequest = { days: days(['a']), conditions: conditions(), fixed: [fix(1, '主菜', 'plain')] };
    for (const seed of SEEDS) {
      const plan = planOrThrow(req, data, seededRng(seed));
      expect(plan[1].mainId).toBe('plain');
      // ほかの日には出ない(アプリが選ぶ品は指定と同じレシピを使わない)
      expect([plan[0].mainId, plan[2].mainId]).not.toContain('plain');
    }
  });

  it('アレルギー・食後の嫌い・時間の条件に当てはまる料理でも、指定すれば入る', () => {
    const egg = recipe('egg_main', '主菜', [['egg', 3, true]]);
    const disliked = recipe('disliked', '副菜', [['cabbage', 0.25, true]]);
    const slow = recipe('slow', '汁物', [['potato', 2, true]], { minutes: 90, difficulty: 3 });
    const data = plannerData({
      recipes: [...MAINS, egg, disliked, slow, ...fillerSidesAndSoups()],
      members: [member('a', { allergyFoodIds: ['egg'] })],
      feedbacks: [feedback('レシピ', 'disliked', '食後の嫌い')],
    });
    const req: PlanRequest = {
      days: days(['a']),
      conditions: conditions('らくらく'),
      fixed: [fix(0, '主菜', 'egg_main'), fix(0, '副菜', 'disliked'), fix(0, '汁物', 'slow')],
    };
    for (const seed of SEEDS) {
      const plan = planOrThrow(req, data, seededRng(seed));
      expect(plan[0]).toMatchObject({ mainId: 'egg_main', sideId: 'disliked', soupId: 'slow' });
      // 指定していない日には、今まで通り出ない
      expect(allIds(plan.slice(1))).not.toContain('egg_main');
      expect(allIds(plan.slice(1))).not.toContain('disliked');
      expect(allIds(plan.slice(1))).not.toContain('slow');
    }
  });

  it('残りの品は、指定した料理と主な材料がかぶらない(あとに選ぶ汁物を指定しても、先に選ぶ主菜・副菜が避ける)', () => {
    const cabbageMain = recipe('cab_main', '主菜', [['cabbage', 0.5, true], ['pork_koma', 100]], { favorite: true });
    const cabbageSide = recipe('cab_side', '副菜', [['cabbage', 0.25, true]], { favorite: true });
    const cabbageSoup = recipe('cab_soup', '汁物', [['cabbage', 0.25, true]]);
    const data = plannerData({
      recipes: [...MAINS, cabbageMain, cabbageSide, cabbageSoup, ...fillerSidesAndSoups()],
      members: [member('a')],
      stocks: [{ foodId: 'cabbage', amount: 1, addedDate: '2026-09-24' }],
    });
    // 指定がなければ、在庫があってお気に入りのキャベツの主菜か副菜が1日目に出る
    const free = planOrThrow({ days: days(['a']), conditions: conditions() }, data, () => 0);
    expect([free[0].mainId, free[0].sideId]).toContain('cab_main');

    const req: PlanRequest = { days: days(['a']), conditions: conditions(), fixed: [fix(0, '汁物', 'cab_soup')] };
    for (const seed of SEEDS) {
      const plan = planOrThrow(req, data, seededRng(seed));
      expect(plan[0].soupId).toBe('cab_soup');
      expect(plan[0].mainId).not.toBe('cab_main');
      expect(plan[0].sideId).not.toBe('cab_side');
    }
  });

  it('同じ料理を2つの日に指定できる', () => {
    const curry = recipe('curry', '主菜', [['beef_koma', 200, true]]);
    const data = plannerData({ recipes: [...MAINS, curry, ...fillerSidesAndSoups()], members: [member('a')] });
    const req: PlanRequest = { days: days(['a']), conditions: conditions(), fixed: [fix(0, '主菜', 'curry'), fix(1, '主菜', 'curry')] };
    const plan = planOrThrow(req, data, seededRng(1));
    expect(plan.map((d) => d.mainId)).toEqual(['curry', 'curry', expect.not.stringMatching(/^curry$/)]);
  });

  it('指定の買い足しも上限に数え、超えたらその日に印をつける', () => {
    const many = recipe('many', '主菜', [['pork_koma', 200, true], ['onion', 1], ['carrot', 1], ['potato', 2]]);
    const stocked = ['chicken_thigh', 'salmon', 'cod', 'pork_koma', 'spinach', 'komatsuna', 'okra', 'wakame', 'enoki', 'shimeji'];
    const data = plannerData({
      recipes: [...MAINS, many, ...fillerSidesAndSoups()],
      members: [member('a')],
      stocks: stocked.map((foodId) => ({ foodId, amount: 1000, addedDate: '2026-09-24' })),
      shoppingLimit: 2,
    });
    const req: PlanRequest = { days: days(['a']), conditions: conditions(), fixed: [fix(0, '主菜', 'many')] };
    const plan = planOrThrow(req, data, seededRng(1));
    expect(plan[0].mainId).toBe('many');
    expect(summarizePlan(plan, data).days[0].shopping.size).toBe(3);
    expect(plan[0].overLimit).toBe(true);
    expect(plan[1].overLimit).toBe(false);
  });

  it('その区分の候補がなくても、指定していれば組める', () => {
    const slow = recipe('slow', '汁物', [['potato', 2, true]], { minutes: 90 });
    const data = plannerData({
      recipes: [...MAINS, slow, ...fillerSidesAndSoups().filter((r) => r.course === '副菜')],
      members: [member('a')],
    });
    const fixed = [0, 1, 2].map((i) => fix(i, '汁物', 'slow'));
    const plan = planOrThrow({ days: days(['a']), conditions: conditions('らくらく'), fixed }, data, seededRng(1));
    expect(plan.map((d) => d.soupId)).toEqual(['slow', 'slow', 'slow']);
  });

  it('指定した料理が消されていたら、組まずに知らせる', () => {
    const data = plannerData({ recipes: [...MAINS, ...fillerSidesAndSoups()], members: [member('a')] });
    const r = makePlan({ days: days(['a']), conditions: conditions(), fixed: [fix(0, '主菜', 'gone')] }, data, seededRng(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('指定した料理が見つかりません');
  });
});

describe('指定した料理の注意', () => {
  const eggSoy = recipe('egg_soy', '主菜', [['egg', 3, true], ['soy_sauce', 1]], { minutes: 60, difficulty: 3 });
  const eggSoup = recipe('egg_soup', '汁物', [['egg', 1, true]]);
  const recipes = [eggSoy, eggSoup];
  const base = {
    recipe: eggSoy,
    dayIndex: 0,
    conditions: conditions('ふつう'),
    foodsById,
    recipesById: new Map(recipes.map((r) => [r.id, r])),
  };

  it('アレルギー(食材そのもの・アレルギー物質)を、だれの何かと一緒に出す', () => {
    const warnings = fixedDishWarnings({
      ...base,
      fixed: [],
      members: [member('姉', { allergyFoodIds: ['egg'] }), member('弟', { allergyAllergens: ['小麦'] }), member('母')],
      feedbacks: [],
    });
    const texts = warnings.filter((w) => w.kind === 'アレルギー').map((w) => w.text);
    expect(texts).toEqual(['姉のアレルギー(卵)に当てはまります', '弟のアレルギー(小麦)に当てはまります']);
    expect(needsConfirm(warnings)).toBe(true);
  });

  it('食後の嫌いに当てはまると、確認がいる注意を出す', () => {
    const warnings = fixedDishWarnings({ ...base, fixed: [], members: [member('a')], feedbacks: [feedback('食材', 'egg', '食後の嫌い')] });
    expect(warnings.find((w) => w.kind === '食後の嫌い')?.text).toContain('卵');
    expect(needsConfirm(warnings)).toBe(true);
  });

  it('時間・難易度の条件を超えると注意を出すが、確認はいらない', () => {
    const warnings = fixedDishWarnings({ ...base, fixed: [], members: [member('a')], feedbacks: [] });
    expect(warnings.map((w) => w.kind)).toEqual(['時間', '時間']);
    expect(warnings[0].text).toContain('40分');
    expect(needsConfirm(warnings)).toBe(false);
  });

  it('同じ日に指定したほかの料理と主な材料がかぶると注意を出す(ほかの日の指定は見ない)', () => {
    const sameDay = fixedDishWarnings({ ...base, fixed: [fix(0, '汁物', 'egg_soup')], members: [member('a')], feedbacks: [] });
    expect(sameDay.find((w) => w.kind === '主な材料')?.text).toContain('卵');
    const otherDay = fixedDishWarnings({ ...base, fixed: [fix(1, '汁物', 'egg_soup')], members: [member('a')], feedbacks: [] });
    expect(otherDay.some((w) => w.kind === '主な材料')).toBe(false);
  });

  it('アレルギー・食後の嫌いの注意は、確定した献立セットの日でも料理ごとに出る', () => {
    const data = plannerData({
      recipes: [...MAINS, eggSoy, ...fillerSidesAndSoups()],
      members: [member('姉', { allergyFoodIds: ['egg'] })],
      feedbacks: [feedback('レシピ', 'side_a', '食後の嫌い')],
    });
    // 確定した献立セットの days と同じ形(状態つき)
    const confirmedDays = [
      { date: '2026-09-25', memberIds: ['姉'], mainId: 'egg_soy', sideId: 'side_a', soupId: 'soup_a', status: '予定' as const },
    ];
    const dishes = summarizePlan(confirmedDays, { ...data, stocks: [] }).days[0].dishes;
    expect(dishes[0].safetyWarnings).toEqual(['姉のアレルギー(卵)に当てはまります']);
    expect(dishes[1].safetyWarnings).toEqual(['「食後の嫌い」(side_a)に当てはまります']);
    expect(dishes[2].safetyWarnings).toEqual([]);
  });
});

describe('提案の画面で料理を指定する', () => {
  const cabbageMain = recipe('cab_main', '主菜', [['cabbage', 0.5, true]]);
  const cabbageSide = recipe('cab_side', '副菜', [['cabbage', 0.25, true]]);
  const data = plannerData({ recipes: [...MAINS, cabbageMain, cabbageSide, ...fillerSidesAndSoups()], members: [member('a')] });
  const reqDays = days(['a']);
  const current: PlannedDay[] = [
    { ...reqDays[0], mainId: 'm_pork', sideId: 'cab_side', soupId: 'soup_a', overLimit: false },
    { ...reqDays[1], mainId: 'm_salmon', sideId: 'side_b', soupId: 'soup_b', overLimit: false },
    { ...reqDays[2], mainId: 'm_chicken', sideId: 'side_c', soupId: 'soup_c', overLimit: false },
  ];

  it('主な材料がかぶる同じ日の品だけ選び直し、ほかの品とほかの日は変わらない', () => {
    const req: PlanRequest = { days: reqDays, conditions: conditions(), fixed: [fix(0, '主菜', 'cab_main')] };
    const r = pinDish(req, data, current, 0, 'mainId');
    if (!r.ok) throw new Error(r.error);
    expect(r.days[0].mainId).toBe('cab_main');
    expect(r.days[0].sideId).not.toBe('cab_side');
    expect(mainFoodIds(data.recipes.find((x) => x.id === r.days[0].sideId)!, foodsById)).not.toContain('cabbage');
    expect(r.days[0].soupId).toBe('soup_a');
    expect(r.days.slice(1).map((d) => [d.mainId, d.sideId, d.soupId])).toEqual(
      current.slice(1).map((d) => [d.mainId, d.sideId, d.soupId]),
    );
  });

  it('ほかの日にアプリが選んだ同じ料理は選び直す', () => {
    const req: PlanRequest = { days: reqDays, conditions: conditions(), fixed: [fix(0, '主菜', 'm_salmon')] };
    const r = pinDish(req, data, current, 0, 'mainId');
    if (!r.ok) throw new Error(r.error);
    expect(r.days[0].mainId).toBe('m_salmon');
    expect(r.days[1].mainId).not.toBe('m_salmon');
  });

  it('指定した品どうしは、かぶっていても選び直さない', () => {
    const req: PlanRequest = {
      days: reqDays,
      conditions: conditions(),
      fixed: [fix(0, '主菜', 'cab_main'), fix(0, '副菜', 'cab_side')],
    };
    const r = pinDish(req, data, current, 0, 'mainId');
    if (!r.ok) throw new Error(r.error);
    expect(r.days[0]).toMatchObject({ mainId: 'cab_main', sideId: 'cab_side' });
  });

  it('選び直せる候補がなければ、指定せずに知らせる', () => {
    const onlyCabbageSides = plannerData({ recipes: [...MAINS, cabbageMain, cabbageSide, ...fillerSidesAndSoups().filter((x) => x.course === '汁物')], members: [member('a')] });
    const cur: PlannedDay[] = [{ ...reqDays[0], mainId: 'm_pork', sideId: 'cab_side', soupId: 'soup_a', overLimit: false }];
    const req: PlanRequest = { days: reqDays.slice(0, 1), conditions: conditions(), fixed: [fix(0, '主菜', 'cab_main')] };
    const r = pinDish(req, onlyCabbageSides, cur, 0, 'mainId');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('副菜の候補がありません');
  });
});
