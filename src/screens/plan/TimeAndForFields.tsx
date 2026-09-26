import { useState } from 'react';
import { SingleChoice } from '../../components/Choice';
import { Field } from '../../components/Field';
import { TIME_PRESETS } from '../../config/scoring';
import type { Difficulty, Member, PlanConditions, TimePreset } from '../../db/types';
import { DIFFICULTY_LABELS } from '../../logic/format';

interface Props {
  conditions: PlanConditions;
  onChange: (next: PlanConditions) => void;
  members: readonly Member[];
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

/** 条件のうち、らくらく/ふつう/しっかり・詳細設定・誰向け(3日分の献立と、1日の作り直しで使う) */
export function TimeAndForFields({ conditions, onChange, members }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const setConditions = (patch: Partial<PlanConditions>) => onChange({ ...conditions, ...patch });
  const byId = new Map(members.map((m) => [m.id, m]));
  const forOptions = [NOBODY, ...members.map((m) => m.id)];

  return (
    <>
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
    </>
  );
}
