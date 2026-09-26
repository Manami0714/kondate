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
    gramsPerUnit: '',
    altUnits: [],
  };
}

interface AltUnitsProps {
  /** 辞書の単位 */
  unit: string;
  rows: FoodDraft['altUnits'];
  onChange: (rows: FoodDraft['altUnits']) => void;
}

/** ほかの数え方の入力(「1 枚 = 0.1 個」の行を足したり消したりする) */
function AltUnitsField({ unit, rows, onChange }: AltUnitsProps) {
  const unitLabel = unit || '単位';
  const update = (index: number, patch: Partial<FoodDraft['altUnits'][number]>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  return (
    <Field
      label="ほかの数え方"
      hint={`レシピや口頭入力で、辞書と違う数え方(例:キャベツ 1枚=0.1個)で書かれた量を${unitLabel}に換算するのに使います`}
    >
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>1</span>
          <input
            className="input"
            style={{ width: 72 }}
            aria-label={`ほかの数え方${i + 1}の単位`}
            placeholder="枚"
            value={row.unit}
            onChange={(e) => update(i, { unit: e.target.value })}
          />
          <span>=</span>
          <input
            className="input"
            style={{ width: 80 }}
            inputMode="decimal"
            aria-label={`ほかの数え方${i + 1}の量`}
            value={row.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
          />
          <span>{unitLabel}</span>
          <button
            type="button"
            className="btn btn-small btn-danger"
            aria-label={`ほかの数え方${i + 1}を消す`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={() => onChange([...rows, { unit: '', amount: '' }])}>
        ＋ 数え方を足す
      </button>
    </Field>
  );
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
      {draft.unit.trim() !== 'g' && (
        <Field
          label={`1${draft.unit.trim() || '単位'}あたりの重さ(g)`}
          hint="レシートの「5kg」のように重さで書かれた量を換算するのに使います。わからなければ空欄(ふつうの量になります)"
        >
          <input
            className="input"
            inputMode="decimal"
            value={draft.gramsPerUnit}
            onChange={(e) => set('gramsPerUnit', e.target.value)}
          />
        </Field>
      )}
      <AltUnitsField
        unit={draft.unit.trim()}
        rows={draft.altUnits}
        onChange={(rows) => set('altUnits', rows)}
      />
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
