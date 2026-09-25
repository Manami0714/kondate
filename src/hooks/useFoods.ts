import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import type { Food } from '../db/types';

/** 食材辞書の全件と、ID から引ける表。読み込み中は undefined */
export function useFoods(): { foods: Food[]; byId: Map<string, Food> } | undefined {
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), []);
  return useMemo(() => (foods ? { foods, byId: new Map(foods.map((f) => [f.id, f])) } : undefined), [foods]);
}
