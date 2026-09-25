import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

/** 読まない言葉:貼り付けの確認画面で「食材ではない」を選んだ品。消すと次からまた確認画面に出る */
export function IgnoredWordsSection() {
  const words = useLiveQuery(() => db.ignoredWords.toArray(), []);
  if (!words) return null;
  const sorted = [...words].sort((a, b) => a.label.localeCompare(b.label, 'ja'));

  return (
    <>
      <h2 className="section-title">読まない言葉({words.length}件)</h2>
      <p className="muted">
        レシート・ネットスーパーの貼り付けで「食材ではない」を選んだ品です。次からは最初から「食材ではない」に入ります。消すと、また確認画面に出ます。
      </p>
      {sorted.length === 0 ? (
        <div className="empty">まだありません</div>
      ) : (
        <ul className="list">
          {sorted.map((w) => (
            <li key={w.word} className="list-item">
              <span className="list-main">{w.label}</span>
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={async () => {
                  if (!window.confirm(`「${w.label}」を読まない言葉から消しますか?`)) return;
                  await db.ignoredWords.delete(w.word);
                }}
              >
                消す
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
