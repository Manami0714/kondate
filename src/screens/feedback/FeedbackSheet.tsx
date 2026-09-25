import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { SingleChoice } from '../../components/Choice';
import { ErrorList, Field } from '../../components/Field';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { saveFeedbacksInDb } from '../../db/feedbackRepo';
import type { FeedbackKind } from '../../db/types';
import { useFoods } from '../../hooks/useFoods';
import { parseFeedback, type FeedbackCandidate } from '../../logic/feedback/parseFeedback';
import { TARGET_TYPE_LABELS, targetLabel } from '../../logic/feedback/target';

interface Props {
  /** 入力欄に最初から入れておく文(料理の詳細から開いたときの料理名など) */
  initialText?: string;
  onClose: () => void;
}

const NOT_SAVE = '登録しない';
type Choice = FeedbackKind | typeof NOT_SAVE;
const CHOICES: readonly Choice[] = ['好き', '提案時の嫌い', '食後の嫌い', NOT_SAVE];

/** 口頭フィードバック:入力 → 確認(項目ごとに評価と種類を直せる)→ 保存 */
export function FeedbackSheet({ initialText = '', onClose }: Props) {
  const foodData = useFoods();
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const recipesById = useMemo(() => new Map((recipes ?? []).map((r) => [r.id, r])), [recipes]);
  const [text, setText] = useState(initialText);
  const [candidates, setCandidates] = useState<FeedbackCandidate[] | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  if (!foodData || !recipes) {
    return (
      <Sheet title="感想を入力" onClose={onClose}>
        <p className="muted">読み込み中…</p>
      </Sheet>
    );
  }

  const read = () => {
    const found = parseFeedback(text, foodData.foods, recipes);
    setCandidates(found);
    setChoices(found.map((c) => c.kind ?? NOT_SAVE));
    setErrors([]);
  };

  const save = async () => {
    if (!candidates) return;
    const entries = candidates.flatMap((c, i) => {
      const kind = choices[i];
      return kind === NOT_SAVE ? [] : [{ ...c.target, kind }];
    });
    if (entries.length === 0) {
      setErrors(['登録する項目がありません。「好き」「提案時の嫌い」「食後の嫌い」のどれかを選んでください']);
      return;
    }
    await saveFeedbacksInDb(db, entries, text, new Date());
    onClose();
  };

  if (candidates === null) {
    return (
      <Sheet title="感想を入力" onClose={onClose}>
        <div className="form">
          <Field label="感想" hint="キーボードのマイクで話して入れられます。例:ほうれん草は好きなんだけど、胡麻和えが微妙だった">
            <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </Field>
          <button type="button" className="btn btn-primary btn-block" disabled={text.trim() === ''} onClick={read}>
            読み取る
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="感想の確認" onClose={onClose}>
      <div className="form">
        <p className="muted" style={{ margin: 0 }}>
          「{text.trim()}」
        </p>
        {candidates.length === 0 ? (
          <div className="empty">
            評価する料理・食材が見つかりませんでした。料理名・食材名や、「胡麻和え」「揚げ物」のような言い方を入れてください。
          </div>
        ) : (
          candidates.map((c, i) => (
            <div key={`${c.target.targetType}-${c.target.targetValue}`} className="card" style={{ display: 'grid', gap: 8 }}>
              <div>
                <span className="list-title">{targetLabel(c.target, foodData.byId, recipesById)}</span>
                <span className="tag" style={{ marginLeft: 8 }}>
                  {TARGET_TYPE_LABELS[c.target.targetType]}
                </span>
              </div>
              {c.target.targetType === '料理法×味付け' && (
                <div className="field-hint">この組み合わせの料理だけに効きます(ほかの料理は変わりません)</div>
              )}
              <SingleChoice<Choice>
                options={CHOICES}
                value={choices[i]}
                onChange={(v) => setChoices((prev) => prev.map((p, j) => (j === i ? v : p)))}
              />
              {choices[i] === '食後の嫌い' && (
                <div className="note note-warn">「食後の嫌い」にすると、当てはまる料理は二度と提案されません</div>
              )}
              {c.sentiment === null && choices[i] === NOT_SAVE && <div className="field-hint">評価の言葉が見つからなかったので、選んでください</div>}
            </div>
          ))
        )}
        <ErrorList errors={errors} />
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setCandidates(null)}>
            入力に戻る
          </button>
          <button type="button" className="btn btn-primary" disabled={candidates.length === 0} onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </Sheet>
  );
}
