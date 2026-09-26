import { useState } from 'react';
import { SingleChoice } from '../../components/Choice';
import { ErrorList, Field } from '../../components/Field';
import type { DateString, FixedDish, GuestStay, MealSet, Member, PlanConditions } from '../../db/types';
import { formatShortDate } from '../../logic/date';
import { carryOverGuests, guestStay } from '../../logic/planner/days';
import type { DayInput, PlannerData } from '../../logic/planner/types';
import { FixedDishSection } from './FixedDishSection';
import { TimeAndForFields } from './TimeAndForFields';

export interface ConditionState {
  startDate: DateString;
  conditions: PlanConditions;
  /** この画面で追加したゲスト(前のセットからの引き継ぎは含まない) */
  addedGuests: GuestStay[];
  /** 料理の指定 */
  fixed: FixedDish[];
}

interface Props {
  value: ConditionState;
  onChange: (next: ConditionState) => void;
  members: readonly Member[];
  mealSets: readonly MealSet[];
  /** 日ごとのメンバー(ゲストを含む)。料理の指定の注意に使う */
  days: readonly DayInput[];
  data: PlannerData;
  errors: string[];
  /** 日付が重なったときに勧める開始日(次に作れる日)。なければ null */
  suggestedStart: DateString | null;
  onSubmit: () => void;
}

/** 条件を選ぶ:開始日・らくらく/ふつう/しっかり・詳細設定・誰向け・ゲスト・料理の指定 */
export function ConditionForm({ value, onChange, members, mealSets, days, data, errors, suggestedStart, onSubmit }: Props) {
  const [guestDraft, setGuestDraft] = useState<{ memberId: string | null; fromDay: number; days: number }>({
    memberId: null,
    fromDay: 1,
    days: 1,
  });

  const byId = new Map(members.map((m) => [m.id, m]));
  const guests = members.filter((m) => m.kind === 'ゲスト');
  const carried = carryOverGuests(mealSets, value.startDate);
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

      <TimeAndForFields conditions={value.conditions} onChange={(conditions) => onChange({ ...value, conditions })} members={members} />

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

      <FixedDishSection
        fixed={value.fixed}
        onChange={(fixed) => onChange({ ...value, fixed })}
        days={days}
        conditions={value.conditions}
        data={data}
      />

      <ErrorList errors={errors} />
      {suggestedStart && (
        <div className="card form" style={{ gap: 8 }}>
          <span>{formatShortDate(suggestedStart)}から作れます</span>
          <button type="button" className="btn" onClick={() => onChange({ ...value, startDate: suggestedStart })}>
            開始日を{formatShortDate(suggestedStart)}にする
          </button>
        </div>
      )}
      <button type="button" className="btn btn-primary btn-block" onClick={onSubmit}>
        3日分を提案
      </button>
    </div>
  );
}
