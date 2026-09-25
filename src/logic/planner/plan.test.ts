import { describe, expect, it } from 'vitest';
import { seededRng } from '../random';
import { mainFoodIds } from './mainFoods';
import { makePlan } from './plan';
import { summarizePlan } from './summary';
import {
  conditions,
  days,
  feedback,
  fillerSidesAndSoups,
  foodsById,
  member,
  plannerData,
  recipe,
} from './testing';
import type { PlannedDay } from './types';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function planOrThrow(...args: Parameters<typeof makePlan>): PlannedDay[] {
  const r = makePlan(...args);
  if (!r.ok) throw new Error(r.error);
  return r.days;
}

const allIds = (plan: PlannedDay[]) => plan.flatMap((d) => [d.mainId, d.sideId, d.soupId]);

describe('必ず外す条件:アレルギー', () => {
  it('アレルギーの食材を含むレシピは、お気に入りで在庫がそろっていても選ばれない', () => {
    const recipes = [
      recipe('egg_main', '主菜', [['egg', 4, true]], { favorite: true }),
      recipe('pork_main', '主菜', [['pork_koma', 200, true]]),
      recipe('fish_main', '主菜', [['salmon', 2, true]]),
      recipe('chicken_main', '主菜', [['chicken_thigh', 200, true]]),
      ...fillerSidesAndSoups(),
    ];
    const data = plannerData({
      recipes,
      members: [member('a', { allergyFoodIds: ['egg'] })],
      stocks: [{ foodId: 'egg', amount: 30, addedDate: '2026-09-24' }],
    });
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: conditions() }, data, seededRng(seed));
      expect(allIds(plan)).not.toContain('egg_main');
    }
  });

  it('材料に含まれるアレルギー物質でも外す(常備調味料の醤油に含まれる小麦)', () => {
    const recipes = [
      recipe('soy_main', '主菜', [['pork_koma', 200, true], ['soy_sauce', 2]], { favorite: true }),
      recipe('salt_main', '主菜', [['salmon', 2, true], ['salt', 0.5]]),
      recipe('salt_main2', '主菜', [['chicken_thigh', 200, true], ['salt', 0.5]]),
      recipe('salt_main3', '主菜', [['cod', 2, true], ['salt', 0.5]]),
      ...fillerSidesAndSoups(),
    ];
    const data = plannerData({
      recipes,
      members: [member('a', { allergyAllergens: ['小麦'] })],
      pantryIds: ['soy_sauce', 'salt'],
    });
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: conditions() }, data, seededRng(seed));
      expect(allIds(plan)).not.toContain('soy_main');
    }
  });

  it('その日にいないゲストのアレルギーは影響しない', () => {
    const recipes = [
      recipe('soy_main', '主菜', [['pork_koma', 200, true], ['soy_sauce', 2]], { favorite: true, methods: ['焼き物'] }),
      recipe('plain1', '主菜', [['salmon', 2, true]]),
      recipe('plain2', '主菜', [['chicken_thigh', 200, true]]),
      ...fillerSidesAndSoups(),
    ];
    const guest = member('g', { kind: 'ゲスト', allergyAllergens: ['小麦'] });
    const data = plannerData({ recipes, members: [member('a'), guest], pantryIds: ['soy_sauce'] });
    const input = days(['a']);
    input[1] = { ...input[1], memberIds: ['a', 'g'] };
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: input, conditions: conditions() }, data, seededRng(seed));
      expect(plan[1].mainId).not.toBe('soy_main');
    }
  });

  it('候補がなくなる区分があれば、理由を返す', () => {
    const recipes = [recipe('egg_main', '主菜', [['egg', 4, true]]), ...fillerSidesAndSoups()];
    const data = plannerData({ recipes, members: [member('a', { allergyAllergens: ['卵'] })] });
    const r = makePlan({ days: days(['a']), conditions: conditions() }, data, seededRng(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('主菜に使えるレシピがありません');
  });
});

describe('必ず外す条件:食後の嫌い', () => {
  const recipes = [
    recipe('r_recipe', '主菜', [['pork_koma', 200, true]], { favorite: true }),
    recipe('r_food', '主菜', [['beef_koma', 200, true]], { favorite: true }),
    recipe('r_method', '主菜', [['salmon', 2, true]], { favorite: true, methods: ['揚げ物'] }),
    recipe('r_flavor', '主菜', [['mackerel', 2, true]], { favorite: true, flavors: ['胡麻'] }),
    recipe('ok1', '主菜', [['chicken_thigh', 200, true]]),
    recipe('ok2', '主菜', [['cod', 2, true]]),
    recipe('ok3', '主菜', [['pork_loin', 200, true]]),
    ...fillerSidesAndSoups(),
  ];
  const feedbacks = [
    feedback('レシピ', 'r_recipe', '食後の嫌い'),
    feedback('食材', 'beef_koma', '食後の嫌い'),
    feedback('料理法', '揚げ物', '食後の嫌い'),
    feedback('味付け', '胡麻', '食後の嫌い'),
  ];

  it('レシピ・食材・料理法・味付けのどれに当てはまっても選ばれない', () => {
    const data = plannerData({ recipes, members: [member('a')], feedbacks });
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: conditions() }, data, seededRng(seed));
      expect(allIds(plan).filter((id) => id.startsWith('r_'))).toEqual([]);
    }
  });

  it('提案時の嫌いは外さない(出にくくなるだけ)', () => {
    const data = plannerData({
      recipes: [recipe('only', '主菜', [['pork_koma', 200, true]]), ...fillerSidesAndSoups()],
      members: [member('a')],
      feedbacks: [feedback('レシピ', 'only', '提案時の嫌い')],
    });
    const plan = planOrThrow({ days: days(['a']).slice(0, 1), conditions: conditions() }, data, seededRng(1));
    expect(plan[0].mainId).toBe('only');
  });
});

describe('必ず外す条件:時間・難易度', () => {
  const recipes = [
    recipe('quick', '主菜', [['pork_koma', 200, true]], { minutes: 15, difficulty: 1 }),
    recipe('quick2', '主菜', [['salmon', 2, true]], { minutes: 20, difficulty: 1 }),
    recipe('quick3', '主菜', [['pork_loin', 200, true]], { minutes: 10, difficulty: 1 }),
    recipe('mid', '主菜', [['chicken_thigh', 200, true]], { minutes: 40, difficulty: 2, favorite: true }),
    recipe('long', '主菜', [['beef_koma', 200, true]], { minutes: 60, difficulty: 3, favorite: true }),
    recipe('hard_quick', '主菜', [['cod', 2, true]], { minutes: 10, difficulty: 3, favorite: true }),
    ...fillerSidesAndSoups(),
  ];
  const data = plannerData({ recipes, members: [member('a')] });
  const byId = new Map(recipes.map((r) => [r.id, r]));

  it.each([
    ['らくらく', 20, 1],
    ['ふつう', 40, 2],
  ] as const)('%s は %i 分・難易度 %i を超えるレシピを選ばない', (preset, maxMinutes, maxDifficulty) => {
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: conditions(preset) }, data, seededRng(seed));
      for (const id of allIds(plan)) {
        const r = byId.get(id);
        expect(r?.minutes, id).toBeLessThanOrEqual(maxMinutes);
        expect(r?.difficulty, id).toBeLessThanOrEqual(maxDifficulty);
      }
    }
  });

  it('詳細設定で時間と難易度を個別に決められる', () => {
    const c = conditions('しっかり', { maxMinutes: 15, maxDifficulty: 3 });
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: c }, data, seededRng(seed));
      for (const id of allIds(plan)) expect(byId.get(id)?.minutes, id).toBeLessThanOrEqual(15);
    }
  });

  it('しっかりは、長く難しいレシピが出やすい', () => {
    const plain = plannerData({
      recipes: [
        recipe('easy', '主菜', [['pork_koma', 200, true]], { minutes: 10, difficulty: 1 }),
        recipe('hard', '主菜', [['salmon', 2, true]], { minutes: 60, difficulty: 3 }),
        ...fillerSidesAndSoups(),
      ],
      members: [member('a')],
    });
    const plan = planOrThrow({ days: days(['a']).slice(0, 1), conditions: conditions('しっかり') }, plain, seededRng(3));
    expect(plan[0].mainId).toBe('hard');
  });
});

describe('必ず外す条件:同じ1食の中で主な材料がかぶらない', () => {
  it('主な材料は1食の中で重ならない。薬味や主な材料でない食材の重なりは許す', () => {
    const recipes = [
      recipe('cab_main', '主菜', [['cabbage', 0.25, true], ['pork_bara', 150, true], ['ginger', 1]], { favorite: true }),
      recipe('tofu_main', '主菜', [['tofu', 1, true], ['green_onion', 0.5]]),
      recipe('fish_main', '主菜', [['salmon', 2, true], ['ginger', 0.5]]),
      recipe('cab_side', '副菜', [['cabbage', 0.25, true], ['ginger', 0.5]], { favorite: true }),
      recipe('tofu_side', '副菜', [['tofu', 0.5, true]], { favorite: true }),
      recipe('carrot_side', '副菜', [['carrot', 1, true], ['cabbage', 0.1]]),
      recipe('cab_soup', '汁物', [['cabbage', 0.1, true], ['green_onion', 0.2]], { favorite: true }),
      recipe('tofu_soup', '汁物', [['tofu', 0.5, true], ['green_onion', 0.2]], { favorite: true }),
      recipe('wakame_soup', '汁物', [['wakame', 2, true], ['ginger', 0.2]]),
    ];
    const data = plannerData({ recipes, members: [member('a')] });
    const byId = new Map(recipes.map((r) => [r.id, r]));
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: conditions() }, data, seededRng(seed));
      for (const d of plan) {
        const mains = [d.mainId, d.sideId, d.soupId].flatMap((id) => {
          const r = byId.get(id);
          return r ? mainFoodIds(r, foodsById) : [];
        });
        expect(new Set(mains).size, JSON.stringify(d)).toBe(mains.length);
      }
    }
  });

  it('主な材料の印がないレシピは、薬味・調味料以外をすべて主な材料とみなす', () => {
    const r = recipe('my', '主菜', [['pork_koma', 200], ['onion', 1], ['ginger', 1], ['soy_sauce', 1]]);
    expect(mainFoodIds(r, foodsById)).toEqual(['pork_koma', 'onion']);
  });
});

describe('買い足しの上限', () => {
  const recipes = [
    recipe('many', '主菜', [['pork_koma', 200, true], ['onion', 1], ['carrot', 1], ['potato', 2]], { favorite: true }),
    recipe('stocked', '主菜', [['chicken_thigh', 200, true]]),
    recipe('stocked2', '主菜', [['salmon', 2, true]]),
    recipe('stocked3', '主菜', [['cod', 2, true]]),
    recipe('side_stocked', '副菜', [['spinach', 1, true]]),
    recipe('side_stocked2', '副菜', [['komatsuna', 1, true]]),
    recipe('side_stocked3', '副菜', [['okra', 4, true]]),
    recipe('soup_stocked', '汁物', [['wakame', 2, true]]),
    recipe('soup_stocked2', '汁物', [['enoki', 1, true]]),
    recipe('soup_stocked3', '汁物', [['shimeji', 1, true]]),
  ];
  const stocks = ['chicken_thigh', 'salmon', 'cod', 'spinach', 'komatsuna', 'okra', 'wakame', 'enoki', 'shimeji'].map((foodId) => ({
    foodId,
    amount: 1000,
    addedDate: '2026-09-24',
  }));

  it('上限を守れる組み合わせがあれば、1食の買い足しは上限以内', () => {
    const data = plannerData({ recipes, members: [member('a')], stocks, shoppingLimit: 2 });
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: conditions() }, data, seededRng(seed));
      const summary = summarizePlan(plan, data);
      for (const d of summary.days) expect(d.shopping.size).toBeLessThanOrEqual(2);
      expect(plan.every((d) => !d.overLimit)).toBe(true);
    }
  });

  it('どうしても組めない日だけ上限を緩め、その日に印をつける', () => {
    const data = plannerData({
      recipes: [
        recipe('m', '主菜', [['pork_koma', 200, true], ['onion', 1]]),
        recipe('s', '副菜', [['spinach', 1, true], ['sesame', 1]]),
        recipe('p', '汁物', [['wakame', 2, true], ['miso', 1]]),
      ],
      members: [member('a')],
      shoppingLimit: 2,
    });
    const plan = planOrThrow({ days: days(['a']).slice(0, 1), conditions: conditions() }, data, seededRng(1));
    expect(plan[0].overLimit).toBe(true);
  });
});

describe('ランダム性と日付', () => {
  const recipes = [
    recipe('a1', '主菜', [['pork_koma', 200, true]]),
    recipe('a2', '主菜', [['salmon', 2, true]]),
    recipe('a3', '主菜', [['chicken_thigh', 200, true]]),
    recipe('a4', '主菜', [['beef_koma', 200, true]]),
    ...fillerSidesAndSoups(),
  ];

  it('乱数の種が同じなら、同じ提案になる', () => {
    const data = plannerData({ recipes, members: [member('a')] });
    const req = { days: days(['a']), conditions: conditions() };
    expect(planOrThrow(req, data, seededRng(42))).toEqual(planOrThrow(req, data, seededRng(42)));
  });

  it('同じ料理は3日の中で続けて出にくい', () => {
    const data = plannerData({ recipes, members: [member('a')] });
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: conditions() }, data, seededRng(seed));
      expect(new Set(plan.map((d) => d.mainId)).size).toBe(3);
    }
  });

  it('最近作った料理は、日付が近いと出にくく、日がたつと出やすくなる', () => {
    const favored = recipes.map((r) => (r.id === 'a1' ? { ...r, favorite: true } : r));
    const base = plannerData({ recipes: favored, members: [member('a')] });
    const data = { ...base, history: [{ date: '2026-09-20', recipeId: 'a1' }] };
    const soon = planOrThrow({ days: days(['a'], '2026-09-22').slice(0, 1), conditions: conditions() }, data, () => 0);
    const later = planOrThrow({ days: days(['a'], '2026-10-20').slice(0, 1), conditions: conditions() }, data, () => 0);
    expect(soon[0].mainId).not.toBe('a1');
    expect(later[0].mainId).toBe('a1');
  });
});

describe('在庫を使う', () => {
  it('在庫にある食材で作れるレシピ、保存の目安が近いものを使うレシピが選ばれやすい', () => {
    const data = plannerData({
      recipes: [
        recipe('no_stock', '主菜', [['pork_koma', 200, true]]),
        recipe('old_stock', '主菜', [['salmon', 2, true]]),
        ...fillerSidesAndSoups(),
      ],
      members: [member('a')],
      stocks: [{ foodId: 'salmon', amount: 2, addedDate: '2026-09-24' }],
    });
    const plan = planOrThrow({ days: days(['a']).slice(0, 1), conditions: conditions() }, data, () => 0);
    expect(plan[0].mainId).toBe('old_stock');
  });
});

describe('初期レシピで組む', () => {
  it('在庫が空でも、初期レシピと常備調味料で3日分が組める', async () => {
    const { INITIAL_RECIPES } = await import('../../data/recipes');
    const pantryIds = ['soy_sauce', 'sugar', 'salt', 'pepper', 'mirin', 'sake', 'miso', 'dashi', 'salad_oil', 'sesame_oil', 'consomme', 'chicken_stock'];
    const data = plannerData({ recipes: INITIAL_RECIPES, members: [member('a'), member('b', { sex: '男性' })], pantryIds, shoppingLimit: 2 });
    const started = performance.now();
    const plan = planOrThrow({ days: days(['a', 'b']), conditions: conditions('ふつう') }, data, seededRng(7));
    const elapsed = performance.now() - started;
    expect(plan).toHaveLength(3);
    expect(elapsed).toBeLessThan(2000);
    expect(new Set(plan.map((d) => d.mainId)).size).toBe(3);
  });

  it('ふつうの在庫があれば、買い足しの上限を守って組める', async () => {
    const { INITIAL_RECIPES } = await import('../../data/recipes');
    const pantryIds = ['soy_sauce', 'sugar', 'salt', 'pepper', 'mirin', 'sake', 'miso', 'dashi', 'salad_oil', 'sesame_oil', 'consomme', 'chicken_stock'];
    const stocks = [
      ['chicken_thigh', 600], ['pork_bara', 300], ['tofu', 2], ['egg', 10], ['cabbage', 1], ['onion', 3],
      ['carrot', 3], ['potato', 4], ['spinach', 1], ['wakame', 30], ['green_onion', 2], ['eggplant', 3],
      ['green_pepper', 5], ['shimeji', 1], ['enoki', 1], ['daikon', 0.5], ['fried_tofu', 2],
    ].map(([foodId, amount]) => ({ foodId: String(foodId), amount: Number(amount), addedDate: '2026-09-23' }));
    const data = plannerData({ recipes: INITIAL_RECIPES, members: [member('a'), member('b', { sex: '男性' })], stocks, pantryIds, shoppingLimit: 2 });
    for (const seed of SEEDS.slice(0, 5)) {
      const plan = planOrThrow({ days: days(['a', 'b']), conditions: conditions('ふつう') }, data, seededRng(seed));
      expect(plan.every((d) => !d.overLimit)).toBe(true);
      for (const d of summarizePlan(plan, data).days) expect(d.shopping.size).toBeLessThanOrEqual(2);
    }
  });
});

describe('同じ献立セットの中で同じレシピは出さない', () => {
  it('在庫がそろっていてお気に入りでも、3日で同じ料理は1回だけ', () => {
    const recipes = [
      recipe('chanchan', '主菜', [['salmon', 2, true], ['cabbage', 0.2]], { favorite: true }),
      recipe('m2', '主菜', [['pork_koma', 200, true]]),
      recipe('m3', '主菜', [['chicken_thigh', 200, true]]),
      ...fillerSidesAndSoups(),
    ];
    const data = plannerData({
      recipes,
      members: [member('a')],
      stocks: [
        { foodId: 'salmon', amount: 20, addedDate: '2026-09-23' },
        { foodId: 'cabbage', amount: 3, addedDate: '2026-09-23' },
      ],
    });
    for (const seed of SEEDS) {
      const plan = planOrThrow({ days: days(['a']), conditions: conditions() }, data, seededRng(seed));
      const ids = allIds(plan);
      expect(new Set(ids).size, ids.join(',')).toBe(ids.length);
    }
  });

  it('候補が足りなくて3日分を組めなければ、理由を返す', () => {
    const data = plannerData({
      recipes: [recipe('a', '主菜', [['salmon', 2, true]]), recipe('b', '主菜', [['pork_koma', 200, true]]), ...fillerSidesAndSoups()],
      members: [member('a')],
    });
    const r = makePlan({ days: days(['a']), conditions: conditions() }, data, seededRng(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('同じ料理を2回使わず');
  });

  it('まだ「作った」を押していない前の献立セットの料理は、最近作った料理として出にくい', async () => {
    const { cookedHistory } = await import('./history');
    const recipes = [
      recipe('prev', '主菜', [['salmon', 2, true]], { favorite: true }),
      recipe('m2', '主菜', [['pork_koma', 200, true]]),
      ...fillerSidesAndSoups(),
    ];
    const base = plannerData({ recipes, members: [member('a')] });
    const prevSet = {
      id: 'prev_set',
      startDate: '2026-09-25',
      days: [{ date: '2026-09-27', mainId: 'prev', sideId: 'side_a', soupId: 'soup_a', memberIds: ['a'], status: '予定' as const }],
      status: '予定' as const,
      reserved: [],
      conditions: conditions(),
      guests: [],
      shopping: [],
      overLimitDays: [],
    };
    const req = { days: days(['a'], '2026-09-28').slice(0, 1), conditions: conditions() };
    expect(planOrThrow(req, base, () => 0)[0].mainId).toBe('prev'); // 履歴がなければお気に入りが選ばれる
    const withPrev = { ...base, history: cookedHistory([prevSet]) };
    expect(planOrThrow(req, withPrev, () => 0)[0].mainId).toBe('m2');
  });
});
