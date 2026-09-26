import { useState } from 'react';
import { ErrorList, Field } from '../../components/Field';
import { FoodPicker } from '../../components/FoodPicker';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { useForLunchInDb } from '../../db/stockRepo';
import type { Food, Stock } from '../../db/types';
import { withAlias } from '../../logic/aliases';
import { parseAmount } from '../../logic/forms';
import { amountToInput, formatAmount } from '../../logic/format';
import { parseLunch } from '../../logic/lunch/parseLunch';
import { AMOUNT_NOTE_LABELS, toFoodAmount, type AmountNote, type Quantity } from '../../logic/textInput/amount';

interface Props {
  foods: readonly Food[];
  byId: ReadonlyMap<string, Food>;
  stocks: readonly Stock[];
  onClose: () => void;
}

/** 確認画面の1行 */
interface Row {
  key: number;
  foodId: string;
  amountText: string;
  include: boolean;
  note: AmountNote | null;
  /** 読めなかった言葉から選んだときの言葉(保存するとその食材の別名になる) */
  aliasWord: string | null;
}

interface Unread {
  word: string;
  quantity: Quantity | null;
}

type Step =
  | { type: 'input' }
  | { type: 'confirm' }
  /** 食材を選ぶ。unreadIndex があれば、その読めなかった言葉の食材を選ぶ */
  | { type: 'pick'; unreadIndex: number | null };

/** 献立以外で使った食材の口頭入力(「食材を使った」):入力 → 確認 → 在庫から減らす */
export function LunchSheet({ foods, byId, stocks, onClose }: Props) {
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>({ type: 'input' });
  const [rows, setRows] = useState<Row[]>([]);
  const [unread, setUnread] = useState<Unread[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const stockOf = (foodId: string) => stocks.find((s) => s.foodId === foodId)?.amount ?? 0;

  const read = () => {
    const result = parseLunch(text, foods, stocks);
    setRows(
      result.items.map((item, i) => ({
        key: i,
        foodId: item.foodId,
        amountText: amountToInput(item.amount),
        // 在庫にない食材は、はじめは減らさない
        include: item.stockAmount > 0,
        note: item.note,
        aliasWord: null,
      })),
    );
    setNextKey(result.items.length);
    setUnread(result.unread);
    setErrors([]);
    setStep({ type: 'confirm' });
  };

  const addRow = (food: Food, quantity: Quantity | null, aliasWord: string | null) => {
    const { amount, note } = toFoodAmount(quantity, food, stockOf(food.id));
    setRows((prev) => [...prev, { key: nextKey, foodId: food.id, amountText: amountToInput(amount), include: true, note, aliasWord }]);
    setNextKey((k) => k + 1);
  };

  const updateRow = (key: number, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    const errs: string[] = [];
    const items: { foodId: string; amount: number }[] = [];
    for (const row of rows.filter((r) => r.include)) {
      const amount = parseAmount(row.amountText);
      const name = byId.get(row.foodId)?.name ?? '';
      if (amount === null || amount <= 0) errs.push(`${name}の量を0より大きい数字にしてください`);
      else items.push({ foodId: row.foodId, amount });
    }
    if (items.length === 0 && errs.length === 0) errs.push('減らす食材を1つ以上選んでください');
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    // 読めなかった言葉から選んだ食材は、その言葉を別名として覚える
    const updated = new Map<string, Food>();
    for (const row of rows) {
      if (!row.include || row.aliasWord === null) continue;
      const food = updated.get(row.foodId) ?? byId.get(row.foodId);
      if (!food) continue;
      const next = withAlias(food, row.aliasWord, foods);
      if (next) updated.set(food.id, next);
    }
    await useForLunchInDb(db, items, [...updated.values()], new Date());
    onClose();
  };

  if (step.type === 'pick') {
    const target = step.unreadIndex === null ? null : unread[step.unreadIndex];
    return (
      <Sheet title={target ? `「${target.word}」の食材を選ぶ` : '食材を選ぶ'} onClose={() => setStep({ type: 'confirm' })}>
        <FoodPicker
          foods={foods}
          note={(f) => {
            const s = stockOf(f.id);
            return s > 0 ? `在庫 ${formatAmount(s, f.unit)}` : undefined;
          }}
          onPick={(food) => {
            if (target && step.unreadIndex !== null) {
              addRow(food, target.quantity, target.word);
              setUnread((prev) => prev.filter((_, i) => i !== step.unreadIndex));
            } else {
              addRow(food, null, null);
            }
            setStep({ type: 'confirm' });
          }}
        />
      </Sheet>
    );
  }

  if (step.type === 'input') {
    return (
      <Sheet title="使った食材" onClose={onClose}>
        <div className="form">
          <p className="muted" style={{ margin: 0 }}>
            朝ごはんや昼ごはんなど、献立以外で使った食材を話してください
          </p>
          <Field label="使った食材と量" hint="キーボードのマイクで話して入れられます。例:朝に卵2個、昼にキャベツ半分使った">
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
    <Sheet title="使った食材の確認" onClose={onClose}>
      <div className="form">
        <p className="muted" style={{ margin: 0 }}>
          「{text.trim()}」
        </p>
        {rows.length === 0 ? (
          <div className="empty">食材が見つかりませんでした。下の「＋ 食材を追加」から選べます。</div>
        ) : (
          <ul className="list">
            {rows.map((row) => {
              const food = byId.get(row.foodId);
              if (!food) return null;
              const stock = stockOf(food.id);
              const amount = parseAmount(row.amountText);
              return (
                <li key={row.key} className="check-row" style={{ alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={row.include}
                    aria-label={`${food.name}を減らす`}
                    onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                  />
                  <div style={{ flex: 1, display: 'grid', gap: 4 }}>
                    <div className="list-title">
                      {food.name}
                      {row.aliasWord && <span className="muted">(「{row.aliasWord}」を別名として覚えます)</span>}
                    </div>
                    <div className="input-with-unit">
                      <input
                        className="input"
                        value={row.amountText}
                        aria-label={`${food.name}の量`}
                        onChange={(e) => updateRow(row.key, { amountText: e.target.value, note: null })}
                      />
                      <span>{food.unit}</span>
                    </div>
                    <div className="field-hint">{stock > 0 ? `在庫 ${formatAmount(stock, food.unit)}` : '在庫にありません'}</div>
                    {row.note && <div className="note note-warn">{AMOUNT_NOTE_LABELS[row.note]}</div>}
                    {row.include && stock > 0 && amount !== null && amount > stock && (
                      <div className="note note-warn">在庫より多いので、在庫は0になります</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {unread.length > 0 && (
          <>
            <h3 className="section-title">読めなかった言葉</h3>
            <p className="field-hint" style={{ margin: 0 }}>
              食材を選ぶと、その言葉を別名として覚え、次から自動で読めます
            </p>
            <ul className="list">
              {unread.map((u, i) => (
                <li key={u.word} className="list-item">
                  <span className="list-main">{u.word}</span>
                  <button type="button" className="btn btn-small" onClick={() => setStep({ type: 'pick', unreadIndex: i })}>
                    食材を選ぶ
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => setUnread((prev) => prev.filter((_, j) => j !== i))}
                  >
                    無視
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button type="button" className="btn btn-block" onClick={() => setStep({ type: 'pick', unreadIndex: null })}>
          ＋ 食材を追加
        </button>
        <ErrorList errors={errors} />
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setStep({ type: 'input' })}>
            入力に戻る
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()}>
            在庫から減らす
          </button>
        </div>
      </div>
    </Sheet>
  );
}
