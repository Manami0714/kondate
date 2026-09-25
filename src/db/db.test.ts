// データベースのテスト(fake-indexeddb でメモリ上の IndexedDB を使う)
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { INITIAL_FOODS } from '../data/foods';
import { INITIAL_RECIPES } from '../data/recipes';
import { parseBackup, serializeBackup } from '../logic/backup';
import { sequentialIds } from '../logic/id';
import { KondateDB } from './db';
import { addStockToDb, removeStockFromDb, setStockAmountInDb } from './stockRepo';

let n = 0;
const opened: KondateDB[] = [];
function freshDb(): KondateDB {
  const d = new KondateDB(`test-${++n}`);
  opened.push(d);
  return d;
}

afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

const day1 = new Date(2026, 8, 25, 10, 0, 0);
const day2 = new Date(2026, 8, 26, 10, 0, 0);

describe('初期データ', () => {
  it('初めて開いたときに食材辞書・初期レシピ・家庭の好みが入る', async () => {
    const db = freshDb();
    expect(await db.foods.count()).toBe(INITIAL_FOODS.length);
    expect(await db.recipes.count()).toBe(INITIAL_RECIPES.length);
    expect((await db.household.get('household'))?.methodFrequency['揚げ物']).toBe('ふつう');
    expect(await db.stocks.count()).toBe(0);
    expect(await db.pantry.count()).toBe(0);
  });
});

describe('在庫の保存', () => {
  it('追加・買い足し・手直し・削除がすべて在庫の動きとして残る', async () => {
    const db = freshDb();
    const ids = sequentialIds();
    await addStockToDb(db, 'egg', 6, day1, ids);
    await addStockToDb(db, 'egg', 10, day2, ids);
    expect(await db.stocks.get('egg')).toEqual({ foodId: 'egg', amount: 16, addedDate: '2026-09-25' });

    await setStockAmountInDb(db, 'egg', 12, day2, ids);
    await removeStockFromDb(db, 'egg', day2, ids);
    expect(await db.stocks.get('egg')).toBeUndefined();

    const moves = await db.stockMoves.orderBy('id').toArray();
    expect(moves.map((m) => [m.delta, m.reason])).toEqual([
      [6, '購入'],
      [10, '購入'],
      [-4, '手直し'],
      [-12, '手直し'],
    ]);
  });
});

describe('書き出しと読み込み', () => {
  it('書き出したファイルを読み込むと、変更前の状態に完全に戻る', async () => {
    const db = freshDb();
    const ids = sequentialIds();
    await addStockToDb(db, 'cabbage', 1, day1, ids);
    await db.pantry.add({ foodId: 'soy_sauce' });
    const before = await db.readAll();
    const file = serializeBackup(before, day1);

    // データを変える
    await addStockToDb(db, 'egg', 10, day2, ids);
    await db.pantry.clear();
    await db.recipes.delete(INITIAL_RECIPES[0].id);

    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);
    await db.replaceAll(parsed.data);
    expect(await db.readAll()).toEqual(before);
  });

  it('別の端末(空のデータベース)にも同じデータを入れられる', async () => {
    const src = freshDb();
    await addStockToDb(src, 'egg', 3, day1, sequentialIds());
    const file = serializeBackup(await src.readAll(), day1);

    const dst = freshDb();
    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);
    await dst.replaceAll(parsed.data);
    expect(await dst.readAll()).toEqual(await src.readAll());
  });
});
