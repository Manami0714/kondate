import type { Food } from '../../db/types';
import { ErrorList } from '../../components/Field';
import { formatApproxAmount } from '../../logic/format';
import { formatDayTotal } from '../../logic/portion';
import type { DaySummary, DishDetail } from '../../logic/planner/summary';
import { COURSE_SLOTS, type Dishes, type PlannedDay } from '../../logic/planner/types';
import { DayCard } from './DayCard';

interface Props {
  plan: readonly PlannedDay[];
  summary: readonly DaySummary[];
  foodsById: ReadonlyMap<string, Food>;
  shoppingLimit: number;
  errors: string[];
  busy: boolean;
  /** その枠に料理を指定しているか */
  isFixed: (dayIndex: number, key: keyof Dishes) => boolean;
  /** 指定した料理の、アレルギー・食後の嫌いのほかの注意(時間・主な材料のかぶり) */
  fixedNotes: (dayIndex: number, dish: DishDetail) => string[];
  onOpenDish: (dish: DishDetail, label: string) => void;
  onSwap: (dayIndex: number, key: keyof Dishes) => void;
  /** 料理を選んで、その枠に指定する */
  onPick: (dayIndex: number, key: keyof Dishes) => void;
  onUnfix: (dayIndex: number, key: keyof Dishes) => void;
  onRetry: () => void;
  onBack: () => void;
  onConfirm: () => void;
}

/** 3日分の提案:1品ずつ入れ替え・料理の指定ができる */
export function ProposalView({
  plan,
  summary,
  foodsById,
  shoppingLimit,
  errors,
  busy,
  isFixed,
  fixedNotes,
  onOpenDish,
  onSwap,
  onPick,
  onUnfix,
  onRetry,
  onBack,
  onConfirm,
}: Props) {
  const shoppingText = (day: DaySummary) =>
    [...day.shopping]
      .map(([foodId, amount]) => {
        const food = foodsById.get(foodId);
        return food ? `${food.name} ${formatApproxAmount(amount, food.unit)}` : foodId;
      })
      .join('、');
  const keyOf = (dish: DishDetail) => COURSE_SLOTS.find((s) => s.course === dish.recipe.course)?.key;

  return (
    <div className="form" style={{ gap: 12 }}>
      {summary.map((day, dayIndex) => (
        <DayCard
          key={day.date}
          day={day}
          headExtra={<span className="muted">買い足し {day.shopping.size}品</span>}
          onOpenDish={(dish) => onOpenDish(dish, formatDayTotal(day.members))}
          isFixed={(dish) => {
            const key = keyOf(dish);
            return key !== undefined && isFixed(dayIndex, key);
          }}
          dishNotes={(dish) => fixedNotes(dayIndex, dish)}
          dishAction={(dish) => {
            const key = keyOf(dish);
            if (!key) return null;
            if (isFixed(dayIndex, key)) {
              return (
                <button type="button" className="btn btn-small" onClick={() => onUnfix(dayIndex, key)}>
                  指定を外す
                </button>
              );
            }
            return (
              <>
                <button type="button" className="btn btn-small" onClick={() => onSwap(dayIndex, key)}>
                  入れ替え
                </button>
                <button type="button" className="btn btn-small" onClick={() => onPick(dayIndex, key)}>
                  選ぶ
                </button>
              </>
            );
          }}
        >
          {plan[dayIndex]?.overLimit && (
            <div className="note note-warn">
              在庫が少なくて、買い足しが上限({shoppingLimit}品)を超えています
            </div>
          )}
          {day.shopping.size > 0 && <div className="field-hint">買い足し:{shoppingText(day)}</div>}
        </DayCard>
      ))}

      <ErrorList errors={errors} />
      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={onConfirm}>
        この献立で確定(在庫から減らす)
      </button>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onBack}>
          条件からやり直す
        </button>
        <button type="button" className="btn" onClick={onRetry}>
          別の提案を見る
        </button>
      </div>
    </div>
  );
}
