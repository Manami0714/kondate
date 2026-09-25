import { useState } from 'react';
import { MultiChoice, SingleChoice } from '../components/Choice';
import { ErrorList, Field } from '../components/Field';
import { FoodMultiSelect } from '../components/FoodMultiSelect';
import { ALLERGENS } from '../data/allergens';
import { COOKING_METHODS, FLAVORS, flavorLabel } from '../data/tags';
import { db } from '../db/db';
import type { Appetite, Food, Member, MemberKind, Sex } from '../db/types';
import { parseAmount, validateMemberDraft, type MemberDraft } from '../logic/forms';
import { randomId } from '../logic/id';
import { autoPortion, formatPortion } from '../logic/portion';

interface Props {
  member: Member | null;
  foods: readonly Food[];
  byId: Map<string, Food>;
  onDone: () => void;
}

function toDraft(m: Member | null): MemberDraft {
  if (!m) {
    return {
      name: '',
      kind: '家族',
      sex: '女性',
      age: '',
      appetite: 'ふつう',
      portionOverride: '',
      likedFoodIds: [],
      dislikedFoodIds: [],
      allergyFoodIds: [],
      allergyAllergens: [],
      likedMethods: [],
      dislikedMethods: [],
      likedFlavors: [],
      dislikedFlavors: [],
    };
  }
  return {
    ...m,
    age: String(m.age),
    portionOverride: m.portionOverride === null ? '' : String(m.portionOverride),
  };
}

/** メンバーの登録・編集(家族もゲストも同じ形) */
export function MemberForm({ member, foods, byId, onDone }: Props) {
  const [draft, setDraft] = useState<MemberDraft>(() => toDraft(member));
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof MemberDraft>(key: K, value: MemberDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const result = validateMemberDraft(draft, member?.id ?? randomId());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    await db.members.put(result.value);
    onDone();
  };

  const remove = async () => {
    if (!member || !window.confirm(`${member.name}さんを削除しますか?`)) return;
    await db.members.delete(member.id);
    onDone();
  };

  // 今の入力から計算した自動の倍率(女性30〜49歳・ふつう=1.0倍)
  const age = parseAmount(draft.age);
  const autoText =
    age !== null && Number.isInteger(age) ? formatPortion(autoPortion(draft.sex, age, draft.appetite)) : '年齢を入れると表示';

  const foodSelect =(key: 'likedFoodIds' | 'dislikedFoodIds' | 'allergyFoodIds', title: string) => (
    <FoodMultiSelect title={title} foods={foods} byId={byId} value={draft[key]} onChange={(ids) => set(key, ids)} />
  );

  return (
    <div className="form">
      <Field label="呼び名" hint="データはこの端末の中だけに保存されます">
        <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="区分">
        <SingleChoice<MemberKind> options={['家族', 'ゲスト']} value={draft.kind} onChange={(v) => set('kind', v)} />
      </Field>
      <div className="row-2">
        <Field label="性別">
          <SingleChoice<Sex> options={['女性', '男性']} value={draft.sex} onChange={(v) => set('sex', v)} />
        </Field>
        <Field label="年齢">
          <div className="input-with-unit">
            <input className="input" inputMode="numeric" value={draft.age} onChange={(e) => set('age', e.target.value)} />
            <span>歳</span>
          </div>
        </Field>
      </div>
      <Field label="食べる量">
        <SingleChoice<Appetite>
          options={['少なめ', 'ふつう', '多め']}
          value={draft.appetite}
          onChange={(v) => set('appetite', v)}
        />
      </Field>
      <Field
        label="1人分の倍率(手で決める場合)"
        hint={`空欄なら年齢・性別・食べる量から自動で決めます(自動:${autoText})`}
      >
        <input
          className="input"
          inputMode="decimal"
          placeholder="自動"
          value={draft.portionOverride}
          onChange={(e) => set('portionOverride', e.target.value)}
        />
      </Field>

      <h3 className="section-title">アレルギー</h3>
      <Field label="アレルギー物質" hint="食品表示のアレルギー表示対象29品目から選びます。調味料や加工品に含まれるものも判定します">
        <MultiChoice options={ALLERGENS} value={draft.allergyAllergens} onChange={(v) => set('allergyAllergens', v)} />
      </Field>
      <Field label="食材で指定" hint="29品目にないものは、食材辞書から選びます">
        {foodSelect('allergyFoodIds', 'アレルギーの食材')}
      </Field>

      <h3 className="section-title">食材の好み</h3>
      <Field label="好きな食材">{foodSelect('likedFoodIds', '好きな食材')}</Field>
      <Field label="苦手な食材">{foodSelect('dislikedFoodIds', '苦手な食材')}</Field>

      <h3 className="section-title">調理法の好み</h3>
      <Field label="好きな調理法">
        <MultiChoice options={COOKING_METHODS} value={draft.likedMethods} onChange={(v) => set('likedMethods', v)} />
      </Field>
      <Field label="苦手な調理法">
        <MultiChoice options={COOKING_METHODS} value={draft.dislikedMethods} onChange={(v) => set('dislikedMethods', v)} />
      </Field>

      <h3 className="section-title">味付けの好み</h3>
      <Field label="好きな味付け">
        <MultiChoice options={FLAVORS} value={draft.likedFlavors} onChange={(v) => set('likedFlavors', v)} label={flavorLabel} />
      </Field>
      <Field label="苦手な味付け">
        <MultiChoice
          options={FLAVORS}
          value={draft.dislikedFlavors}
          onChange={(v) => set('dislikedFlavors', v)}
          label={flavorLabel}
        />
      </Field>

      <ErrorList errors={errors} />
      <button type="button" className="btn btn-primary btn-block" onClick={save}>
        保存
      </button>
      {member && (
        <button type="button" className="btn btn-danger btn-block" onClick={remove}>
          このメンバーを削除
        </button>
      )}
    </div>
  );
}
