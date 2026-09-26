import { useMemo, useState } from 'react';
import { ErrorList } from '../../components/Field';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { cancelDayInDb, cancelSetInDb, markCookedInDb, unmarkCookedInDb } from '../../db/mealSetRepo';
import type { DateString, MealSet } from '../../db/types';
import type { PlannerSource } from '../../hooks/usePlannerData';
import { formatDayLabel, formatShortDate } from '../../logic/date';
import type { MealSetResult } from '../../logic/mealSet';
import { canRebuildDay } from '../../logic/planner/rebuild';
import { summarizePlan, type DishDetail } from '../../logic/planner/summary';
import { formatDayTotal } from '../../logic/portion';
import { RecipeDetail } from '../RecipeDetail';
import { DayCard } from './DayCard';
import { ShoppingList } from './ShoppingList';

interface Props {
  set: MealSet;
  src: PlannerSource;
  today: DateString;
  /** 「この日の献立を作り直す」を押したとき */
  onRebuild: (set: MealSet, dayIndex: number) => void;
}

/** 確定した献立セット:作った(と取り消し)・キャンセル・作り直し・買い足し */
export function MealSetView({ set, src, today, onRebuild }: Props) {
  const [errors, setErrors] = useState<string[]>([]);
  const [opened, setOpened] = useState<{ dish: DishDetail; label: string } | null>(null);
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
    // 「作った」の日はキャンセルされずに残るので、確認のときに知らせる
    const cooked = set.days.filter((d) => d.status === '作った').map((d) => formatShortDate(d.date));
    const keepNote = cooked.length > 0 ? `\n${cooked.join('・')}は作った日なので残ります。` : '';
    if (!window.confirm(`この献立をすべてキャンセルして、食材を在庫に戻しますか?${keepNote}`)) return;
    void run(() => cancelSetInDb(db, set.id, new Date()));
  };

  const undoCooked = (dayIndex: number) => {
    if (!window.confirm(`${formatDayLabel(set.days[dayIndex].date)}の「作った」を取り消して、「予定」に戻しますか?在庫は変わりません。`)) return;
    void run(() => unmarkCookedInDb(db, set.id, dayIndex));
  };

  return (
    <section style={{ marginBottom: 24 }}>
      <h2 className="section-title">
        {formatShortDate(set.startDate)}〜{formatShortDate(lastDate)}の献立
      </h2>
      {summary.map((day, dayIndex) => {
        const status = set.days[dayIndex].status;
        return (
          <DayCard key={day.date} day={day} status={status} onOpenDish={(dish) => setOpened({ dish, label: formatDayTotal(day.members) })}>
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
            {status === '作った' && (
              <button type="button" className="btn btn-small" onClick={() => undoCooked(dayIndex)}>
                作ったを取り消す
              </button>
            )}
            {canRebuildDay(set, dayIndex, src.mealSets, today) && (
              <button type="button" className="btn btn-block" onClick={() => onRebuild(set, dayIndex)}>
                この日の献立を作り直す
              </button>
            )}
          </DayCard>
        );
      })}
      <ErrorList errors={errors} />

      <ShoppingList set={set} foodsById={src.foodsById} />

      {/* 「予定」の日が残っていなければ(作った日だけで出ているとき)、キャンセルするものはない */}
      {set.days.some((d) => d.status === '予定') && (
        <button type="button" className="btn btn-danger btn-block" style={{ marginTop: 16 }} onClick={cancelAll}>
          この献立をすべてキャンセル
        </button>
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
    </section>
  );
}
