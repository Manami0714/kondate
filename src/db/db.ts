// Dexie(IndexedDB を使いやすくするライブラリ)でのデータベース定義
import Dexie, { type EntityTable } from 'dexie';
import { INITIAL_FOODS } from '../data/foods';
import { defaultHouseholdPrefs } from '../data/household';
import { INITIAL_RECIPES } from '../data/recipes';
import type {
  AllData,
  Feedback,
  Food,
  HouseholdPrefs,
  MealSet,
  Member,
  PantryItem,
  Recipe,
  Stock,
  StockMove,
} from './types';

export class KondateDB extends Dexie {
  foods!: EntityTable<Food, 'id'>;
  stocks!: EntityTable<Stock, 'foodId'>;
  pantry!: EntityTable<PantryItem, 'foodId'>;
  members!: EntityTable<Member, 'id'>;
  household!: EntityTable<HouseholdPrefs, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  mealSets!: EntityTable<MealSet, 'id'>;
  stockMoves!: EntityTable<StockMove, 'id'>;
  feedbacks!: EntityTable<Feedback, 'id'>;

  constructor(name = 'kondate') {
    super(name);
    // 主キーと、検索に使う項目だけを書く
    this.version(1).stores({
      foods: 'id, name, kind',
      stocks: 'foodId',
      pantry: 'foodId',
      members: 'id, kind',
      household: 'id',
      recipes: 'id, course, source',
      mealSets: 'id, startDate',
      stockMoves: 'id, at, foodId',
      feedbacks: 'id, at',
    });

    // データベースを初めて作ったときだけ、初期データを入れる
    this.on('populate', (tx) => {
      tx.table('foods').bulkAdd(INITIAL_FOODS);
      tx.table('recipes').bulkAdd(INITIAL_RECIPES);
      tx.table('household').add(defaultHouseholdPrefs());
    });
  }

  /** 全データを読み出す(書き出し用) */
  async readAll(): Promise<AllData> {
    return this.transaction('r', this.tables, async () => ({
      foods: await this.foods.toArray(),
      stocks: await this.stocks.toArray(),
      pantry: await this.pantry.toArray(),
      members: await this.members.toArray(),
      household: await this.household.toArray(),
      recipes: await this.recipes.toArray(),
      mealSets: await this.mealSets.toArray(),
      stockMoves: await this.stockMoves.toArray(),
      feedbacks: await this.feedbacks.toArray(),
    }));
  }

  /** 全データを置き換える(読み込み用)。途中で失敗したら何も変わらない */
  async replaceAll(data: AllData): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map((t) => t.clear()));
      await this.foods.bulkAdd(data.foods);
      await this.stocks.bulkAdd(data.stocks);
      await this.pantry.bulkAdd(data.pantry);
      await this.members.bulkAdd(data.members);
      await this.household.bulkAdd(data.household);
      await this.recipes.bulkAdd(data.recipes);
      await this.mealSets.bulkAdd(data.mealSets);
      await this.stockMoves.bulkAdd(data.stockMoves);
      await this.feedbacks.bulkAdd(data.feedbacks);
    });
  }
}

export const db = new KondateDB();

/** データが消されにくくなるよう、ブラウザに永続化を頼む */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
