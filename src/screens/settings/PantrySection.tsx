import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Food } from '../../db/types';

/** 常備調味料:辞書の調味料からチェックで選ぶ */
export function PantrySection({ foods }: { foods: readonly Food[] }) {
  const pantry = useLiveQuery(() => db.pantry.toArray(), []);
  if (!pantry) return null;
  const checked = new Set(pantry.map((p) => p.foodId));
  const seasonings = foods.filter((f) => f.kind === '調味料');

  const toggle = async (foodId: string) => {
    if (checked.has(foodId)) await db.pantry.delete(foodId);
    else await db.pantry.put({ foodId });
  };

  return (
    <>
      <h2 className="section-title">常備調味料({checked.size}件)</h2>
      <p className="muted">いつも家にある調味料にチェックを入れます。チェックのない調味料がレシピに出たら「買い足し」になります。</p>
      <div className="list">
        {seasonings.map((f) => (
          <label key={f.id} className="check-row">
            <input type="checkbox" checked={checked.has(f.id)} onChange={() => toggle(f.id)} />
            <span>{f.name}</span>
          </label>
        ))}
      </div>
      <p className="field-hint">辞書にない調味料は、在庫やレシピの材料の画面から「調味料」として辞書に追加できます。</p>
    </>
  );
}
