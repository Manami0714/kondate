import { useMemo, useState } from 'react';
import { ErrorList } from '../../components/Field';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { saveRebuildDraft } from '../../db/draftRepo';
import { refillDayInDb } from '../../db/mealSetRepo';
import type { DateString, FixedDish, Member, PlanConditions, RebuildDraft } from '../../db/types';
import type { PlannerSource } from '../../hooks/usePlannerData';
import { formatDayLabel, toDateTimeString } from '../../logic/date';
import { randomId } from '../../logic/id';
import { fixedRecipeId, needsConfirm, removeFixed, setFixed, warningsForSlot } from '../../logic/planner/fixed';
import { pinDish } from '../../logic/planner/pin';
import { makePlan } from '../../logic/planner/plan';
import { canRebuildDay, rebuildRequest } from '../../logic/planner/rebuild';
import { summarizePlan, type DishDetail } from '../../logic/planner/summary';
import { swapDish } from '../../logic/planner/swap';
import { COURSE_SLOTS, type Dishes, type PlannedDay } from '../../logic/planner/types';
import { formatDayTotal } from '../../logic/portion';
import { defaultRng } from '../../logic/random';
import { RecipeDetail } from '../RecipeDetail';
import { FixedDishSection } from './FixedDishSection';
import { ProposalView } from './ProposalView';
import { RecipePickerSheet } from './RecipePickerSheet';
import { TimeAndForFields } from './TimeAndForFields';

interface Props {
  src: PlannerSource;
  today: DateString;
  /** 作り直し用の下書き。画面の状態はここから始め、変えるたびに保存し直す */
  draft: RebuildDraft;
}

/** 作り直しの画面の状態(下書きに保存するもの) */
interface State {
  conditions: PlanConditions;
  fixed: FixedDish[];
  /** 1日分の提案。条件を選んでいる途中なら null */
  plan: PlannedDay[] | null;
  shown: Record<string, string[]>;
}

/** 「この日の献立を作り直す」:キャンセルした1日分を、条件を選び直して提案し、確定で同じ献立セットに入れる */
export function RebuildWizard({ src, today, draft }: Props) {
  const [state, setState] = useState<State>(() => ({
    conditions: draft.conditions,
    fixed: draft.fixed,
    plan: draft.day ? [draft.day] : null,
    shown: draft.shown,
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<{ dish: DishDetail; label: string } | null>(null);
  const [picking, setPicking] = useState<keyof Dishes | null>(null);

  const set = src.mealSets.find((s) => s.id === draft.mealSetId);
  const { plan } = state;
  const summary = useMemo(() => (plan ? summarizePlan(plan, src.data).days : []), [plan, src.data]);

  if (!set || !canRebuildDay(set, draft.dayIndex, src.mealSets, today)) {
    return <p className="muted">この日は作り直せなくなりました(日付が過ぎた、ほかの献立が入ったなど)。「やめる」で戻ってください。</p>;
  }

  const date = set.days[draft.dayIndex].date;
  const request = rebuildRequest(set, draft.dayIndex, src.members, state.conditions, state.fixed);
  const dayMembers = request.days[0]?.memberIds ?? [];
  const courseOf = (key: keyof Dishes) => COURSE_SLOTS.find((s) => s.key === key)?.course ?? '主菜';

  /** 状態を変えて、作り直し用の下書きにも保存する(タブの切り替えやアプリを閉じても消えないように) */
  const commit = (next: State) => {
    setState(next);
    void saveRebuildDraft(db, {
      savedAt: toDateTimeString(new Date()),
      mealSetId: draft.mealSetId,
      dayIndex: draft.dayIndex,
      conditions: next.conditions,
      fixed: next.fixed,
      day: next.plan?.[0] ?? null,
      shown: next.shown,
    });
  };

  const propose = () => {
    const result = makePlan(request, src.data, defaultRng);
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setErrors([]);
    commit({ ...state, plan: result.days, shown: {} });
  };

  const swap = (_dayIndex: number, key: keyof Dishes) => {
    if (!plan) return;
    const seen = [...(state.shown[key] ?? []), plan[0][key]];
    let result = swapDish(request, src.data, plan, 0, key, seen);
    let nextSeen = seen;
    if (!result.ok && seen.length > 1) {
      // 候補をひと回り見せたら、最初から見せ直す
      nextSeen = [plan[0][key]];
      result = swapDish(request, src.data, plan, 0, key, nextSeen);
    }
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setErrors([]);
    commit({ ...state, plan: result.days, shown: { ...state.shown, [key]: nextSeen } });
  };

  const pin = (key: keyof Dishes, recipeId: string) => {
    if (!plan) return;
    const fixed = setFixed(state.fixed, { dayIndex: 0, course: courseOf(key), recipeId });
    const result = pinDish({ ...request, fixed }, src.data, plan, 0, key);
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setErrors([]);
    commit({ ...state, fixed, plan: result.days });
  };

  const confirm = async () => {
    if (!plan) return;
    if (summary.some((d) => d.dishes.length < 3)) {
      setErrors(['献立にないレシピがあります。「条件からやり直す」で作り直してください']);
      return;
    }
    setBusy(true);
    try {
      // うまくいくと作り直し用の下書きが消え、献立の画面に戻る
      const result = await refillDayInDb(db, {
        mealSetId: set.id,
        dayIndex: draft.dayIndex,
        day: plan[0],
        data: src.data,
        now: new Date(),
        newId: randomId,
      });
      if (!result.ok) setErrors([result.error]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {plan ? (
        <ProposalView
          plan={plan}
          summary={summary}
          foodsById={src.foodsById}
          shoppingLimit={src.data.household.shoppingLimitPerMeal}
          errors={errors}
          busy={busy}
          isFixed={(_dayIndex, key) => fixedRecipeId(state.fixed, 0, courseOf(key)) !== null}
          fixedNotes={(_dayIndex, dish) =>
            fixedRecipeId(state.fixed, 0, dish.recipe.course) === dish.recipe.id
              ? warningsForSlot(dish.recipe, 0, dayMembers, state.fixed, state.conditions, src.data)
                  // アレルギー・食後の嫌いは、どの料理にも summarizePlan の注意で出ている
                  .filter((w) => !needsConfirm([w]))
                  .map((w) => w.text)
              : []
          }
          onOpenDish={(dish, label) => setOpened({ dish, label })}
          onSwap={swap}
          onPick={(_dayIndex, key) => setPicking(key)}
          onUnfix={(_dayIndex, key) => commit({ ...state, fixed: removeFixed(state.fixed, 0, courseOf(key)) })}
          onRetry={propose}
          onBack={() => {
            setErrors([]);
            commit({ ...state, plan: null, shown: {} });
          }}
          onConfirm={confirm}
          confirmLabel="この日の献立で確定(在庫から減らす)"
        />
      ) : (
        <div className="form">
          <div className="card">
            <div>{formatDayLabel(date)}の献立を、1日分だけ作り直します。</div>
            <div className="muted">{formatDayTotal(dayMembers.map((id) => src.data.membersById.get(id)).filter((m): m is Member => m !== undefined))}</div>
            <div className="field-hint">同じ献立のほかの日と同じ料理は出ません。</div>
          </div>
          <TimeAndForFields
            conditions={state.conditions}
            onChange={(conditions) => commit({ ...state, conditions })}
            members={src.members}
          />
          <FixedDishSection
            fixed={state.fixed}
            onChange={(fixed) => commit({ ...state, fixed })}
            days={request.days}
            conditions={state.conditions}
            data={src.data}
          />
          <ErrorList errors={errors} />
          <button type="button" className="btn btn-primary btn-block" onClick={propose}>
            この日の献立を提案
          </button>
        </div>
      )}

      {picking && plan && (
        <RecipePickerSheet
          title={`この日の${courseOf(picking)}を選ぶ`}
          course={courseOf(picking)}
          recipes={src.data.recipes}
          warningsFor={(r) => warningsForSlot(r, 0, dayMembers, state.fixed, state.conditions, src.data)}
          onPick={(r) => {
            pin(picking, r.id);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}

      {opened && (
        <Sheet title={opened.dish.recipe.name} onClose={() => setOpened(null)}>
          <RecipeDetail
            recipe={opened.dish.recipe}
            byId={src.foodsById}
            scaled={{ ingredients: opened.dish.ingredients, label: opened.label }}
            warnings={opened.dish.safetyWarnings}
          />
        </Sheet>
      )}
    </>
  );
}
