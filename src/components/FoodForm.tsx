import { useState } from 'react';
import { ALLERGENS } from '../data/allergens';
import { db } from '../db/db';
import type { Food, FoodGroup, FoodKind } from '../db/types';
import { foodToDraft, validateFoodDraft, type FoodDraft } from '../logic/forms';
import { randomId } from '../logic/id';
import { MultiChoice, SingleChoice } from './Choice';
import { ErrorList, Field } from './Field';

interface Props {
  /** 編集する食材。null なら新しく追加する */
  food?: Food | null;
  /** 追加するときの最初の名前 */
  initialName?: string;
  foods: readonly Food[];
  onSaved: (food: Food) => void;
  onCancel: () => void;
}

const GROUP_OPTIONS = ['赤', '緑', '黄'] as const;
const GROUP_HINT = '赤=肉・魚・卵・豆、緑=野菜・海藻・きのこ、黄=穀物・いも・油';

function emptyDraft(name: string): FoodDraft {
  return {
    name,
    aliasesText: '',
    unit: '',
    usualAmount: '1',
    kind: '食材',
    foodGroup: null,
    shelfLifeDays: '7',
    isCondiment: false,
    allergens: [],
    allergenUncertain: false,
  };
}

/** 食材辞書の追加・編集フォーム */
export function FoodForm({ food = null, initialName = '', foods, onSaved, onCancel }: Props) {
  const [draft, setDraft] = useState<FoodDraft>(() => (food ? foodToDraft(food) : emptyDraft(initialName)));
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof FoodDraft>(key: K, value: FoodDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const result = validateFoodDraft(draft, foods, food?.id ?? `user_${randomId()}`);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    await db.foods.put(result.value);
    onSaved(result.value);
  };

  return (
    <div className="form">
      {!food && <p className="muted">辞書にない食材を追加します。</p>}
      <Field label="食材名">
        <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="別名" hint="「、」で区切って複数入れられます(例:ﾀﾏｺﾞ、玉子)">
        <input className="input" value={draft.aliasesText} onChange={(e) => set('aliasesText', e.target.value)} />
      </Field>
      {food ? (
        <Field label="区分">
          <span>{draft.kind}</span>
        </Field>
      ) : (
        <Field label="区分">
          <SingleChoice<FoodKind> options={['食材', '調味料']} value={draft.kind} onChange={(v) => set('kind', v)} />
        </Field>
      )}
      {draft.kind === '食材' && (
        <Field label="食品グループ" hint={GROUP_HINT}>
          <SingleChoice<FoodGroup>
            options={GROUP_OPTIONS}
            value={draft.foodGroup}
            onChange={(v) => set('foodGroup', v)}
          />
        </Field>
      )}
      {draft.kind === '食材' && (
        <Field label="薬味" hint="ねぎ・生姜など、風味づけに少し使うもの。薬味は主な材料にしません">
          <SingleChoice<'薬味ではない' | '薬味'>
            options={['薬味ではない', '薬味']}
            value={draft.isCondiment ? '薬味' : '薬味ではない'}
            onChange={(v) => set('isCondiment', v === '薬味')}
          />
        </Field>
      )}
      <Field label="含まれるアレルギー物質" hint="一般的な商品に含まれることが多いものを選びます">
        <MultiChoice options={ALLERGENS} value={draft.allergens} onChange={(v) => set('allergens', v)} />
      </Field>
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.allergenUncertain}
          onChange={(e) => set('allergenUncertain', e.target.checked)}
        />
        <span>アレルギー物質は要確認(商品によって差が大きい・わからない)</span>
      </label>
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
      {food && food.unit !== draft.unit.trim() && (
        <p className="field-hint">単位を変えても、在庫やレシピの量の数字はそのままです。必要なら量も直してください。</p>
      )}
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
          {food ? '保存' : '辞書に追加'}
        </button>
      </div>
    </div>
  );
}
