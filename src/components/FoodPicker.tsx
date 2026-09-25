import { useMemo, useState } from 'react';
import type { Food, FoodKind } from '../db/types';
import { findFoodByExactName, searchFoods } from '../logic/foodSearch';
import { FoodForm } from './FoodForm';

interface Props {
  foods: readonly Food[];
  onPick: (food: Food) => void;
  /** 食材だけ・調味料だけに絞る */
  kind?: FoodKind;
  /** 候補から外す食材(すでに選んだものなど) */
  excludeIds?: readonly string[];
  /** 見つからないとき、その場で辞書に追加できるようにする */
  allowAddNew?: boolean;
  /** 候補の横に出す補足(在庫の量など) */
  note?: (food: Food) => string | undefined;
}

/** 食材辞書から名前・別名で探して1つ選ぶ */
export function FoodPicker({ foods, onPick, kind, excludeIds = [], allowAddNew = false, note }: Props) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const candidates = useMemo(
    () => foods.filter((f) => (kind ? f.kind === kind : true) && !excludeIds.includes(f.id)),
    [foods, kind, excludeIds],
  );
  const results = useMemo(
    () => (query.trim() === '' ? candidates : searchFoods(candidates, query, 50)),
    [candidates, query],
  );
  const exact = findFoodByExactName(foods, query);

  if (adding) {
    return (
      <FoodForm
        initialName={query.trim()}
        foods={foods}
        onCancel={() => setAdding(false)}
        onSaved={(food) => {
          setAdding(false);
          onPick(food);
        }}
      />
    );
  }

  return (
    <div className="form">
      <input
        className="input"
        type="search"
        placeholder="食材名で探す(例:たまねぎ)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {allowAddNew && query.trim() !== '' && !exact && (
        <button type="button" className="btn btn-block" onClick={() => setAdding(true)}>
          「{query.trim()}」を辞書に追加する
        </button>
      )}
      {results.length === 0 ? (
        <div className="empty">見つかりません</div>
      ) : (
        <ul className="list">
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" className="list-item" onClick={() => onPick(f)}>
                <span className="group-dot" data-group={f.foodGroup ?? ''} aria-hidden="true" />
                <span className="list-main">
                  <span className="list-title">{f.name}</span>
                  {f.aliases.length > 0 && <span className="list-sub"> {f.aliases.slice(0, 3).join('・')}</span>}
                </span>
                <span className="list-end muted">{note?.(f) ?? f.unit}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
