// Dexie(IndexedDB を使いやすくするライブラリ)でのデータベース定義
import Dexie, { type EntityTable } from 'dexie';
import { INITIAL_FOODS } from '../data/foods';
import { defaultHouseholdPrefs } from '../data/household';
import { INITIAL_RECIPES } from '../data/recipes';
import {
  missingSeeds,
  upgradeFoodV1,
  upgradeFoodV4,
  upgradeHouseholdV1,
  upgradeMealSetV1,
  upgradeMemberV1,
  upgradeRecipeV1,
} from '../logic/migrate';
import type { Obj } from '../logic/validate';
import type {
  AllData,
  Feedback,
  Food,
  HouseholdPrefs,
  IgnoredWord,
  MealSet,
  Member,
  PlanDraft,
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
  ignoredWords!: EntityTable<IgnoredWord, 'word'>;
  /** 確定前の献立の提案(下書き)。書き出し・読み込みの対象外 */
  planDrafts!: EntityTable<PlanDraft, 'id'>;

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

    // 版2:薬味の印・アレルギー物質・主な材料・買い足し上限・献立セットの新しい項目を足す
    // 表の形(主キーと検索項目)は変えず、既存データに足りない値を補う
    this.version(2).upgrade(async (tx) => {
      const modify = (table: string, fn: (o: Obj) => void) =>
        tx.table(table).toCollection().modify((o: Obj) => fn(o));
      await modify('foods', upgradeFoodV1);
      await modify('members', upgradeMemberV1);
      await modify('recipes', upgradeRecipeV1);
      await modify('household', upgradeHouseholdV1);
      await modify('mealSets', upgradeMealSetV1);
      // 初期レシピの追加1・2回目(と、それに使う新しい食材)を既存の端末に足す。次に追加するときは版を上げて同じことをする
      const foodIds = new Set((await tx.table('foods').toCollection().primaryKeys()).map(String));
      const recipeIds = new Set((await tx.table('recipes').toCollection().primaryKeys()).map(String));
      const missing = missingSeeds(foodIds, recipeIds);
      await tx.table('foods').bulkAdd(missing.foods);
      await tx.table('recipes').bulkAdd(missing.recipes);
    });

    // 版3:確定前の献立の提案(下書き)を保存する表を足す
    this.version(3).stores({ planDrafts: 'id' });

    // 版4:読まない言葉(レシートで「食材ではない」を選んだ品)の表を足す
    this.version(4).stores({ ignoredWords: 'word' });

    // 版5:食材に1単位あたりの重さ(g)を足す(米は1合=150g)
    this.version(5).upgrade(async (tx) => {
      await tx.table('foods').toCollection().modify((o: Obj) => upgradeFoodV4(o));
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
      ignoredWords: await this.ignoredWords.toArray(),
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
      await this.ignoredWords.bulkAdd(data.ignoredWords);
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
