import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';

/**
 * 読まない言葉:貼り付けの確認画面で「食材ではない」を選んだ品。消すと次からまた確認画面に出る。
 * 増え続けるので、設定画面にはボタンだけを置き、押したときだけ一覧を開く
 */
export function IgnoredWordsSection() {
  const [open, setOpen] = useState(false);
  const words = useLiveQuery(() => db.ignoredWords.toArray(), []);
  if (!words) return null;
  const sorted = [...words].sort((a, b) => a.label.localeCompare(b.label, 'ja'));

  return (
    <>
      <h2 className="section-title">読まない言葉</h2>
      <p className="muted">
        レシート・ネットスーパーの貼り付けで「食材ではない」を選んだ品です。次からは最初から「食材ではない」に入ります。消すと、また確認画面に出ます。
      </p>
      <button type="button" className="btn btn-block" onClick={() => setOpen(true)}>
        読まない言葉を開く({words.length}件)
      </button>
      {open && (
        <Sheet title={`読まない言葉(${words.length}件)`} onClose={() => setOpen(false)}>
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
        </Sheet>
      )}
    </>
  );
}
