import { useState } from 'react';
import { ErrorList } from '../../components/Field';
import { db } from '../../db/db';
import { markBoughtInDb } from '../../db/mealSetRepo';
import type { Food, MealSet } from '../../db/types';
import { parseAmount } from '../../logic/forms';
import { amountToInput, formatApproxAmount } from '../../logic/format';
import { defaultBoughtAmount, shoppingLines, type ShoppingLine } from '../../logic/mealSet';

interface Props {
  set: MealSet;
  foodsById: ReadonlyMap<string, Food>;
}

/** 買い足しリスト:「買った」で量を入れると在庫に足し、献立で足りなかった分をすぐ引く */
export function ShoppingList({ set, foodsById }: Props) {
  const [editing, setEditing] = useState<{ foodId: string; amount: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const lines = shoppingLines(set);
  if (lines.length === 0) return null;

  const pending = lines.filter((l) => !l.bought);
  const done = lines.filter((l) => l.bought);

  const start = (line: ShoppingLine) => {
    setErrors([]);
    setEditing({ foodId: line.foodId, amount: amountToInput(defaultBoughtAmount(foodsById.get(line.foodId), line.amount)) });
  };

  const save = async () => {
    if (!editing) return;
    const amount = parseAmount(editing.amount);
    if (amount === null || amount <= 0) {
      setErrors(['買った量を0より大きい数字で入れてください']);
      return;
    }
    const result = await markBoughtInDb(db, set.id, editing.foodId, amount, new Date());
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setEditing(null);
  };

  return (
    <>
      <h3 className="section-title">買い足しリスト</h3>
      {pending.length === 0 ? (
        <div className="empty">買い足すものはありません</div>
      ) : (
        <ul className="list">
          {pending.map((line) => {
            const food = foodsById.get(line.foodId);
            const isEditing = editing?.foodId === line.foodId;
            return (
              <li key={line.foodId} className="list-item" style={{ flexWrap: 'wrap' }}>
                <span className="list-main">
                  <span className="list-title">{food?.name ?? '(辞書にない食材)'}</span>
                  <div className="list-sub">足りない量 {food ? formatApproxAmount(line.amount, food.unit) : line.amount}</div>
                </span>
                {isEditing ? (
                  <div className="btn-row" style={{ width: '100%' }}>
                    <div className="input-with-unit" style={{ flex: 1 }}>
                      <input
                        className="input"
                        inputMode="decimal"
                        aria-label="買った量"
                        value={editing.amount}
                        onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                      />
                      <span>{food?.unit}</span>
                    </div>
                    <button type="button" className="btn" onClick={() => setEditing(null)}>
                      やめる
                    </button>
                    <button type="button" className="btn btn-primary" onClick={save}>
                      在庫に入れる
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-small" onClick={() => start(line)}>
                    買った
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ErrorList errors={errors} />
      {done.length > 0 && (
        <p className="field-hint">買ったもの:{done.map((l) => foodsById.get(l.foodId)?.name ?? l.foodId).join('、')}</p>
      )}
    </>
  );
}
