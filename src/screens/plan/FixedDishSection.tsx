import { useState } from 'react';
import { SingleChoice } from '../../components/Choice';
import { Field } from '../../components/Field';
import type { Course, FixedDish, PlanConditions } from '../../db/types';
import { removeFixed, setFixed, warningsForSlot } from '../../logic/planner/fixed';
import type { DayInput, PlannerData } from '../../logic/planner/types';
import { RecipePickerSheet } from './RecipePickerSheet';

interface Props {
  fixed: FixedDish[];
  onChange: (next: FixedDish[]) => void;
  /** 日ごとのメンバー(ゲストを含む)。注意の計算に使う。1日分(作り直し)なら「何日目」は選ばない */
  days: readonly DayInput[];
  conditions: PlanConditions;
  data: PlannerData;
}

/** 条件の画面の「料理を指定」:何日目(作り直しならその日)のどの区分に、どのレシピを入れるか */
export function FixedDishSection({ fixed, onChange, days, conditions, data }: Props) {
  const [slot, setSlot] = useState<{ dayIndex: number; course: Course }>({ dayIndex: 0, course: '主菜' });
  const [picking, setPicking] = useState(false);
  const recipesById = new Map(data.recipes.map((r) => [r.id, r]));
  const memberIdsOf = (dayIndex: number) => days[dayIndex]?.memberIds ?? [];
  const single = days.length === 1;
  /** 「2日目の主菜」、1日分なら「この日の主菜」 */
  const slotLabel = (dayIndex: number, course: Course) => `${single ? 'この日' : `${dayIndex + 1}日目`}の${course}`;

  return (
    <>
      <h3 className="section-title">料理を指定</h3>
      <p className="field-hint" style={{ marginTop: 0 }}>
        {single ? 'この日の主菜・副菜・汁物に、食べたい料理を入れられます。' : '食べたい料理を、何日目の主菜・副菜・汁物に入れるか決められます。'}
        残りの品はアプリが考えます。
      </p>
      {fixed.map((f) => {
        const recipe = recipesById.get(f.recipeId);
        const warnings = recipe ? warningsForSlot(recipe, f.dayIndex, memberIdsOf(f.dayIndex), fixed, conditions, data) : [];
        return (
          <div key={`${f.dayIndex}-${f.course}`} className="card form" style={{ gap: 6 }}>
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <span style={{ flex: 1 }}>
                {slotLabel(f.dayIndex, f.course)}:{recipe?.name ?? '(消えたレシピ)'}
              </span>
              <button type="button" className="btn btn-small" onClick={() => onChange(removeFixed(fixed, f.dayIndex, f.course))}>
                外す
              </button>
            </div>
            {warnings.map((w) => (
              <div key={w.text} className="note note-warn">
                {w.text}
              </div>
            ))}
          </div>
        );
      })}
      <div className="card form" style={{ gap: 12 }}>
        <div className={single ? undefined : 'row-2'}>
          {!single && (
            <Field label="何日目">
              <SingleChoice<number>
                options={days.map((_, i) => i)}
                value={slot.dayIndex}
                onChange={(dayIndex) => setSlot({ ...slot, dayIndex })}
                label={(v) => `${v + 1}日目`}
              />
            </Field>
          )}
          <Field label="区分">
            <SingleChoice<Course>
              options={['主菜', '副菜', '汁物']}
              value={slot.course}
              onChange={(course) => setSlot({ ...slot, course })}
            />
          </Field>
        </div>
        <button type="button" className="btn" onClick={() => setPicking(true)}>
          {slotLabel(slot.dayIndex, slot.course)}を選ぶ
        </button>
      </div>

      {picking && (
        <RecipePickerSheet
          title={`${slotLabel(slot.dayIndex, slot.course)}を選ぶ`}
          course={slot.course}
          recipes={data.recipes}
          warningsFor={(r) => warningsForSlot(r, slot.dayIndex, memberIdsOf(slot.dayIndex), fixed, conditions, data)}
          onPick={(r) => {
            onChange(setFixed(fixed, { dayIndex: slot.dayIndex, course: slot.course, recipeId: r.id }));
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
