import { useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { TIME_PRESETS } from '../../config/scoring';
import { db } from '../../db/db';
import { deleteDraft, saveDraft } from '../../db/draftRepo';
import { confirmPlanToDb } from '../../db/mealSetRepo';
import type { DateString, FixedDish, GuestStay, PlanDraft } from '../../db/types';
import type { PlannerSource } from '../../hooks/usePlannerData';
import { toDateTimeString } from '../../logic/date';
import { randomId } from '../../logic/id';
import { buildDays, carryOverGuests, defaultStartDate, overlapsExisting } from '../../logic/planner/days';
import { fixedRecipeId, needsConfirm, removeFixed, setFixed, warningsForSlot } from '../../logic/planner/fixed';
import { pinDish } from '../../logic/planner/pin';
import { makePlan } from '../../logic/planner/plan';
import { summarizePlan, type DishDetail } from '../../logic/planner/summary';
import { swapDish } from '../../logic/planner/swap';
import { COURSE_SLOTS, type Dishes, type PlannedDay, type PlanRequest } from '../../logic/planner/types';
import { defaultRng } from '../../logic/random';
import { RecipeDetail } from '../RecipeDetail';
import { ConditionForm, type ConditionState } from './ConditionForm';
import { ProposalView } from './ProposalView';
import { RecipePickerSheet } from './RecipePickerSheet';

interface Props {
  src: PlannerSource;
  today: DateString;
  /** 保存してある下書き。あればその提案から始める */
  draft: PlanDraft | null;
  onDone: () => void;
}

/** 献立を作る流れ:条件を選ぶ → 3日分の提案(入れ替え・やり直し)→ 確定 */
export function PlanWizard({ src, today, draft, onDone }: Props) {
  const [cond, setCond] = useState<ConditionState>(() =>
    draft
      ? { startDate: draft.startDate, conditions: draft.conditions, addedGuests: draft.addedGuests, fixed: draft.fixed ?? [] }
      : {
          startDate: defaultStartDate(src.mealSets, today),
          conditions: { preset: 'ふつう', ...TIME_PRESETS['ふつう'], forMemberId: null },
          addedGuests: [],
          fixed: [],
        },
  );
  const [plan, setPlan] = useState<PlannedDay[] | null>(() => draft?.days ?? null);
  /** 提案に使ったゲストの滞在(確定のときに献立セットに記録する) */
  const [proposalGuests, setProposalGuests] = useState<GuestStay[]>(() => draft?.guests ?? []);
  /** 枠ごとに、すでに見せた品(入れ替えで同じ品に戻らないようにする) */
  const [shown, setShown] = useState<Record<string, string[]>>(() => draft?.shown ?? {});
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<{ dish: DishDetail; label: string } | null>(null);
  /** 提案の画面で、料理を選んでいる枠 */
  const [picking, setPicking] = useState<{ dayIndex: number; key: keyof Dishes } | null>(null);

  const guests = [...carryOverGuests(src.mealSets, cond.startDate), ...cond.addedGuests];
  const conditionDays = buildDays(cond.startDate, src.members, guests);
  const summary = useMemo(() => (plan ? summarizePlan(plan, src.data).days : []), [plan, src.data]);
  // 提案のときの日付・メンバーと条件・料理の指定(入れ替えに使う)
  const request = useMemo<PlanRequest | null>(
    () =>
      plan
        ? { days: plan.map((d) => ({ date: d.date, memberIds: d.memberIds })), conditions: cond.conditions, fixed: cond.fixed }
        : null,
    [plan, cond.conditions, cond.fixed],
  );
  const courseOf = (key: keyof Dishes) => COURSE_SLOTS.find((s) => s.key === key)?.course ?? '主菜';

  /** 提案を下書きとして保存する(タブの切り替えやアプリを閉じても消えないように) */
  const keep = (days: PlannedDay[], nextShown: Record<string, string[]>, stays: GuestStay[], fixed: FixedDish[] = cond.fixed) => {
    setPlan(days);
    setShown(nextShown);
    setProposalGuests(stays);
    void saveDraft(db, {
      savedAt: toDateTimeString(new Date()),
      startDate: cond.startDate,
      conditions: cond.conditions,
      addedGuests: cond.addedGuests,
      guests: stays,
      days,
      shown: nextShown,
      fixed,
    });
  };

  /** 提案の画面で、枠に料理を指定する(かぶる品だけ選び直す) */
  const pin = (dayIndex: number, key: keyof Dishes, recipeId: string) => {
    if (!request || !plan) return;
    const fixed = setFixed(cond.fixed, { dayIndex, course: courseOf(key), recipeId });
    const result = pinDish({ ...request, fixed }, src.data, plan, dayIndex, key);
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setErrors([]);
    setCond({ ...cond, fixed });
    keep(result.days, shown, proposalGuests, fixed);
  };

  /** 指定を外す。料理はそのまま残り、アプリが選んだ品の扱いに戻る */
  const unfix = (dayIndex: number, key: keyof Dishes) => {
    if (!plan) return;
    const fixed = removeFixed(cond.fixed, dayIndex, courseOf(key));
    setCond({ ...cond, fixed });
    keep(plan, shown, proposalGuests, fixed);
  };

  const propose = () => {
    if (overlapsExisting(src.mealSets, cond.startDate)) {
      setErrors(['この日付にはすでに献立があります。開始日を変えてください']);
      return;
    }
    const req: PlanRequest = { days: conditionDays, conditions: cond.conditions, fixed: cond.fixed };
    const result = makePlan(req, src.data, defaultRng);
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setErrors([]);
    keep(result.days, {}, guests);
  };

  const swap = (dayIndex: number, key: keyof Dishes) => {
    if (!request || !plan) return;
    const slotKey = `${dayIndex}-${key}`;
    const seen = [...(shown[slotKey] ?? []), plan[dayIndex][key]];
    let result = swapDish(request, src.data, plan, dayIndex, key, seen);
    let nextSeen = seen;
    if (!result.ok && seen.length > 1) {
      // 候補をひと回り見せたら、最初から見せ直す
      nextSeen = [plan[dayIndex][key]];
      result = swapDish(request, src.data, plan, dayIndex, key, nextSeen);
    }
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setErrors([]);
    keep(result.days, { ...shown, [slotKey]: nextSeen }, proposalGuests);
  };

  const confirm = async () => {
    if (!plan) return;
    // 下書きのあとでレシピが消された場合など、そろっていない日があれば確定しない
    if (summary.some((d) => d.dishes.length < 3)) {
      setErrors(['献立にないレシピがあります。「条件からやり直す」で作り直してください']);
      return;
    }
    setBusy(true);
    try {
      await confirmPlanToDb(db, {
        id: randomId(),
        startDate: cond.startDate,
        days: plan,
        conditions: cond.conditions,
        guests: proposalGuests,
        data: src.data,
        now: new Date(),
        newId: randomId,
      });
      onDone();
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
          isFixed={(dayIndex, key) => fixedRecipeId(cond.fixed, dayIndex, courseOf(key)) !== null}
          fixedNotes={(dayIndex, dish) =>
            fixedRecipeId(cond.fixed, dayIndex, dish.recipe.course) === dish.recipe.id
              ? warningsForSlot(dish.recipe, dayIndex, plan[dayIndex]?.memberIds ?? [], cond.fixed, cond.conditions, src.data)
                  // アレルギー・食後の嫌いは、どの料理にも summarizePlan の注意で出ている
                  .filter((w) => !needsConfirm([w]))
                  .map((w) => w.text)
              : []
          }
          onOpenDish={(dish, label) => setOpened({ dish, label })}
          onSwap={swap}
          onPick={(dayIndex, key) => setPicking({ dayIndex, key })}
          onUnfix={unfix}
          onRetry={propose}
          onBack={() => {
            setPlan(null);
            setErrors([]);
            void deleteDraft(db);
          }}
          onConfirm={confirm}
        />
      ) : (
        <ConditionForm
          value={cond}
          onChange={setCond}
          members={src.members}
          mealSets={src.mealSets}
          days={conditionDays}
          data={src.data}
          errors={errors}
          onSubmit={propose}
        />
      )}

      {picking && plan && (
        <RecipePickerSheet
          title={`${picking.dayIndex + 1}日目の${courseOf(picking.key)}を選ぶ`}
          course={courseOf(picking.key)}
          recipes={src.data.recipes}
          warningsFor={(r) =>
            warningsForSlot(r, picking.dayIndex, plan[picking.dayIndex]?.memberIds ?? [], cond.fixed, cond.conditions, src.data)
          }
          onPick={(r) => {
            pin(picking.dayIndex, picking.key, r.id);
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
