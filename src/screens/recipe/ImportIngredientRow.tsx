import type { Food } from '../../db/types';
import { canBeMain } from '../../logic/planner/mainFoods';
import type { ImportRowState } from '../../logic/recipeImport/importSave';
import type { ImportAmountNote } from '../../logic/recipeImport/types';

/** 確認画面の材料1行(量の注意つき) */
export interface ImportRow extends ImportRowState {
  note: ImportAmountNote | null;
}

/** 量の注意の文言 */
function noteLabel(note: ImportAmountNote, food: Food, hasAmount: boolean): string {
  switch (note) {
    case 'not-number':
      return hasAmount ? '量が数字ではなかったので、少しの量にしました。確かめてください' : '量が数字ではありませんでした。量を入れてください';
    case 'converted':
      return `辞書の単位(${food.unit})に換算しました`;
    case 'unit-mismatch':
      return hasAmount
        ? `単位が辞書(${food.unit})と違うので、ふつうの量にしました。確かめてください`
        : `単位が辞書(${food.unit})と違うので、${food.unit}での量を入れてください`;
  }
}

interface Props {
  row: ImportRow;
  byId: ReadonlyMap<string, Food>;
  onUpdate: (patch: Partial<ImportRow>) => void;
  /** 候補の食材に決める(量は元の書き方から計算し直す) */
  onChoose: (food: Food) => void;
  /** 辞書から食材を選ぶ画面を開く */
  onPick: () => void;
}

/** 確認画面の材料1行 */
export function ImportIngredientRow({ row, byId, onUpdate, onChoose, onPick }: Props) {
  const food = row.foodId ? byId.get(row.foodId) : undefined;
  const candidates = row.item.candidateIds.map((id) => byId.get(id)).filter((f): f is Food => f !== undefined);
  const learnsAlias = food !== undefined && row.confirmed && (row.item.status !== '読み取った' || row.foodId !== row.item.foodId);
  return (
    <li className="check-row" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1, display: 'grid', gap: 6, minWidth: 0 }}>
        <div className="list-sub">{row.item.line}</div>
        {row.skip ? (
          <div className="muted">材料に入れない</div>
        ) : food ? (
          <>
            <div className="list-title">
              {food.name}
              {!row.confirmed && <span className="muted">(この食材でよいか確かめてください)</span>}
              {learnsAlias && <span className="muted">(「{row.item.name}」を別名として覚えます)</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="input-with-unit" style={{ maxWidth: 180 }}>
                <input
                  className="input"
                  value={row.amountText}
                  aria-label={`${food.name}の量`}
                  onChange={(e) => onUpdate({ amountText: e.target.value, note: null })}
                />
                <span>{food.unit}</span>
              </div>
              {canBeMain(food) ? (
                <button
                  type="button"
                  className={`chip${row.main ? ' is-on' : ''}`}
                  aria-pressed={row.main}
                  aria-label={`${food.name}を主な材料にする`}
                  onClick={() => onUpdate({ main: !row.main })}
                >
                  主
                </button>
              ) : (
                <span />
              )}
            </div>
            {row.note && <div className="note note-warn">{noteLabel(row.note, food, row.amountText.trim() !== '')}</div>}
          </>
        ) : (
          <div className="muted">食材が決まっていません</div>
        )}
        {!row.skip && !row.confirmed && candidates.length > 1 && (
          <div className="segmented">
            {candidates.map((c) => (
              <button key={c.id} type="button" className="chip" onClick={() => onChoose(c)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="btn-row">
          {!row.skip && (
            <button type="button" className="btn btn-small" onClick={onPick}>
              {food ? '変える' : '食材を選ぶ'}
            </button>
          )}
          {!row.skip && !row.confirmed && food && candidates.length <= 1 && (
            <button type="button" className="btn btn-small" onClick={() => onUpdate({ confirmed: true })}>
              {food.name}でよい
            </button>
          )}
          <button type="button" className="btn btn-small" onClick={() => onUpdate({ skip: !row.skip })}>
            {row.skip ? '取り消す' : '材料に入れない'}
          </button>
        </div>
      </div>
    </li>
  );
}
