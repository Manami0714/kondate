import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { SingleChoice } from '../components/Choice';
import { Sheet } from '../components/Sheet';
import { db } from '../db/db';
import type { Course, Recipe } from '../db/types';
import { useFoods } from '../hooks/useFoods';
import { DIFFICULTY_LABELS } from '../logic/format';
import { hasMainFlags } from '../logic/planner/mainFoods';
import { RecipeDetail } from './RecipeDetail';
import { RecipeForm } from './RecipeForm';

type Mode = { type: 'none' } | { type: 'view'; recipe: Recipe } | { type: 'edit'; recipe: Recipe | null };

export function RecipeScreen() {
  const foodData = useFoods();
  const [course, setCourse] = useState<Course>('主菜');
  const recipes = useLiveQuery(() => db.recipes.where('course').equals(course).toArray(), [course]);
  const [mode, setMode] = useState<Mode>({ type: 'none' });

  if (!foodData || !recipes) return <p className="muted">読み込み中…</p>;

  // マイレシピを先に、あとは名前順
  const sorted = [...recipes].sort(
    (a, b) =>
      Number(b.source === 'マイレシピ') - Number(a.source === 'マイレシピ') || a.name.localeCompare(b.name, 'ja'),
  );
  const close = () => setMode({ type: 'none' });

  return (
    <>
      <div className="screen-header">
        <h1 className="screen-title">レシピ</h1>
        <button type="button" className="btn btn-primary" onClick={() => setMode({ type: 'edit', recipe: null })}>
          ＋ マイレシピ
        </button>
      </div>
      <SingleChoice<Course> options={['主菜', '副菜', '汁物']} value={course} onChange={setCourse} />
      <div style={{ height: 12 }} />

      {sorted.length === 0 ? (
        <div className="empty">{course}のレシピはまだありません</div>
      ) : (
        <ul className="list">
          {sorted.map((r) => (
            <li key={r.id}>
              <button type="button" className="list-item" onClick={() => setMode({ type: 'view', recipe: r })}>
                <span className="list-main">
                  <span className="list-title">{r.name}</span>
                  <div className="list-sub">
                    {r.minutes}分・{DIFFICULTY_LABELS[r.difficulty]}・{[...r.methods, ...r.flavors].join('・')}
                  </div>
                </span>
                {!hasMainFlags(r) && <span className="tag">主な材料が未設定</span>}
                {r.source !== '初期' && <span className="tag">{r.source}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode.type === 'view' && (
        <Sheet
          title={mode.recipe.name}
          onClose={close}
          action={
            mode.recipe.source === 'マイレシピ' && (
              <button type="button" className="btn btn-small" onClick={() => setMode({ type: 'edit', recipe: mode.recipe })}>
                編集
              </button>
            )
          }
        >
          <RecipeDetail recipe={mode.recipe} byId={foodData.byId} />
          {mode.recipe.source === 'マイレシピ' && (
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-danger btn-block"
                onClick={async () => {
                  if (!window.confirm(`「${mode.recipe.name}」を削除しますか?`)) return;
                  await db.recipes.delete(mode.recipe.id);
                  close();
                }}
              >
                このレシピを削除
              </button>
            </div>
          )}
        </Sheet>
      )}

      {mode.type === 'edit' && (
        <Sheet title={mode.recipe ? 'マイレシピを編集' : 'マイレシピを追加'} onClose={close}>
          <RecipeForm
            recipe={mode.recipe}
            foods={foodData.foods}
            byId={foodData.byId}
            onDone={(saved) => {
              if (saved) setCourse(saved.course);
              setMode(saved ? { type: 'view', recipe: saved } : { type: 'none' });
            }}
          />
        </Sheet>
      )}
    </>
  );
}
