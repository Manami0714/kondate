import { useState } from 'react';
import { MultiChoice, SingleChoice } from '../components/Choice';
import { ErrorList, Field } from '../components/Field';
import { FoodPicker } from '../components/FoodPicker';
import { Sheet } from '../components/Sheet';
import { COOKING_METHODS, FLAVORS, flavorLabel } from '../data/tags';
import { db } from '../db/db';
import type { Course, Difficulty, Food, Recipe } from '../db/types';
import { validateRecipeDraft, type RecipeDraft } from '../logic/forms';
import { DIFFICULTY_LABELS, amountToInput } from '../logic/format';
import { randomId } from '../logic/id';
import { canBeMain } from '../logic/planner/mainFoods';

interface Props {
  recipe: Recipe | null;
  foods: readonly Food[];
  byId: Map<string, Food>;
  onDone: (saved: Recipe | null) => void;
}

function toDraft(r: Recipe | null): RecipeDraft {
  if (!r) {
    return {
      name: '',
      course: '主菜',
      ingredients: [],
      servings: '2',
      minutes: '20',
      difficulty: 1,
      methods: [],
      flavors: [],
      stepsText: '',
      favorite: false,
    };
  }
  return {
    name: r.name,
    course: r.course,
    ingredients: r.ingredients.map((i) => ({ foodId: i.foodId, amount: amountToInput(i.amount), main: i.main })),
    servings: String(r.servings),
    minutes: String(r.minutes),
    difficulty: r.difficulty,
    methods: [...r.methods],
    flavors: [...r.flavors],
    stepsText: r.steps.join('\n'),
    favorite: r.favorite,
  };
}

/** マイレシピの登録・編集(URL レシピの編集にも使う) */
export function RecipeForm({ recipe, foods, byId, onDone }: Props) {
  const [draft, setDraft] = useState<RecipeDraft>(() => toDraft(recipe));
  const [errors, setErrors] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const set = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const setAmount = (index: number, amount: string) =>
    set(
      'ingredients',
      draft.ingredients.map((ing, i) => (i === index ? { ...ing, amount } : ing)),
    );
  const toggleMain = (index: number) =>
    set(
      'ingredients',
      draft.ingredients.map((ing, i) => (i === index ? { ...ing, main: !ing.main } : ing)),
    );

  const save = async () => {
    // 出どころと URL はそのまま引き継ぐ(新しく作るときはマイレシピ)
    const origin = recipe ? { source: recipe.source, url: recipe.url } : undefined;
    const result = validateRecipeDraft(draft, recipe?.id ?? `my_${randomId()}`, byId, origin);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    await db.recipes.put(result.value);
    onDone(result.value);
  };

  return (
    <div className="form">
      <Field label="料理名">
        <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="区分">
        <SingleChoice<Course> options={['主菜', '副菜', '汁物']} value={draft.course} onChange={(v) => set('course', v)} />
      </Field>

      <h3 className="section-title">材料</h3>
      <div className="row-2">
        <Field label="基準の人数">
          <div className="input-with-unit">
            <input
              className="input"
              inputMode="numeric"
              value={draft.servings}
              onChange={(e) => set('servings', e.target.value)}
            />
            <span>人分</span>
          </div>
        </Field>
      </div>
      {draft.ingredients.length > 0 && (
        <div className="form" style={{ gap: 8 }}>
          {draft.ingredients.map((ing, i) => {
            const food = byId.get(ing.foodId);
            return (
              <div key={ing.foodId} className="ingredient-row">
                <span>{food?.name ?? '(辞書にない食材)'}</span>
                {canBeMain(food) ? (
                  <button
                    type="button"
                    className={`chip${ing.main ? ' is-on' : ''}`}
                    aria-pressed={ing.main}
                    aria-label={`${food?.name ?? ''}を主な材料にする`}
                    onClick={() => toggleMain(i)}
                  >
                    主
                  </button>
                ) : (
                  <span />
                )}
                <div className="input-with-unit">
                  <input
                    className="input"
                    aria-label={`${food?.name ?? ''}の量`}
                    value={ing.amount}
                    onChange={(e) => setAmount(i, e.target.value)}
                  />
                  <span>{food?.unit}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  aria-label={`${food?.name ?? ''}を外す`}
                  onClick={() => set('ingredients', draft.ingredients.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className="btn btn-block" onClick={() => setPicking(true)}>
        ＋ 材料を追加
      </button>
      <span className="field-hint">
        量は食材ごとの単位で入れます。「1/4」のような分数も使えます。料理の中心になる材料(1〜2個)は「主」をタップします
      </span>

      <h3 className="section-title">時間・難易度</h3>
      <Field label="調理時間">
        <div className="input-with-unit">
          <input className="input" inputMode="numeric" value={draft.minutes} onChange={(e) => set('minutes', e.target.value)} />
          <span>分</span>
        </div>
      </Field>
      <Field label="難易度">
        <SingleChoice<Difficulty>
          options={[1, 2, 3]}
          value={draft.difficulty}
          onChange={(v) => set('difficulty', v)}
          label={(v) => DIFFICULTY_LABELS[v]}
        />
      </Field>

      <h3 className="section-title">タグ</h3>
      <Field label="調理法">
        <MultiChoice options={COOKING_METHODS} value={draft.methods} onChange={(v) => set('methods', v)} />
      </Field>
      <Field label="味付け">
        <MultiChoice options={FLAVORS} value={draft.flavors} onChange={(v) => set('flavors', v)} label={flavorLabel} />
      </Field>

      <h3 className="section-title">手順</h3>
      {recipe?.source === 'URL' ? (
        <Field label="レシピのページ" hint="URL のレシピは、手順をそのページで見ます">
          <span className="muted" style={{ wordBreak: 'break-all' }}>
            {recipe.url}
          </span>
        </Field>
      ) : (
        <Field label="手順" hint="1行に1つの手順を書きます">
          <textarea className="textarea" value={draft.stepsText} onChange={(e) => set('stepsText', e.target.value)} />
        </Field>
      )}

      <ErrorList errors={errors} />
      <button type="button" className="btn btn-primary btn-block" onClick={save}>
        保存
      </button>

      {picking && (
        <Sheet title="材料を選ぶ" onClose={() => setPicking(false)}>
          <FoodPicker
            foods={foods}
            excludeIds={draft.ingredients.map((i) => i.foodId)}
            allowAddNew
            onPick={(food) => {
              set('ingredients', [...draft.ingredients, { foodId: food.id, amount: '', main: false }]);
              setPicking(false);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}
