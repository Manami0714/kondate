import { useLiveQuery } from 'dexie-react-hooks';
import { MultiChoice, SingleChoice } from '../../components/Choice';
import { COOKING_METHODS, FLAVORS, flavorLabel, type CookingMethod } from '../../data/tags';
import { defaultHouseholdPrefs } from '../../data/household';
import { db } from '../../db/db';
import type { Frequency, HouseholdPrefs } from '../../db/types';

const SHOPPING_LIMIT_OPTIONS = [0, 1, 2, 3, 4, 5];

/** 家庭全体の好み:調理法ごとの頻度、苦手な味付け、買い足し品数の上限 */
export function HouseholdSection() {
  const prefs = useLiveQuery(async () => (await db.household.get('household')) ?? defaultHouseholdPrefs(), []);
  if (!prefs) return null;

  const save = (next: HouseholdPrefs) => db.household.put(next);
  const setFrequency = (method: CookingMethod, value: Frequency) =>
    save({ ...prefs, methodFrequency: { ...prefs.methodFrequency, [method]: value } });

  return (
    <>
      <h2 className="section-title">家庭全体の好み</h2>
      <p className="muted">調理法ごとに、どのくらいの頻度で出てほしいかを選びます。</p>
      <div className="list">
        {COOKING_METHODS.map((m) => (
          <div key={m} className="freq-row">
            <span>{m}</span>
            <SingleChoice<Frequency>
              options={['好き', 'ふつう', '苦手']}
              value={prefs.methodFrequency[m]}
              onChange={(v) => setFrequency(m, v)}
            />
          </div>
        ))}
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <span className="field-label">家庭全体で苦手な味付け</span>
        <MultiChoice
          options={FLAVORS}
          value={prefs.dislikedFlavors}
          onChange={(v) => save({ ...prefs, dislikedFlavors: v })}
          label={flavorLabel}
        />
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <span className="field-label">1食あたりの買い足し品数の上限</span>
        <SingleChoice<number>
          options={SHOPPING_LIMIT_OPTIONS}
          value={prefs.shoppingLimitPerMeal}
          onChange={(v) => save({ ...prefs, shoppingLimitPerMeal: v })}
          label={(v) => `${v}品`}
        />
        <span className="field-hint">常備調味料にない調味料も1品として数えます。在庫が少なくて組めない日だけ上限を超えます</span>
      </div>
    </>
  );
}
