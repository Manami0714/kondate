import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { deleteRebuildDraft, loadDraft, loadRebuildDraft, saveRebuildDraft } from '../db/draftRepo';
import type { MealSet } from '../db/types';
import { usePlannerData } from '../hooks/usePlannerData';
import { formatDayLabel, formatShortDate, toDateString, toDateTimeString } from '../logic/date';
import { isVisibleMealSet } from '../logic/planner/days';
import { FeedbackSheet } from './feedback/FeedbackSheet';
import { MealSetView } from './plan/MealSetView';
import { PlanWizard } from './plan/PlanWizard';
import { RebuildWizard } from './plan/RebuildWizard';
import { HelpButton } from '../components/HelpButton';

/** 献立:予定中の献立セットと、新しい献立を作る流れ・キャンセルした日の作り直し */
export function PlanScreen() {
  const today = toDateString(new Date());
  const src = usePlannerData(today);
  /** 確定前の提案(下書き)。読み込み中は undefined、なければ null */
  const draft = useLiveQuery(() => loadDraft(db), []);
  /** 作り直しの途中(作り直し用の下書き)。あれば、献立タブを開いたときにその画面に戻る */
  const rebuildDraft = useLiveQuery(() => loadRebuildDraft(db), []);
  const [creating, setCreating] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // 下書きがあれば、タブを開いたときに1回だけ自動で提案の画面を出す
  const autoOpened = useRef(false);
  useEffect(() => {
    if (draft && !autoOpened.current) {
      autoOpened.current = true;
      setCreating(true);
    }
  }, [draft]);

  if (!src || draft === undefined || rebuildDraft === undefined) return <p className="muted">読み込み中…</p>;
  const active = src.mealSets.filter((s) => isVisibleMealSet(s, today));

  /** 作り直しを始める:下書きを作ると、その画面に切り替わる(条件の初期値はセットを作ったときの条件) */
  const startRebuild = (set: MealSet, dayIndex: number) =>
    void saveRebuildDraft(db, {
      savedAt: toDateTimeString(new Date()),
      mealSetId: set.id,
      dayIndex,
      conditions: set.conditions,
      fixed: [],
      day: null,
      shown: {},
    });

  if (rebuildDraft) {
    const rebuildSet = src.mealSets.find((s) => s.id === rebuildDraft.mealSetId);
    const rebuildDate = rebuildSet?.days[rebuildDraft.dayIndex]?.date;
    return (
      <>
        <div className="screen-header">
          <div className="screen-title-row">
            <h1 className="screen-title">{rebuildDate ? `${formatDayLabel(rebuildDate)}の献立を作り直す` : '献立を作り直す'}</h1>
            <HelpButton screen="plan" />
          </div>
          <button type="button" className="btn" onClick={() => void deleteRebuildDraft(db)}>
            やめる
          </button>
        </div>
        <RebuildWizard key={`${rebuildDraft.mealSetId}-${rebuildDraft.dayIndex}`} src={src} today={today} draft={rebuildDraft} />
      </>
    );
  }

  if (creating) {
    return (
      <>
        <div className="screen-header">
          <div className="screen-title-row">
            <h1 className="screen-title">献立を作る</h1>
            <HelpButton screen="plan" />
          </div>
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
        <div className="screen-title-row">
          <h1 className="screen-title">献立</h1>
          <HelpButton screen="plan" />
        </div>
        <div className="header-actions">
          <button type="button" className="btn" onClick={() => setFeedbackOpen(true)}>
            感想を入力
          </button>
          {!draft && (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              ＋ 献立を作る
            </button>
          )}
        </div>
      </div>
      {feedbackOpen && <FeedbackSheet onClose={() => setFeedbackOpen(false)} />}
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
        active.map((set) => <MealSetView key={set.id} set={set} src={src} today={today} onRebuild={startRebuild} />)
      )}
    </>
  );
}
