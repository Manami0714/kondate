import { describe, expect, it } from 'vitest';
import type { MealSet } from '../../db/types';
import { seededRng } from '../random';
import { DAY_ALLERGY_NOTE, dayHasAllergy, uncertainFoodNames } from './allergyNotes';
import { buildDays, carryOverGuests, defaultStartDate, guestStay, overlapsExisting } from './days';
import { cookedHistory } from './history';
import { makePlan } from './plan';
import { methodTargetLevel } from './score';
import { summarizePlan } from './summary';
import { swapDish } from './swap';
import { conditions, days, fillerSidesAndSoups, foodsById, member, plannerData, recipe } from './testing';
import type { PlannedDay } from './types';

describe('1品ずつの入れ替え', () => {
  const recipes = [
    recipe('m1', '主菜', [['pork_koma', 200, true]], { favorite: true }),
    recipe('m2', '主菜', [['salmon', 2, true]]),
    recipe('m3', '主菜', [['spinach', 1, true]]), // 副菜と主な材料がかぶる主菜
    ...fillerSidesAndSoups(),
  ];
  const data = plannerData({ recipes, members: [member('a')] });
  const req = { days: days(['a']).slice(0, 1), conditions: conditions() };
  const current: PlannedDay[] = [
    { ...req.days[0], mainId: 'm1', sideId: 'side_a', soupId: 'soup_a', overLimit: false },
  ];

  it('今の品と見せた品を除き、同じ日のほかの品と主な材料がかぶらないものに替わる', () => {
    const r = swapDish(req, data, current, 0, 'mainId', ['m1']);
    expect(r.ok && r.days[0].mainId).toBe('m2'); // m3 はほうれん草が副菜とかぶる
    expect(r.ok && r.days[0].sideId).toBe('side_a');
  });

  it('同じ献立の後の日にある料理は、入れ替えで出にくい', () => {
    const rs = [
      recipe('x1', '主菜', [['pork_koma', 200, true]]),
      recipe('x2', '主菜', [['salmon', 2, true]], { favorite: true }), // 2日目の主菜
      recipe('x3', '主菜', [['cod', 2, true]]),
      ...fillerSidesAndSoups(),
    ];
    const d = plannerData({ recipes: rs, members: [member('a')] });
    const twoDays = days(['a']).slice(0, 2);
    const plan: PlannedDay[] = [
      { ...twoDays[0], mainId: 'x1', sideId: 'side_a', soupId: 'soup_a', overLimit: false },
      { ...twoDays[1], mainId: 'x2', sideId: 'side_b', soupId: 'soup_b', overLimit: false },
    ];
    const r = swapDish({ days: twoDays, conditions: conditions() }, d, plan, 0, 'mainId', ['x1']);
    expect(r.ok && r.days[0].mainId).toBe('x3');
  });

  it('ほかに候補がなければ理由を返す', () => {
    const r = swapDish(req, data, current, 0, 'mainId', ['m1', 'm2']);
    expect(r).toEqual({ ok: false, error: 'ほかの主菜の候補がありません' });
  });
});

describe('献立のまとめ(量・買い足し)', () => {
  const recipes = [
    recipe('m', '主菜', [['pork_koma', 200, true], ['mirin', 2], ['soy_sauce', 2]]),
    recipe('s', '副菜', [['spinach', 1, true]]),
    recipe('p', '汁物', [['wakame', 2, true]]),
  ];
  const day = { ...days(['a'])[0], mainId: 'm', sideId: 's', soupId: 'p' };

  it('常備調味料になく在庫にもない調味料は買い足しに出る。常備調味料は出ない', () => {
    const data = plannerData({ recipes, members: [member('a')], pantryIds: ['soy_sauce'] });
    const shopping = summarizePlan([day], data).days[0].shopping;
    expect(shopping.has('mirin')).toBe(true);
    expect(shopping.has('soy_sauce')).toBe(false);
  });

  it('常備調味料にない調味料も、在庫で足りれば買い足しに出ない', () => {
    const data = plannerData({
      recipes,
      members: [member('a')],
      pantryIds: ['soy_sauce'],
      stocks: [{ foodId: 'mirin', amount: 10, addedDate: '2026-09-01' }],
    });
    expect(summarizePlan([day], data).days[0].shopping.has('mirin')).toBe(false);
  });

  it('在庫を1日目から順に使い、足りない分だけが買い足しになる', () => {
    const data = plannerData({
      recipes,
      members: [member('a'), member('b')], // 合計2.0倍 = 基準の2人分
      pantryIds: ['soy_sauce', 'mirin'],
      stocks: [{ foodId: 'pork_koma', amount: 300, addedDate: '2026-09-24' }],
    });
    const two = { ...day, memberIds: ['a', 'b'] };
    const [d1, d2] = summarizePlan([two, { ...two, date: '2026-09-26' }], data).days;
    expect(d1.shopping.has('pork_koma')).toBe(false);
    expect(d2.shopping.get('pork_koma')).toBe(100);
  });
});

describe('ゲスト', () => {
  const family = member('a');
  const guest = member('g', { kind: 'ゲスト', sex: '男性', age: 40 });

  it('ゲストを追加した日だけメンバーが増え、量が増える', () => {
    const stays = [guestStay('g', '2026-09-25', 2, 1)]; // 2日目だけ
    const input = buildDays('2026-09-25', [family, guest], stays);
    expect(input.map((d) => d.memberIds)).toEqual([['a'], ['a', 'g'], ['a']]);

    const data = plannerData({ recipes: [recipe('m', '主菜', [['pork_koma', 200, true]]), ...fillerSidesAndSoups()], members: [family, guest] });
    const plan = makePlan({ days: input, conditions: conditions() }, data, seededRng(1));
    if (!plan.ok) throw new Error(plan.error);
    const summary = summarizePlan(plan.days, data).days;
    expect(summary.map((d) => d.total)).toEqual([1, 2.341, 1]);
    const pork = summary.map((d) => d.dishes[0].ingredients.find((i) => i.foodId === 'pork_koma')?.amount);
    expect(pork).toEqual([100, 234.1, 100]);
  });

  it('滞在が献立セットを超える分は、次のセットに引き継がれる', () => {
    const stays = [guestStay('g', '2026-09-25', 3, 3)]; // 3日目から3日間 = 9/27〜9/29
    expect(stays[0]).toEqual({ memberId: 'g', fromDate: '2026-09-27', toDate: '2026-09-29' });
    const prev: MealSet = {
      id: 's1',
      startDate: '2026-09-25',
      days: [],
      status: '予定',
      reserved: [],
      conditions: conditions(),
      guests: stays,
      shopping: [],
      overLimitDays: [],
    };
    const carried = carryOverGuests([prev], '2026-09-28');
    expect(carried).toEqual(stays);
    expect(buildDays('2026-09-28', [family, guest], carried).map((d) => d.memberIds)).toEqual([['a', 'g'], ['a', 'g'], ['a']]);
    expect(carryOverGuests([{ ...prev, status: 'キャンセル' }], '2026-09-28')).toEqual([]);
    expect(carryOverGuests([prev], '2026-09-30')).toEqual([]);
  });
});

describe('開始日', () => {
  const set = (startDate: string, dates: string[], status: MealSet['status'] = '予定'): MealSet => ({
    id: startDate,
    startDate,
    days: dates.map((date) => ({ date, mainId: 'm', sideId: 's', soupId: 'p', memberIds: [], status })),
    status,
    reserved: [],
    conditions: conditions(),
    guests: [],
    shopping: [],
    overLimitDays: [],
  });

  it('予定中のセットがあれば最終日の翌日、なければ今日', () => {
    expect(defaultStartDate([], '2026-09-25')).toBe('2026-09-25');
    expect(defaultStartDate([set('2026-09-25', ['2026-09-25', '2026-09-26', '2026-09-27'])], '2026-09-25')).toBe('2026-09-28');
    expect(defaultStartDate([set('2026-09-01', ['2026-09-01', '2026-09-02', '2026-09-03'])], '2026-09-25')).toBe('2026-09-25');
  });

  it('日付が重なるセットは作れない(キャンセルしたセットは除く)', () => {
    const s = set('2026-09-25', ['2026-09-25', '2026-09-26', '2026-09-27']);
    expect(overlapsExisting([s], '2026-09-27')).toBe(true);
    expect(overlapsExisting([s], '2026-09-28')).toBe(false);
    expect(overlapsExisting([{ ...s, status: 'キャンセル' }], '2026-09-26')).toBe(false);
  });
});

describe('作った料理の履歴', () => {
  it('「作った」と、日付が過ぎた「予定」を数える。キャンセルは数えない', () => {
    const base = { mainId: 'm', sideId: 's', soupId: 'p', memberIds: [] };
    const s: MealSet = {
      id: 's',
      startDate: '2026-09-20',
      days: [
        { ...base, date: '2026-09-20', status: '作った' },
        { ...base, date: '2026-09-21', status: '予定' },
        { ...base, date: '2026-09-22', status: 'キャンセル' },
        { ...base, date: '2026-09-25', status: '予定' },
      ],
      status: '予定',
      reserved: [],
      conditions: conditions(),
      guests: [],
      shopping: [],
      overLimitDays: [],
    };
    expect(cookedHistory([s], '2026-09-25').map((h) => h.date)).toEqual([
      '2026-09-20', '2026-09-20', '2026-09-20',
      '2026-09-21', '2026-09-21', '2026-09-21',
    ]);
  });
});

describe('調理法の頻度の目標', () => {
  it('家庭の設定を基本に、その日のメンバーの好みで1段上げ下げする', () => {
    const likes = member('a', { likedMethods: ['揚げ物'] });
    const hates = member('b', { dislikedMethods: ['揚げ物'] });
    expect(methodTargetLevel('揚げ物', 'ふつう', [])).toBe('ふつう');
    expect(methodTargetLevel('揚げ物', 'ふつう', [likes])).toBe('好き');
    expect(methodTargetLevel('揚げ物', 'ふつう', [hates])).toBe('苦手');
    expect(methodTargetLevel('揚げ物', 'ふつう', [likes, hates])).toBe('ふつう');
    expect(methodTargetLevel('揚げ物', '好き', [likes])).toBe('好き');
  });
});

describe('アレルギーの注意書き', () => {
  const r = recipe('r', '副菜', [['spinach', 1, true], ['dashi', 0.5], ['soy_sauce', 1]]);

  it('アレルギーのある人がいる日だけ、要確認の食材を知らせる(料理は外さない)', () => {
    const allergic = member('a', { allergyAllergens: ['えび'] });
    expect(dayHasAllergy([allergic])).toBe(true);
    expect(uncertainFoodNames(r, [allergic], foodsById)).toEqual(['顆粒だし']);
    expect(uncertainFoodNames(r, [member('b')], foodsById)).toEqual([]);
    expect(dayHasAllergy([member('c', { allergyFoodIds: ['egg'] })])).toBe(true);
    expect(DAY_ALLERGY_NOTE).toBe('商品によって原材料が違うので、表示を確認してください');
  });
});

describe('栄養バランス(黄はご飯でそろう)', () => {
  it('赤と緑がそろえばバランスがよいとみなす。黄の材料はなくてよい', async () => {
    const { mealBalance, ALWAYS_YELLOW_SOURCE } = await import('./balance');
    const red = recipe('red', '主菜', [['pork_koma', 200, true]]);
    const green = recipe('green', '副菜', [['spinach', 1, true]]);
    const soup = recipe('soup', '汁物', [['wakame', 2, true], ['miso', 1]]);
    expect(mealBalance([red, green, soup], foodsById).balanced).toBe(true);
    expect(mealBalance([red, soup], foodsById).balanced).toBe(true); // わかめ=緑
    expect(mealBalance([red], foodsById).balanced).toBe(false);
    expect(mealBalance([green, soup], foodsById).balanced).toBe(false);
    expect(ALWAYS_YELLOW_SOURCE).toBe('ご飯');
  });
});
