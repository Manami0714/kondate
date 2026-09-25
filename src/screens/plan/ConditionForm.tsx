import { useState } from 'react';
import { SingleChoice } from '../../components/Choice';
import { ErrorList, Field } from '../../components/Field';
import { TIME_PRESETS } from '../../config/scoring';
import type { DateString, Difficulty, GuestStay, MealSet, Member, PlanConditions, TimePreset } from '../../db/types';
import { formatShortDate } from '../../logic/date';
import { DIFFICULTY_LABELS } from '../../logic/format';
import { carryOverGuests, guestStay } from '../../logic/planner/days';

export interface ConditionState {
  startDate: DateString;
  conditions: PlanConditions;
  /** この画面で追加したゲスト(前のセットからの引き継ぎは含まない) */
  addedGuests: GuestStay[];
}

interface Props {
  value: ConditionState;
  onChange: (next: ConditionState) => void;
  members: readonly Member[];
  mealSets: readonly MealSet[];
  errors: string[];
  onSubmit: () => void;
}

const PRESET_HINTS: Record<TimePreset, string> = {
  らくらく: '1品20分以内・かんたんのみ',
  ふつう: '1品40分以内・ふつうまで',
  しっかり: '時間の上限なし・むずかしいまで。時間をかけた料理が出やすくなります',
};

/** 詳細設定で選べる最大調理時間。null は上限なし */
const MINUTE_OPTIONS = ['10', '15', '20', '30', '40', '60', 'なし'] as const;
type MinuteOption = (typeof MINUTE_OPTIONS)[number];

const NOBODY = 'だれでも';

/** 条件を選ぶ:開始日・らくらく/ふつう/しっかり・詳細設定・誰向け・ゲスト */
export function ConditionForm({ value, onChange, members, mealSets, errors, onSubmit }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [guestDraft, setGuestDraft] = useState<{ memberId: string | null; fromDay: number; days: number }>({
    memberId: null,
    fromDay: 1,
    days: 1,
  });
  const { conditions } = value;
  const setConditions = (patch: Partial<PlanConditions>) => onChange({ ...value, conditions: { ...conditions, ...patch } });

  const byId = new Map(members.map((m) => [m.id, m]));
  const guests = members.filter((m) => m.kind === 'ゲスト');
  const carried = carryOverGuests(mealSets, value.startDate);
  const forOptions = [NOBODY, ...members.map((m) => m.id)];
  const stayLabel = (g: GuestStay) =>
    `${byId.get(g.memberId)?.name ?? '(削除したメンバー)'}:${formatShortDate(g.fromDate)}〜${formatShortDate(g.toDate)}`;

  const addGuest = () => {
    if (!guestDraft.memberId) return;
    const stay = guestStay(guestDraft.memberId, value.startDate, guestDraft.fromDay, guestDraft.days);
    onChange({ ...value, addedGuests: [...value.addedGuests, stay] });
    setGuestDraft({ memberId: null, fromDay: 1, days: 1 });
  };

  return (
    <div className="form">
      <Field label="開始日" hint="この日から3日分の夕飯を考えます">
        <input
          className="input"
          type="date"
          value={value.startDate}
          onChange={(e) => e.target.value && onChange({ ...value, startDate: e.target.value })}
        />
      </Field>

      <Field label="時間・難易度" hint={PRESET_HINTS[conditions.preset]}>
        <SingleChoice<TimePreset>
          options={['らくらく', 'ふつう', 'しっかり']}
          value={conditions.preset}
          onChange={(preset) => setConditions({ preset, ...TIME_PRESETS[preset] })}
        />
      </Field>
      <button type="button" className="btn btn-small" onClick={() => setDetailOpen(!detailOpen)}>
        {detailOpen ? '詳細設定を閉じる' : '詳細設定(時間と難易度を個別に選ぶ)'}
      </button>
      {detailOpen && (
        <>
          <Field label="1品の最大調理時間">
            <SingleChoice<MinuteOption>
              options={MINUTE_OPTIONS}
              value={conditions.maxMinutes === null ? 'なし' : (MINUTE_OPTIONS.find((o) => o === String(conditions.maxMinutes)) ?? null)}
              onChange={(v) => setConditions({ maxMinutes: v === 'なし' ? null : Number(v) })}
              label={(v) => (v === 'なし' ? '上限なし' : `${v}分`)}
            />
          </Field>
          <Field label="難易度">
            <SingleChoice<Difficulty>
              options={[1, 2, 3]}
              value={conditions.maxDifficulty}
              onChange={(v) => setConditions({ maxDifficulty: v })}
              label={(v) => `${DIFFICULTY_LABELS[v]}まで`}
            />
          </Field>
        </>
      )}

      <Field label="誰向け" hint="選んだ人の好みが強めに出ます。量の計算は変わりません">
        <SingleChoice<string>
          options={forOptions}
          value={conditions.forMemberId ?? NOBODY}
          onChange={(v) => setConditions({ forMemberId: v === NOBODY ? null : v })}
          label={(v) => (v === NOBODY ? NOBODY : (byId.get(v)?.name ?? ''))}
        />
      </Field>

      <h3 className="section-title">ゲスト</h3>
      {carried.length > 0 && (
        <div className="muted">前の献立から引き継ぎ:{carried.map(stayLabel).join('、')}</div>
      )}
      {value.addedGuests.map((g, i) => (
        <div key={i} className="btn-row" style={{ alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{stayLabel(g)}</span>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => onChange({ ...value, addedGuests: value.addedGuests.filter((_, j) => j !== i) })}
          >
            外す
          </button>
        </div>
      ))}
      {guests.length === 0 ? (
        <p className="field-hint">ゲストは、メンバー画面で区分を「ゲスト」にして登録すると選べます。</p>
      ) : (
        <div className="card form" style={{ gap: 12 }}>
          <Field label="ゲストを追加">
            <SingleChoice<string>
              options={guests.map((g) => g.id)}
              value={guestDraft.memberId}
              onChange={(memberId) => setGuestDraft({ ...guestDraft, memberId })}
              label={(id) => byId.get(id)?.name ?? ''}
            />
          </Field>
          <div className="row-2">
            <Field label="何日目から">
              <SingleChoice<number>
                options={[1, 2, 3]}
                value={guestDraft.fromDay}
                onChange={(fromDay) => setGuestDraft({ ...guestDraft, fromDay })}
                label={(v) => `${v}日目`}
              />
            </Field>
            <Field label="何日間">
              <SingleChoice<number>
                options={[1, 2, 3]}
                value={guestDraft.days}
                onChange={(days) => setGuestDraft({ ...guestDraft, days })}
                label={(v) => `${v}日間`}
              />
            </Field>
          </div>
          <span className="field-hint">献立の3日を超える分は、次の献立に引き継がれます。</span>
          <button type="button" className="btn" disabled={!guestDraft.memberId} onClick={addGuest}>
            このゲストを追加
          </button>
        </div>
      )}

      <ErrorList errors={errors} />
      <button type="button" className="btn btn-primary btn-block" onClick={onSubmit}>
        3日分を提案
      </button>
    </div>
  );
}
