import { useState } from 'react';
import { db } from '../db/db';
import type { Food, FoodGroup, FoodKind } from '../db/types';
import { validateFoodDraft, type FoodDraft } from '../logic/forms';
import { randomId } from '../logic/id';
import { SingleChoice } from './Choice';
import { ErrorList, Field } from './Field';

interface Props {
  initialName: string;
  foods: readonly Food[];
  onSaved: (food: Food) => void;
  onCancel: () => void;
}

const GROUP_OPTIONS = ['赤', '緑', '黄'] as const;
const GROUP_HINT = '赤=肉・魚・卵・豆、緑=野菜・海藻・きのこ、黄=穀物・いも・油';

/** 食材辞書にその場で追加するフォーム */
export function FoodForm({ initialName, foods, onSaved, onCancel }: Props) {
  const [draft, setDraft] = useState<FoodDraft>({
    name: initialName,
    aliasesText: '',
    unit: '',
    usualAmount: '1',
    kind: '食材',
    foodGroup: null,
    shelfLifeDays: '7',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof FoodDraft>(key: K, value: FoodDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const result = validateFoodDraft(draft, foods, `user_${randomId()}`);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    await db.foods.add(result.value);
    onSaved(result.value);
  };

  return (
    <div className="form">
      <p className="muted">辞書にない食材を追加します。</p>
      <Field label="食材名">
        <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="別名" hint="「、」で区切って複数入れられます(例:ﾀﾏｺﾞ、玉子)">
        <input className="input" value={draft.aliasesText} onChange={(e) => set('aliasesText', e.target.value)} />
      </Field>
      <Field label="区分">
        <SingleChoice<FoodKind> options={['食材', '調味料']} value={draft.kind} onChange={(v) => set('kind', v)} />
      </Field>
      {draft.kind === '食材' && (
        <Field label="食品グループ" hint={GROUP_HINT}>
          <SingleChoice<FoodGroup>
            options={GROUP_OPTIONS}
            value={draft.foodGroup}
            onChange={(v) => set('foodGroup', v)}
          />
        </Field>
      )}
      <div className="row-2">
        <Field label="単位" hint="例:個、本、g">
          <input className="input" value={draft.unit} onChange={(e) => set('unit', e.target.value)} />
        </Field>
        <Field label="ふつうの量" hint="1回に買う量">
          <input
            className="input"
            inputMode="decimal"
            value={draft.usualAmount}
            onChange={(e) => set('usualAmount', e.target.value)}
          />
        </Field>
      </div>
      <Field label="保存の目安日数">
        <input
          className="input"
          inputMode="numeric"
          value={draft.shelfLifeDays}
          onChange={(e) => set('shelfLifeDays', e.target.value)}
        />
      </Field>
      <ErrorList errors={errors} />
      <div className="btn-row">
        <button type="button" className="btn" onClick={onCancel}>
          やめる
        </button>
        <button type="button" className="btn btn-primary" onClick={save}>
          辞書に追加
        </button>
      </div>
    </div>
  );
}
