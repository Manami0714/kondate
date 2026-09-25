import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { loadDraft } from '../db/draftRepo';
import { usePlannerData } from '../hooks/usePlannerData';
import { formatShortDate, toDateString } from '../logic/date';
import { MealSetView } from './plan/MealSetView';
import { PlanWizard } from './plan/PlanWizard';

/** 献立:予定中の献立セットと、新しい献立を作る流れ */
export function PlanScreen() {
  const today = toDateString(new Date());
  const src = usePlannerData(today);
  /** 確定前の提案(下書き)。読み込み中は undefined、なければ null */
  const draft = useLiveQuery(() => loadDraft(db), []);
  const [creating, setCreating] = useState(false);
  // 下書きがあれば、タブを開いたときに1回だけ自動で提案の画面を出す
  const autoOpened = useRef(false);
  useEffect(() => {
    if (draft && !autoOpened.current) {
      autoOpened.current = true;
      setCreating(true);
    }
  }, [draft]);

  if (!src || draft === undefined) return <p className="muted">読み込み中…</p>;
  const active = src.mealSets.filter((s) => s.status === '予定');

  if (creating) {
    return (
      <>
        <div className="screen-header">
          <h1 className="screen-title">献立を作る</h1>
          <button type="button" className="btn" onClick={() => setCreating(false)}>
            {draft ? '閉じる(下書きは残る)' : 'やめる'}
          </button>
        </div>
        <PlanWizard src={src} today={today} draft={draft} onDone={() => setCreating(false)} />
      </>
    );
  }

  return (
    <>
      <div className="screen-header">
        <h1 className="screen-title">献立</h1>
        {!draft && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            ＋ 献立を作る
          </button>
        )}
      </div>
      {draft && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ marginTop: 0 }}>{formatShortDate(draft.startDate)}からの、作りかけの献立の提案があります。</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setCreating(true)}>
            提案の続きを見る
          </button>
        </div>
      )}
      {active.length === 0 ? (
        !draft && <div className="empty">予定中の献立はありません。「＋ 献立を作る」から3日分を作ります。</div>
      ) : (
        active.map((set) => <MealSetView key={set.id} set={set} src={src} today={today} />)
      )}
    </>
  );
}
