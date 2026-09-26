import { useState } from 'react';
import { HelpContent } from '../../components/HelpContent';
import { Sheet } from '../../components/Sheet';
import { FAQ, HELP_ORDER, SCREEN_HELP } from '../../data/help';

/** 使い方:全画面の説明と、よくある質問をまとめて見る */
export function UsageSection() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <h2 className="section-title">使い方</h2>
      <p className="muted">全画面の説明と、よくある質問をまとめて見られます。各画面の見出しの「?」でも、その画面の説明が出ます。</p>
      <button type="button" className="btn btn-block" onClick={() => setOpen(true)}>
        使い方を開く
      </button>
      {open && (
        <Sheet title="使い方" onClose={() => setOpen(false)}>
          <div className="form">
            {HELP_ORDER.map((screen) => (
              <section key={screen}>
                <h3 className="section-title" style={{ marginTop: 0 }}>
                  {SCREEN_HELP[screen].title}
                </h3>
                <HelpContent help={SCREEN_HELP[screen]} />
              </section>
            ))}
            <section>
              <h3 className="section-title" style={{ marginTop: 0 }}>
                よくある質問
              </h3>
              {FAQ.length === 0 ? (
                <div className="empty">まだありません</div>
              ) : (
                <dl className="faq">
                  {FAQ.map((f) => (
                    <div key={f.question}>
                      <dt>{f.question}</dt>
                      <dd>{f.answer}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>
        </Sheet>
      )}
    </>
  );
}
