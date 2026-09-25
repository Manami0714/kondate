import { useState } from 'react';
import type { Food } from '../db/types';
import { FoodPicker } from './FoodPicker';
import { Sheet } from './Sheet';

interface Props {
  title: string;
  foods: readonly Food[];
  byId: Map<string, Food>;
  value: string[];
  onChange: (ids: string[]) => void;
}

/** 食材を複数選ぶ(選んだものはタップで外せる) */
export function FoodMultiSelect({ title, foods, byId, value, onChange }: Props) {
  const [picking, setPicking] = useState(false);

  return (
    <>
      <div className="segmented">
        {value.map((id) => (
          <button
            key={id}
            type="button"
            className="chip is-on chip-removable"
            aria-label={`${byId.get(id)?.name ?? id}を外す`}
            onClick={() => onChange(value.filter((v) => v !== id))}
          >
            {byId.get(id)?.name ?? '(辞書にない食材)'}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setPicking(true)}>
          ＋ 選ぶ
        </button>
      </div>
      {picking && (
        <Sheet title={title} onClose={() => setPicking(false)}>
          <FoodPicker
            foods={foods}
            excludeIds={value}
            allowAddNew
            onPick={(food) => {
              onChange([...value, food.id]);
              setPicking(false);
            }}
          />
        </Sheet>
      )}
    </>
  );
}
