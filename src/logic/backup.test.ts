import { describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../data/foods';
import { defaultHouseholdPrefs } from '../data/household';
import { INITIAL_RECIPES } from '../data/recipes';
import type { AllData } from '../db/types';
import { backupFileName, countData, parseBackup, serializeBackup } from './backup';

const now = new Date(2026, 8, 25, 21, 5, 0);

/** すべての種類のデータを1件以上含むテスト用データ */
function sampleData(): AllData {
  return {
    foods: INITIAL_FOODS,
    stocks: [{ foodId: 'egg', amount: 6, addedDate: '2026-09-20' }],
    pantry: [{ foodId: 'soy_sauce' }, { foodId: 'salt' }],
    members: [
      {
        id: 'm1',
        name: 'テスト1',
        kind: '家族',
        sex: '女性',
        age: 45,
        appetite: 'ふつう',
        portionOverride: null,
        likedFoodIds: ['spinach'],
        dislikedFoodIds: [],
        allergyFoodIds: ['shrimp'],
        likedMethods: ['煮物'],
        dislikedMethods: ['揚げ物'],
        likedFlavors: ['味噌'],
        dislikedFlavors: [],
      },
      {
        id: 'm2',
        name: 'テスト2',
        kind: 'ゲスト',
        sex: '男性',
        age: 72,
        appetite: '少なめ',
        portionOverride: 0.7,
        likedFoodIds: [],
        dislikedFoodIds: ['green_pepper'],
        allergyFoodIds: [],
        likedMethods: [],
        dislikedMethods: [],
        likedFlavors: [],
        dislikedFlavors: ['ピリ辛'],
      },
    ],
    household: [defaultHouseholdPrefs()],
    recipes: INITIAL_RECIPES,
    mealSets: [
      {
        id: 's1',
        startDate: '2026-09-25',
        days: [
          { date: '2026-09-25', mainId: 'init_nikujaga', sideId: 'init_kinpira', soupId: 'init_tonjiru', memberIds: ['m1'], status: '予定' },
        ],
        status: '予定',
        reserved: [{ dayIndex: 0, foodId: 'potato', amount: 3 }],
      },
    ],
    stockMoves: [
      { id: 'mv1', at: now.toISOString(), foodId: 'egg', delta: 6, reason: '購入', mealSetId: null },
    ],
    feedbacks: [
      { id: 'f1', at: now.toISOString(), targetType: '味付け', targetValue: '胡麻', kind: '提案時の嫌い', originalText: '胡麻和えが微妙' },
    ],
  };
}

describe('書き出しと読み込み', () => {
  it('書き出したものを読み込むと、完全に同じデータに戻る', () => {
    const data = sampleData();
    const result = parseBackup(serializeBackup(data, now));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(data);
      expect(result.exportedAt).toBe(now.toISOString());
    }
  });

  it('件数を数えられる', () => {
    const counts = countData(sampleData());
    expect(counts.members).toBe(2);
    expect(counts.recipes).toBe(INITIAL_RECIPES.length);
  });

  it('ファイル名に日時が入る', () => {
    expect(backupFileName(now)).toBe('kondate-backup-20260925-2105.json');
  });
});

describe('壊れたファイルを拒否する', () => {
  it('JSON でないファイル', () => {
    const r = parseBackup('これはJSONではない');
    expect(r).toEqual({ ok: false, error: 'JSON として読めないファイルです' });
  });

  it('ほかのアプリのファイル', () => {
    const r = parseBackup(JSON.stringify({ app: 'other', formatVersion: 1, exportedAt: '', data: {} }));
    expect(r.ok).toBe(false);
  });

  it('新しい版の形式', () => {
    const text = serializeBackup(sampleData(), now).replace('"formatVersion": 1', '"formatVersion": 999');
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
  });

  it('データの項目が欠けている', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    delete raw.data.members[0].age;
    const r = parseBackup(JSON.stringify(raw));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('メンバー[0].age');
  });

  it('決まった値以外が入っている', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    raw.data.recipes[0].methods = ['空揚げ'];
    const r = parseBackup(JSON.stringify(raw));
    expect(r.ok).toBe(false);
  });

  it('表が欠けている', () => {
    const raw = JSON.parse(serializeBackup(sampleData(), now));
    delete raw.data.stocks;
    expect(parseBackup(JSON.stringify(raw)).ok).toBe(false);
  });
});
