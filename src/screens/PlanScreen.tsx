import { useState } from 'react';
import { usePlannerData } from '../hooks/usePlannerData';
import { toDateString } from '../logic/date';
import { MealSetView } from './plan/MealSetView';
import { PlanWizard } from './plan/PlanWizard';

/** 献立:予定中の献立セットと、新しい献立を作る流れ */
export function PlanScreen() {
  const today = toDateString(new Date());
  const src = usePlannerData(today);
  const [creating, setCreating] = useState(false);

  if (!src) return <p className="muted">読み込み中…</p>;
  const active = src.mealSets.filter((s) => s.status === '予定');

  if (creating) {
    return (
      <>
        <div className="screen-header">
          <h1 className="screen-title">献立を作る</h1>
          <button type="button" className="btn" onClick={() => setCreating(false)}>
            やめる
          </button>
        </div>
        <PlanWizard src={src} today={today} onDone={() => setCreating(false)} />
      </>
    );
  }

  return (
    <>
      <div className="screen-header">
        <h1 className="screen-title">献立</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          ＋ 献立を作る
        </button>
      </div>
      {active.length === 0 ? (
        <div className="empty">予定中の献立はありません。「＋ 献立を作る」から3日分を作ります。</div>
      ) : (
        active.map((set) => <MealSetView key={set.id} set={set} src={src} today={today} />)
      )}
    </>
  );
}
