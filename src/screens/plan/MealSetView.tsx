import { useMemo, useState } from 'react';
import { ErrorList } from '../../components/Field';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { cancelDayInDb, cancelSetInDb, markCookedInDb } from '../../db/mealSetRepo';
import type { DateString, MealSet } from '../../db/types';
import type { PlannerSource } from '../../hooks/usePlannerData';
import { formatDayLabel, formatShortDate } from '../../logic/date';
import type { MealSetResult } from '../../logic/mealSet';
import { summarizePlan, type DishDetail } from '../../logic/planner/summary';
import { formatPortion } from '../../logic/portion';
import { RecipeDetail } from '../RecipeDetail';
import { DayCard } from './DayCard';
import { ShoppingList } from './ShoppingList';

interface Props {
  set: MealSet;
  src: PlannerSource;
  today: DateString;
}

/** 確定した献立セット:作った・キャンセル・買い足し */
export function MealSetView({ set, src, today }: Props) {
  const [errors, setErrors] = useState<string[]>([]);
  const [opened, setOpened] = useState<{ dish: DishDetail; total: number } | null>(null);
  // 量・栄養・注意書きだけを見るので、在庫は使わない
  const summary = useMemo(() => summarizePlan(set.days, { ...src.data, stocks: [] }).days, [set.days, src.data]);
  const lastDate = set.days[set.days.length - 1]?.date ?? set.startDate;

  const run = async (action: () => Promise<MealSetResult>) => {
    const result = await action();
    setErrors(result.ok ? [] : [result.error]);
  };

  const cancelOne = (dayIndex: number) => {
    if (!window.confirm(`${formatDayLabel(set.days[dayIndex].date)}の献立をキャンセルして、食材を在庫に戻しますか?`)) return;
    void run(() => cancelDayInDb(db, set.id, dayIndex, new Date()));
  };

  const cancelAll = () => {
    if (!window.confirm('この献立をすべてキャンセルして、食材を在庫に戻しますか?(「作った」の日はそのまま)')) return;
    void run(() => cancelSetInDb(db, set.id, new Date()));
  };

  return (
    <section style={{ marginBottom: 24 }}>
      <h2 className="section-title">
        {formatShortDate(set.startDate)}〜{formatShortDate(lastDate)}の献立
      </h2>
      {summary.map((day, dayIndex) => {
        const status = set.days[dayIndex].status;
        return (
          <DayCard key={day.date} day={day} status={status} onOpenDish={(dish) => setOpened({ dish, total: day.total })}>
            {status === '予定' && (
              <>
                {day.date < today && <div className="field-hint">過ぎた日です。「作った」かキャンセルを選んでください</div>}
                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => cancelOne(dayIndex)}>
                    キャンセル
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => void run(() => markCookedInDb(db, set.id, dayIndex))}>
                    作った
                  </button>
                </div>
              </>
            )}
          </DayCard>
        );
      })}
      <ErrorList errors={errors} />

      <ShoppingList set={set} foodsById={src.foodsById} />

      <button type="button" className="btn btn-danger btn-block" style={{ marginTop: 16 }} onClick={cancelAll}>
        この献立をすべてキャンセル
      </button>

      {opened && (
        <Sheet title={opened.dish.recipe.name} onClose={() => setOpened(null)}>
          <RecipeDetail
            recipe={opened.dish.recipe}
            byId={src.foodsById}
            scaled={{ ingredients: opened.dish.ingredients, label: `合計${formatPortion(opened.total)}分` }}
          />
        </Sheet>
      )}
    </section>
  );
}
