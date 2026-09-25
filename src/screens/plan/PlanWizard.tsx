import { useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { TIME_PRESETS } from '../../config/scoring';
import { db } from '../../db/db';
import { deleteDraft, saveDraft } from '../../db/draftRepo';
import { confirmPlanToDb } from '../../db/mealSetRepo';
import type { DateString, GuestStay, PlanDraft } from '../../db/types';
import type { PlannerSource } from '../../hooks/usePlannerData';
import { toDateTimeString } from '../../logic/date';
import { randomId } from '../../logic/id';
import { buildDays, carryOverGuests, defaultStartDate, overlapsExisting } from '../../logic/planner/days';
import { makePlan } from '../../logic/planner/plan';
import { summarizePlan, type DishDetail } from '../../logic/planner/summary';
import { swapDish } from '../../logic/planner/swap';
import type { Dishes, PlannedDay, PlanRequest } from '../../logic/planner/types';
import { defaultRng } from '../../logic/random';
import { RecipeDetail } from '../RecipeDetail';
import { ConditionForm, type ConditionState } from './ConditionForm';
import { ProposalView } from './ProposalView';

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
      ? { startDate: draft.startDate, conditions: draft.conditions, addedGuests: draft.addedGuests }
      : {
          startDate: defaultStartDate(src.mealSets, today),
          conditions: { preset: 'ふつう', ...TIME_PRESETS['ふつう'], forMemberId: null },
          addedGuests: [],
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

  const guests = [...carryOverGuests(src.mealSets, cond.startDate), ...cond.addedGuests];
  const summary = useMemo(() => (plan ? summarizePlan(plan, src.data).days : []), [plan, src.data]);
  // 提案のときの日付・メンバーと条件(入れ替えに使う)
  const request = useMemo<PlanRequest | null>(
    () => (plan ? { days: plan.map((d) => ({ date: d.date, memberIds: d.memberIds })), conditions: cond.conditions } : null),
    [plan, cond.conditions],
  );

  /** 提案を下書きとして保存する(タブの切り替えやアプリを閉じても消えないように) */
  const keep = (days: PlannedDay[], nextShown: Record<string, string[]>, stays: GuestStay[]) => {
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
    });
  };

  const propose = () => {
    if (overlapsExisting(src.mealSets, cond.startDate)) {
      setErrors(['この日付にはすでに献立があります。開始日を変えてください']);
      return;
    }
    const req: PlanRequest = { days: buildDays(cond.startDate, src.members, guests), conditions: cond.conditions };
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
          onOpenDish={(dish, label) => setOpened({ dish, label })}
          onSwap={swap}
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
          errors={errors}
          onSubmit={propose}
        />
      )}

      {opened && (
        <Sheet title={opened.dish.recipe.name} onClose={() => setOpened(null)}>
          <RecipeDetail
            recipe={opened.dish.recipe}
            byId={src.foodsById}
            scaled={{ ingredients: opened.dish.ingredients, label: opened.label }}
          />
        </Sheet>
      )}
    </>
  );
}
