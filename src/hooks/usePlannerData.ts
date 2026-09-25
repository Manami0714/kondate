import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { defaultHouseholdPrefs } from '../data/household';
import { db } from '../db/db';
import type { DateString, Food, MealSet, Member } from '../db/types';
import { cookedHistory } from '../logic/planner/history';
import type { PlannerData } from '../logic/planner/types';

export interface PlannerSource {
  data: PlannerData;
  members: Member[];
  mealSets: MealSet[];
  foodsById: ReadonlyMap<string, Food>;
}

/** 献立を選ぶのに使うデータをまとめて読む。読み込み中は undefined */
export function usePlannerData(today: DateString): PlannerSource | undefined {
  const raw = useLiveQuery(
    async () => ({
      recipes: await db.recipes.toArray(),
      foods: await db.foods.toArray(),
      stocks: await db.stocks.toArray(),
      pantry: await db.pantry.toArray(),
      members: await db.members.toArray(),
      household: (await db.household.get('household')) ?? defaultHouseholdPrefs(),
      feedbacks: await db.feedbacks.toArray(),
      mealSets: await db.mealSets.orderBy('startDate').toArray(),
    }),
    [],
  );

  return useMemo(() => {
    if (!raw) return undefined;
    const foodsById = new Map(raw.foods.map((f) => [f.id, f]));
    const data: PlannerData = {
      recipes: raw.recipes,
      foodsById,
      stocks: raw.stocks,
      pantryIds: new Set(raw.pantry.map((p) => p.foodId)),
      membersById: new Map(raw.members.map((m) => [m.id, m])),
      household: raw.household,
      feedbacks: raw.feedbacks,
      history: cookedHistory(raw.mealSets),
    };
    return { data, members: raw.members, mealSets: raw.mealSets, foodsById };
  }, [raw, today]);
}
