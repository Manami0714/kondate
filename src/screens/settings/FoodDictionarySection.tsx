import { useState } from 'react';
import { ErrorList } from '../../components/Field';
import { FoodForm } from '../../components/FoodForm';
import { FoodPicker } from '../../components/FoodPicker';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import type { Food } from '../../db/types';
import { findFoodUsage } from '../../logic/foodUsage';

type Mode = { type: 'closed' } | { type: 'list' } | { type: 'edit'; food: Food };

/** 候補の横に出す補足:単位と印 */
function foodNote(f: Food): string {
  return [f.unit, f.isCondiment ? '薬味' : null, f.allergenUncertain ? '要確認' : null].filter(Boolean).join('・');
}

/** 使われている場所を調べる */
async function usageOf(foodId: string): Promise<string[]> {
  const [recipes, stocks, pantry, members, mealSets] = await Promise.all([
    db.recipes.toArray(),
    db.stocks.toArray(),
    db.pantry.toArray(),
    db.members.toArray(),
    db.mealSets.toArray(),
  ]);
  return findFoodUsage(foodId, { recipes, stocks, pantry, members, mealSets });
}

/** 食材辞書の編集:探して、直して、使われていなければ削除できる */
export function FoodDictionarySection({ foods }: { foods: readonly Food[] }) {
  const [mode, setMode] = useState<Mode>({ type: 'closed' });
  const [usage, setUsage] = useState<string[] | null>(null);

  const openEdit = (food: Food) => {
    setUsage(null);
    setMode({ type: 'edit', food });
  };

  const remove = async (food: Food) => {
    const used = await usageOf(food.id);
    if (used.length > 0) {
      setUsage(used);
      return;
    }
    if (!window.confirm(`「${food.name}」を辞書から削除しますか?`)) return;
    await db.foods.delete(food.id);
    setMode({ type: 'list' });
  };

  return (
    <>
      <h2 className="section-title">食材辞書({foods.length}件)</h2>
      <p className="muted">食材の名前・別名・単位・アレルギー物質などを直せます。</p>
      <button type="button" className="btn btn-block" onClick={() => setMode({ type: 'list' })}>
        食材辞書を開く
      </button>

      {mode.type === 'list' && (
        <Sheet title="食材辞書" onClose={() => setMode({ type: 'closed' })}>
          <FoodPicker foods={foods} allowAddNew note={foodNote} onPick={openEdit} />
        </Sheet>
      )}

      {mode.type === 'edit' && (
        <Sheet title={`${mode.food.name}を編集`} onClose={() => setMode({ type: 'list' })}>
          <FoodForm
            key={mode.food.id}
            food={mode.food}
            foods={foods}
            onSaved={() => setMode({ type: 'list' })}
            onCancel={() => setMode({ type: 'list' })}
          />
          <div style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-danger btn-block" onClick={() => remove(mode.food)}>
              この食材を削除
            </button>
            {usage && <ErrorList errors={['削除できません。次の場所で使われています:' + usage.join('、')]} />}
          </div>
        </Sheet>
      )}
    </>
  );
}
