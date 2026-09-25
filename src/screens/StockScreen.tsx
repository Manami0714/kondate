import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ErrorList, Field } from '../components/Field';
import { FoodPicker } from '../components/FoodPicker';
import { Sheet } from '../components/Sheet';
import { db } from '../db/db';
import { addStockToDb, removeStockFromDb, setStockAmountInDb } from '../db/stockRepo';
import type { Food, Stock } from '../db/types';
import { useFoods } from '../hooks/useFoods';
import { formatShortDate } from '../logic/date';
import { parseAmount } from '../logic/forms';
import { amountToInput, formatAmount } from '../logic/format';

type Mode = { type: 'none' } | { type: 'pick' } | { type: 'add'; food: Food } | { type: 'edit'; food: Food; stock: Stock };

export function StockScreen() {
  const foodData = useFoods();
  const stocks = useLiveQuery(() => db.stocks.toArray(), []);
  const [mode, setMode] = useState<Mode>({ type: 'none' });

  if (!foodData || !stocks) return <p className="muted">読み込み中…</p>;
  const { foods, byId } = foodData;
  const stockById = new Map(stocks.map((s) => [s.foodId, s]));

  const rows = stocks
    .map((s) => ({ stock: s, food: byId.get(s.foodId) }))
    .filter((r): r is { stock: Stock; food: Food } => r.food !== undefined)
    .sort((a, b) => a.food.name.localeCompare(b.food.name, 'ja'));

  const close = () => setMode({ type: 'none' });

  return (
    <>
      <div className="screen-header">
        <h1 className="screen-title">在庫</h1>
        <button type="button" className="btn btn-primary" onClick={() => setMode({ type: 'pick' })}>
          ＋ 追加
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty">在庫がありません。「＋ 追加」から登録してください。</div>
      ) : (
        <ul className="list">
          {rows.map(({ stock, food }) => (
            <li key={stock.foodId}>
              <button type="button" className="list-item" onClick={() => setMode({ type: 'edit', food, stock })}>
                <span className="group-dot" data-group={food.foodGroup ?? ''} aria-hidden="true" />
                <span className="list-main">
                  <span className="list-title">{food.name}</span>
                  <div className="list-sub">追加日 {formatShortDate(stock.addedDate)}</div>
                </span>
                <span className="list-end">{formatAmount(stock.amount, food.unit)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode.type === 'pick' && (
        <Sheet title="食材を選ぶ" onClose={close}>
          <FoodPicker
            foods={foods}
            allowAddNew
            note={(f) => {
              const s = stockById.get(f.id);
              return s ? `在庫 ${formatAmount(s.amount, f.unit)}` : undefined;
            }}
            onPick={(food) => setMode({ type: 'add', food })}
          />
        </Sheet>
      )}

      {mode.type === 'add' && (
        <Sheet title={`${mode.food.name}を追加`} onClose={close}>
          <AmountForm
            food={mode.food}
            initial={mode.food.usualAmount}
            current={stockById.get(mode.food.id)}
            submitLabel="在庫に追加"
            onSubmit={async (amount) => {
              await addStockToDb(db, mode.food.id, amount, new Date());
              close();
            }}
          />
        </Sheet>
      )}

      {mode.type === 'edit' && (
        <Sheet title={mode.food.name} onClose={close}>
          <AmountForm
            food={mode.food}
            initial={mode.stock.amount}
            current={mode.stock}
            submitLabel="量を保存"
            allowZero
            onSubmit={async (amount) => {
              await setStockAmountInDb(db, mode.food.id, amount, new Date());
              close();
            }}
          />
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={async () => {
                if (!window.confirm(`${mode.food.name}を在庫から消しますか?`)) return;
                await removeStockFromDb(db, mode.food.id, new Date());
                close();
              }}
            >
              在庫から消す
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

interface AmountFormProps {
  food: Food;
  initial: number;
  current: Stock | undefined;
  submitLabel: string;
  /** 0 を許す(量の手直しで、0 なら在庫から消える) */
  allowZero?: boolean;
  onSubmit: (amount: number) => Promise<void>;
}

function AmountForm({ food, initial, current, submitLabel, allowZero = false, onSubmit }: AmountFormProps) {
  const [text, setText] = useState(amountToInput(initial));
  const [errors, setErrors] = useState<string[]>([]);

  const submit = async () => {
    const amount = parseAmount(text);
    if (amount === null || amount < 0 || (!allowZero && amount === 0)) {
      setErrors([allowZero ? '量は0以上の数字にしてください' : '量は0より大きい数字にしてください']);
      return;
    }
    await onSubmit(amount);
  };

  return (
    <div className="form">
      {current && (
        <p className="muted">
          今の在庫:{formatAmount(current.amount, food.unit)}(追加日 {formatShortDate(current.addedDate)})
        </p>
      )}
      <Field label="量" hint={`「1/2」のような分数も使えます${allowZero ? '。0にすると在庫から消えます' : ''}`}>
        <div className="input-with-unit">
          {/* 分数の「/」を打てるよう、数字専用キーボードにはしない */}
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} />
          <span>{food.unit}</span>
        </div>
      </Field>
      <ErrorList errors={errors} />
      <button type="button" className="btn btn-primary btn-block" onClick={submit}>
        {submitLabel}
      </button>
    </div>
  );
}
