import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { MultiChoice, SingleChoice } from '../../components/Choice';
import { ErrorList, Field } from '../../components/Field';
import { FoodPicker } from '../../components/FoodPicker';
import { Sheet } from '../../components/Sheet';
import { COOKING_METHODS, FLAVORS, flavorLabel } from '../../data/tags';
import { db } from '../../db/db';
import { saveImportedRecipeInDb } from '../../db/recipeRepo';
import type { Course, Difficulty, Food, Recipe } from '../../db/types';
import { DIFFICULTY_LABELS, amountToInput } from '../../logic/format';
import { randomId } from '../../logic/id';
import { canBeMain } from '../../logic/planner/mainFoods';
import { readPastedText } from '../../logic/recipeImport/clipboard';
import {
  findRecipeByUrl,
  initialFormState,
  planImportSave,
  type ImportFormState,
} from '../../logic/recipeImport/importSave';
import { ingredientAmount, readIngredients } from '../../logic/recipeImport/matchIngredients';
import type { ImportedPage, IngredientStatus } from '../../logic/recipeImport/types';
import { DEFAULT_MINUTES, DEFAULT_SERVINGS } from '../../config/recipeImport';
import { ImportIngredientRow, type ImportRow } from './ImportIngredientRow';

interface Props {
  foods: readonly Food[];
  byId: ReadonlyMap<string, Food>;
  onClose: () => void;
  onSaved: (recipe: Recipe) => void;
}

/** 確認画面の状態(材料の行は量の注意つき) */
interface Form extends ImportFormState {
  rows: ImportRow[];
}

const SECTIONS: { status: IngredientStatus; title: string; hint: string }[] = [
  { status: '読み取った', title: '読み取った材料', hint: '量を確かめてください。料理の中心になる材料は、上から1〜2個に「主」を付けてあります。違えばタップで直せます' },
  { status: '自信がない', title: '自信のない材料', hint: '食材を確かめてください。選んだ内容は次から自動で読めます' },
  { status: '読めなかった', title: '読めなかった材料', hint: '食材を選ぶと、材料名を別名として覚えます。辞書にない食材は、選ぶ画面で辞書に追加できます' },
];

/** URL からのレシピ取り込み:貼り付け → 確認 → 保存 */
export function ImportSheet({ foods, byId, onClose, onSaved }: Props) {
  const [text, setText] = useState('');
  const [page, setPage] = useState<ImportedPage | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const urlRecipes = useLiveQuery(() => db.recipes.where('source').equals('URL').toArray(), []);

  const read = () => {
    const result = readPastedText(text);
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    const items = readIngredients(result.page.ingredientLines, foods);
    const state = initialFormState(result.page, items, byId);
    setPage(result.page);
    setForm({ ...state, rows: state.rows.map((r, i) => ({ ...r, note: items[i].note })) });
    setErrors([]);
  };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => f && { ...f, [key]: value });
  const updateRow = (key: number, patch: Partial<ImportRow>) =>
    setForm((f) => f && { ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  /** 食材を決める。量は元の書き方から、その食材の単位で計算し直す */
  const choose = (row: ImportRow, food: Food) => {
    const { amount, note } = ingredientAmount(row.item.amountText, food);
    updateRow(row.key, {
      foodId: food.id,
      amountText: amount === null ? '' : amountToInput(amount),
      note,
      confirmed: true,
      skip: false,
      // 主の印は残す(調味料・薬味に変えたときだけ外す)
      main: row.main && canBeMain(food),
    });
  };

  const save = async () => {
    if (!form || !urlRecipes) return;
    const plan = planImportSave(form, foods, urlRecipes, randomId);
    if (!plan.ok) {
      setErrors(plan.errors);
      return;
    }
    if (plan.replaced && !window.confirm(`このURLのレシピ「${plan.replaced.name}」はすでに登録されています。上書きしますか?`)) return;
    await saveImportedRecipeInDb(db, plan.recipe, plan.updatedFoods);
    onSaved(plan.recipe);
  };

  if (form === null || page === null) {
    return (
      <Sheet title="URLから取り込み" onClose={onClose}>
        <div className="form">
          <Field
            label="コピーしたレシピ"
            hint="Safari でレシピのページを開き、共有ボタンから「献立に取り込む」を実行してから、ここに貼り付けます"
          >
            <textarea className="textarea" style={{ minHeight: 200 }} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </Field>
          <ErrorList errors={errors} />
          <button type="button" className="btn btn-primary btn-block" disabled={text.trim() === ''} onClick={read}>
            読み取る
          </button>
        </div>
      </Sheet>
    );
  }

  const pickingRow = picking === null ? undefined : form.rows.find((r) => r.key === picking);
  if (pickingRow) {
    return (
      <Sheet title={`「${pickingRow.item.name}」の食材を選ぶ`} onClose={() => setPicking(null)}>
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

  const duplicate = urlRecipes && form.url !== '' ? findRecipeByUrl(urlRecipes, form.url) : undefined;
  const skipped = form.rows.filter((r) => r.item.status === '材料に入れない');
  const rowProps = (row: ImportRow) => ({
    row,
    byId,
    onUpdate: (patch: Partial<ImportRow>) => updateRow(row.key, patch),
    onChoose: (food: Food) => choose(row, food),
    onPick: () => setPicking(row.key),
  });

  return (
    <Sheet title="取り込む内容の確認" onClose={onClose}>
      <div className="form">
        {page.from === 'ページの文字' && (
          <div className="note note-warn">
            このページにはレシピの情報(構造化データ)がなかったので、ページの文字から読みました。読み間違いがないか確かめてください
          </div>
        )}
        {duplicate && <div className="note note-warn">このURLのレシピ「{duplicate.name}」はすでに登録されています。保存すると上書きします(お気に入りは残ります)</div>}

        <Field label="料理名">
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        {page.url ? (
          <Field label="URL">
            <span className="muted" style={{ wordBreak: 'break-all' }}>
              {form.url}
            </span>
          </Field>
        ) : (
          <Field label="URL" hint="ページの URL が読めなかったので、入れてください">
            <input className="input" inputMode="url" value={form.url} onChange={(e) => set('url', e.target.value)} />
          </Field>
        )}
        <Field label="区分">
          <SingleChoice<Course> options={['主菜', '副菜', '汁物']} value={form.course} onChange={(v) => set('course', v)} />
        </Field>
        <div className="row-2">
          <Field label="基準の人数">
            <div className="input-with-unit">
              <input className="input" inputMode="numeric" value={form.servings} onChange={(e) => set('servings', e.target.value)} />
              <span>人分</span>
            </div>
          </Field>
          <Field label="調理時間">
            <div className="input-with-unit">
              <input className="input" inputMode="numeric" value={form.minutes} onChange={(e) => set('minutes', e.target.value)} />
              <span>分</span>
            </div>
          </Field>
        </div>
        {page.servings === null && <div className="note note-warn">人数が書かれていなかったので{DEFAULT_SERVINGS}人分にしました</div>}
        {page.minutes === null && <div className="note note-warn">時間が書かれていなかったので{DEFAULT_MINUTES}分にしました</div>}
        <Field label="難易度" hint="はじめは調理時間から決めています">
          <SingleChoice<Difficulty>
            options={[1, 2, 3]}
            value={form.difficulty}
            onChange={(v) => set('difficulty', v)}
            label={(v) => DIFFICULTY_LABELS[v]}
          />
        </Field>

        {SECTIONS.map((section) => {
          const list = form.rows.filter((r) => r.item.status === section.status);
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
                  <ImportIngredientRow key={row.key} {...rowProps(row)} />
                ))}
              </ul>
            </section>
          );
        })}
        {skipped.length > 0 && (
          <details>
            <summary className="muted">材料に入れない({skipped.length}件)</summary>
            <ul className="list" style={{ marginTop: 8 }}>
              {skipped.map((row) => (
                <ImportIngredientRow key={row.key} {...rowProps(row)} />
              ))}
            </ul>
          </details>
        )}

        <h3 className="section-title">タグ</h3>
        <Field label="調理法">
          <MultiChoice options={COOKING_METHODS} value={form.methods} onChange={(v) => set('methods', v)} />
        </Field>
        <Field label="味付け">
          <MultiChoice options={FLAVORS} value={form.flavors} onChange={(v) => set('flavors', v)} label={flavorLabel} />
        </Field>

        <ErrorList errors={errors} />
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setForm(null);
              setPage(null);
              setErrors([]);
            }}
          >
            貼り付けに戻る
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </Sheet>
  );
}
