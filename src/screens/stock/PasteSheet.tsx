import { useState } from 'react';
import { ErrorList, Field } from '../../components/Field';
import { FoodPicker } from '../../components/FoodPicker';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { addPurchasesInDb } from '../../db/stockRepo';
import type { Food, IgnoredWord } from '../../db/types';
import { withoutAlias } from '../../logic/aliases';
import { amountToInput } from '../../logic/format';
import { parsePaste, purchaseAmount, type PasteItem, type PasteStatus } from '../../logic/receipt/parsePaste';
import { planPasteSave, type PasteRowState } from '../../logic/receipt/pasteSave';
import { AMOUNT_NOTE_LABELS, type AmountNote } from '../../logic/textInput/amount';

interface Props {
  foods: readonly Food[];
  byId: ReadonlyMap<string, Food>;
  ignoredWords: readonly IgnoredWord[];
  onClose: () => void;
}

/** 確認画面の1行 */
interface Row extends PasteRowState {
  key: number;
  note: AmountNote | null;
}

function toRow(item: PasteItem, key: number): Row {
  return {
    key,
    item,
    foodId: item.foodId,
    amountText: item.foodId ? amountToInput(item.amount) : '',
    // 自信のない食材は、確かめてから入れるように、はじめはチェックを外しておく
    include: item.status === '読み取った',
    note: item.note,
    corrected: false,
    notFood: item.status === '食材ではない',
  };
}

const SECTIONS: { status: PasteStatus; title: string; hint: string }[] = [
  { status: '読み取った', title: '読み取った食材', hint: '量を確かめてください。違う食材なら「変える」、食材でなければ「食材ではない」で直せます' },
  { status: '自信がない', title: '自信のない食材', hint: '食材を選ぶとチェックが入ります。選んだ内容は次から自動で読めます' },
  { status: '読めなかった', title: '読めなかった行', hint: '食材を選ぶと、その商品名を別名として覚えます。食材でなければ「食材ではない」を押すと、次から読みません' },
];

/** レシート・ネットスーパーの貼り付け:入力 → 確認 → 在庫に追加 */
export function PasteSheet({ foods, byId, ignoredWords, onClose }: Props) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [source, setSource] = useState('');
  const [picking, setPicking] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const read = () => {
    const result = parsePaste(text, foods, ignoredWords);
    setSource(result.source);
    setRows(result.items.map(toRow));
    setErrors([]);
  };

  const update = (key: number, patch: Partial<Row>) => setRows((prev) => prev && prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  /** 食材を当てはめる。量は商品名の量×点数で計算し直す */
  const choose = (row: Row, food: Food) => {
    const { amount, note } = purchaseAmount(row.item, food);
    update(row.key, {
      foodId: food.id,
      amountText: amountToInput(amount),
      note,
      include: true,
      notFood: false,
      corrected: food.id !== row.item.foodId || row.item.status !== '読み取った',
    });
  };

  const save = async () => {
    if (!rows) return;
    const now = new Date();
    const plan = planPasteSave(rows, foods, ignoredWords, now);
    if (!plan.ok) {
      setErrors(plan.errors);
      return;
    }
    await addPurchasesInDb(db, plan.items, plan.updatedFoods, plan.ignoredWords, now);
    onClose();
  };

  if (rows === null) {
    return (
      <Sheet title="貼り付けで追加" onClose={onClose}>
        <div className="form">
          <Field
            label="レシート・ネットスーパーの文字"
            hint="スクショを開いて「テキスト認識表示」で文字を選び、コピーして貼り付けます"
          >
            <textarea className="textarea" style={{ minHeight: 200 }} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </Field>
          <button type="button" className="btn btn-primary btn-block" disabled={text.trim() === ''} onClick={read}>
            読み取る
          </button>
        </div>
      </Sheet>
    );
  }

  const pickingRow = picking === null ? undefined : rows.find((r) => r.key === picking);
  if (pickingRow) {
    return (
      <Sheet title={`「${pickingRow.item.word}」の食材を選ぶ`} onClose={() => setPicking(null)}>
        <FoodPicker
          foods={foods}
          allowAddNew
          onPick={(food) => {
            choose(pickingRow, food);
            setPicking(null);
          }}
        />
      </Sheet>
    );
  }

  const willAdd = rows.filter((r) => r.include && !r.notFood && r.foodId !== null).length;
  const ignoredRows = rows.filter((r) => r.item.status === '食材ではない');

  return (
    <Sheet title="読み取った内容の確認" onClose={onClose}>
      <div className="form">
        <p className="muted" style={{ margin: 0 }}>
          {source}として読みました(商品 {rows.length}件)
        </p>
        {SECTIONS.map((section) => {
          const list = rows.filter((r) => r.item.status === section.status);
          if (list.length === 0) return null;
          return (
            <section key={section.status} className="form">
              <h3 className="section-title" style={{ margin: 0 }}>
                {section.title}({list.length}件)
              </h3>
              <p className="field-hint" style={{ margin: 0 }}>
                {section.hint}
              </p>
              <ul className="list">
                {list.map((row) => (
                  <PasteRow
                    key={row.key}
                    row={row}
                    byId={byId}
                    onUpdate={(patch) => update(row.key, patch)}
                    onChoose={(food) => choose(row, food)}
                    onPick={() => setPicking(row.key)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {ignoredRows.length > 0 && (
          <details>
            <summary className="muted">食材ではない({ignoredRows.length}件)</summary>
            <ul className="list" style={{ marginTop: 8 }}>
              {ignoredRows.map((row) => (
                <PasteRow
                  key={row.key}
                  row={row}
                  byId={byId}
                  onUpdate={(patch) => update(row.key, patch)}
                  onChoose={(food) => choose(row, food)}
                  onPick={() => setPicking(row.key)}
                />
              ))}
            </ul>
          </details>
        )}
        <ErrorList errors={errors} />
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setRows(null)}>
            入力に戻る
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()}>
            在庫に追加({willAdd}件)
          </button>
        </div>
      </div>
    </Sheet>
  );
}

interface RowProps {
  row: Row;
  byId: ReadonlyMap<string, Food>;
  onUpdate: (patch: Partial<Row>) => void;
  onChoose: (food: Food) => void;
  onPick: () => void;
}

/** 確認画面の1商品 */
function PasteRow({ row, byId, onUpdate, onChoose, onPick }: RowProps) {
  // 「食材ではない」にすると別名から外れる食材(商品名とまったく同じ別名を持つもの)
  const aliasOwner = row.notFood ? [...byId.values()].find((f) => withoutAlias(f, row.item.word) !== null) : undefined;
  const food = row.foodId ? byId.get(row.foodId) : undefined;
  const candidates = row.item.candidateIds.map((id) => byId.get(id)).filter((f): f is Food => f !== undefined);
  return (
    <li className="check-row" style={{ alignItems: 'flex-start' }}>
      {food && !row.notFood && (
        <input
          type="checkbox"
          checked={row.include}
          aria-label={`${food.name}を在庫に追加する`}
          onChange={(e) => onUpdate({ include: e.target.checked })}
        />
      )}
      <div style={{ flex: 1, display: 'grid', gap: 6, minWidth: 0 }}>
        <div className="list-sub">
          {row.item.name}
          {row.item.count > 1 && `(${row.item.count}点)`}
        </div>
        {row.notFood ? (
          <div className="muted">
            食材ではない{row.item.status !== '食材ではない' && '(次から読みません)'}
            {aliasOwner && row.item.status !== '食材ではない' && (
              <div className="field-hint">
                「{row.item.word}」を{aliasOwner.name}の別名からも外します
              </div>
            )}
          </div>
        ) : food ? (
          <>
            <div className="list-title">
              {food.name}
              {row.corrected && <span className="muted">(この商品名を別名として覚えます)</span>}
            </div>
            <div className="input-with-unit">
              <input
                className="input"
                value={row.amountText}
                aria-label={`${food.name}の量`}
                onChange={(e) => onUpdate({ amountText: e.target.value, note: null })}
              />
              <span>{food.unit}</span>
            </div>
            {row.note && <div className="note note-warn">{AMOUNT_NOTE_LABELS[row.note]}</div>}
          </>
        ) : null}
        {row.item.status === '自信がない' && !row.notFood && candidates.length > 1 && (
          <div className="segmented">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip${row.foodId === c.id && row.include ? ' is-on' : ''}`}
                onClick={() => onChoose(c)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="btn-row">
          <button type="button" className="btn btn-small" onClick={onPick}>
            {food && !row.notFood ? '変える' : '食材を選ぶ'}
          </button>
          {row.item.status === '自信がない' && !row.notFood && candidates.length === 1 && !row.include && (
            <button type="button" className="btn btn-small" onClick={() => onChoose(candidates[0])}>
              {candidates[0].name}でよい
            </button>
          )}
          {row.item.status !== '食材ではない' && (
            <button type="button" className="btn btn-small" onClick={() => onUpdate({ notFood: !row.notFood, include: row.notFood && row.foodId !== null })}>
              {row.notFood ? '取り消す' : '食材ではない'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
