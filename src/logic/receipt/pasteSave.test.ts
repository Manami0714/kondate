import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../../data/foods';
import type { Food, IgnoredWord } from '../../db/types';
import { normalizeForSearch } from '../foodSearch';
import { parsePaste, type PasteItem } from './parsePaste';
import { planPasteSave, type PasteRowState } from './pasteSave';

const now = new Date('2026-09-26T10:00:00.000Z');

/** 読み取った商品をそのまま確認画面の行にする(チェックは読み取った食材だけ) */
function row(item: PasteItem, patch: Partial<PasteRowState> = {}): PasteRowState {
  return {
    item,
    foodId: item.foodId,
    amountText: String(item.amount),
    include: item.status === '読み取った',
    corrected: false,
    notFood: item.status === '食材ではない',
    ...patch,
  };
}

function itemOf(text: string, foods: readonly Food[], ignored: IgnoredWord[] = []): PasteItem {
  return parsePaste(`${text}\n1点 100円★`, foods, ignored).items[0];
}

describe('貼り付けの保存', () => {
  it('チェックの入った食材だけ在庫に足し、量が正しくなければエラー', () => {
    const item = itemOf('ごぼう 250g', INITIAL_FOODS);
    const ok = planPasteSave([row(item)], INITIAL_FOODS, [], now);
    expect(ok.ok && ok.items).toEqual([{ foodId: 'burdock', amount: 1 }]);
    const off = planPasteSave([row(item, { include: false })], INITIAL_FOODS, [], now);
    expect(off.ok && off.items).toEqual([]);
    expect(planPasteSave([row(item, { amountText: '0' })], INITIAL_FOODS, [], now).ok).toBe(false);
  });

  it('選び直した食材は、商品名を別名として足す', () => {
    const item = itemOf('豚徳用小間切(ペアパック) 200gx2', INITIAL_FOODS);
    const plan = planPasteSave([row(item, { foodId: 'pork_koma', amountText: '400', include: true, corrected: true })], INITIAL_FOODS, [], now);
    if (!plan.ok) throw new Error(plan.errors.join());
    expect(plan.updatedFoods.map((f) => [f.id, f.aliases.at(-1)])).toEqual([['pork_koma', '豚徳用小間切(ペアパック)']]);
  });

  it('どの区分の行でも「食材ではない」にでき、読まない言葉として覚える。まったく同じ別名は辞書から外す', () => {
    // 前に「ベビーチーズ」をピザ用チーズの別名にしてしまった状態
    const foods = INITIAL_FOODS.map((f) => (f.id === 'cheese' ? { ...f, aliases: [...f.aliases, 'ベビーチーズ'] } : f));
    const item = itemOf('ベビーチーズ 16個216g', foods);
    expect(item.status).toBe('読み取った');
    const plan = planPasteSave([row(item, { notFood: true, include: false })], foods, [], now);
    if (!plan.ok) throw new Error(plan.errors.join());
    expect(plan.items).toEqual([]);
    expect(plan.ignoredWords.add.map((w) => w.label)).toEqual(['ベビーチーズ']);
    const cheese = plan.updatedFoods.find((f) => f.id === 'cheese');
    expect(cheese?.aliases).not.toContain('ベビーチーズ');
    // 一部だけ合った別名(ﾁｰｽﾞ)は外さない
    expect(cheese?.aliases).toContain('ﾁｰｽﾞ');

    // 次に読むと「食材ではない」に入る
    const next = itemOf('ベビーチーズ 16個216g', plan.updatedFoods.concat(foods.filter((f) => f.id !== 'cheese')), plan.ignoredWords.add);
    expect(next.status).toBe('食材ではない');
  });

  it('一部だけ合った品を「食材ではない」にしても、辞書の別名は変えない', () => {
    const item = itemOf('おさかなソーセージ 4本 240g', INITIAL_FOODS);
    expect(item.status).toBe('自信がない');
    const plan = planPasteSave([row(item, { notFood: true })], INITIAL_FOODS, [], now);
    if (!plan.ok) throw new Error(plan.errors.join());
    expect(plan.updatedFoods).toEqual([]);
    expect(plan.ignoredWords.add.map((w) => w.word)).toEqual([normalizeForSearch('おさかなソーセージ')]);
  });

  it('「食材ではない」に入っていた品を食材に選び直すと、その読まない言葉を外す', () => {
    const ignored: IgnoredWord[] = [{ word: normalizeForSearch('ごぼう'), label: 'ごぼう', addedAt: '' }];
    const item = itemOf('ごぼう 250g', INITIAL_FOODS, ignored);
    expect(item.status).toBe('食材ではない');
    const plan = planPasteSave([row(item, { notFood: false, foodId: 'burdock', amountText: '1', include: true, corrected: true })], INITIAL_FOODS, ignored, now);
    if (!plan.ok) throw new Error(plan.errors.join());
    expect(plan.ignoredWords.remove).toEqual([normalizeForSearch('ごぼう')]);
    expect(plan.items).toEqual([{ foodId: 'burdock', amount: 1 }]);
  });
});
