import { useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { TIME_PRESETS } from '../../config/scoring';
import { db } from '../../db/db';
import { confirmPlanToDb } from '../../db/mealSetRepo';
import type { DateString } from '../../db/types';
import type { PlannerSource } from '../../hooks/usePlannerData';
import { randomId } from '../../logic/id';
import { buildDays, carryOverGuests, defaultStartDate, overlapsExisting } from '../../logic/planner/days';
import { makePlan } from '../../logic/planner/plan';
import { summarizePlan, type DishDetail } from '../../logic/planner/summary';
import { swapDish } from '../../logic/planner/swap';
import type { Dishes, PlannedDay, PlanRequest } from '../../logic/planner/types';
import { formatPortion } from '../../logic/portion';
import { defaultRng } from '../../logic/random';
import { RecipeDetail } from '../RecipeDetail';
import { ConditionForm, type ConditionState } from './ConditionForm';
import { ProposalView } from './ProposalView';

interface Props {
  src: PlannerSource;
  today: DateString;
  onDone: () => void;
}

/** 献立を作る流れ:条件を選ぶ → 3日分の提案(入れ替え・やり直し)→ 確定 */
export function PlanWizard({ src, today, onDone }: Props) {
  const [cond, setCond] = useState<ConditionState>(() => ({
    startDate: defaultStartDate(src.mealSets, today),
    conditions: { preset: 'ふつう', ...TIME_PRESETS['ふつう'], forMemberId: null },
    addedGuests: [],
  }));
  const [request, setRequest] = useState<PlanRequest | null>(null);
  const [plan, setPlan] = useState<PlannedDay[] | null>(null);
  /** 枠ごとに、すでに見せた品(入れ替えで同じ品に戻らないようにする) */
  const [shown, setShown] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<{ dish: DishDetail; total: number } | null>(null);

  const guests = [...carryOverGuests(src.mealSets, cond.startDate), ...cond.addedGuests];
  const summary = useMemo(() => (plan ? summarizePlan(plan, src.data).days : []), [plan, src.data]);

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
    setRequest(req);
    setPlan(result.days);
    setShown({});
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
    setPlan(result.days);
    setShown({ ...shown, [slotKey]: nextSeen });
  };

  const confirm = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await confirmPlanToDb(db, {
        id: randomId(),
        startDate: cond.startDate,
        days: plan,
        conditions: cond.conditions,
        guests,
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
          onOpenDish={(dish, total) => setOpened({ dish, total })}
          onSwap={swap}
          onRetry={propose}
          onBack={() => {
            setPlan(null);
            setErrors([]);
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
            scaled={{ ingredients: opened.dish.ingredients, label: `合計${formatPortion(opened.total)}分` }}
          />
        </Sheet>
      )}
    </>
  );
}
