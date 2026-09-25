import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../../db/db';
import { deleteFeedbackInDb } from '../../db/feedbackRepo';
import type { Feedback, Food } from '../../db/types';
import { formatShortDate, toDateString } from '../../logic/date';
import { sortFeedbacksNewestFirst, TARGET_TYPE_LABELS, targetLabel } from '../../logic/feedback/target';

/** 評価の一覧:口頭フィードバックで登録した評価を見て、間違えたものを消す */
export function FeedbackSection({ byId }: { byId: ReadonlyMap<string, Food> }) {
  const feedbacks = useLiveQuery(() => db.feedbacks.toArray(), []);
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const recipesById = useMemo(() => new Map((recipes ?? []).map((r) => [r.id, r])), [recipes]);
  if (!feedbacks || !recipes) return null;
  const sorted = sortFeedbacksNewestFirst(feedbacks);

  const remove = async (f: Feedback) => {
    const label = targetLabel(f, byId, recipesById);
    if (!window.confirm(`「${label}:${f.kind}」の評価を消しますか?`)) return;
    await deleteFeedbackInDb(db, f.id);
  };

  return (
    <>
      <h2 className="section-title">評価の一覧({feedbacks.length}件)</h2>
      <p className="muted">献立タブの「感想を入力」で登録した評価です。「食後の嫌い」の料理は提案されません。間違えたものは消せます。</p>
      {sorted.length === 0 ? (
        <div className="empty">まだ評価はありません</div>
      ) : (
        <ul className="list">
          {sorted.map((f) => (
            <li key={f.id} className="list-item">
              <span className="list-main">
                <span className="list-title">
                  {targetLabel(f, byId, recipesById)}
                  <span className="tag" style={{ marginLeft: 6 }}>
                    {TARGET_TYPE_LABELS[f.targetType]}
                  </span>
                </span>
                <div className="list-sub">
                  {f.kind}・{formatShortDate(toDateString(new Date(f.at)))}
                  {f.originalText && `・「${f.originalText}」`}
                </div>
              </span>
              <button type="button" className="btn btn-small btn-danger" onClick={() => void remove(f)}>
                消す
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
