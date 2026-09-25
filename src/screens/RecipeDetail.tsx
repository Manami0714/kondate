import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import { setFavoriteInDb } from '../db/recipeRepo';
import type { Food, Recipe, RecipeIngredient } from '../db/types';
import { flavorLabel } from '../data/tags';
import { DIFFICULTY_LABELS, formatAmount, formatApproxAmount } from '../logic/format';
import { FeedbackSheet } from './feedback/FeedbackSheet';

interface Props {
  recipe: Recipe;
  byId: ReadonlyMap<string, Food>;
  /** 人数に合わせた量で見せるとき:その量と、人数の説明(例:「この日の合計:2.27人分(A 1倍・B 1.27倍)」) */
  scaled?: { ingredients: RecipeIngredient[]; label: string };
}

/** レシピの中身を見る */
export function RecipeDetail({ recipe, byId, scaled }: Props) {
  const ingredients = scaled?.ingredients ?? recipe.ingredients;
  const main = ingredients.filter((i) => byId.get(i.foodId)?.kind !== '調味料');
  const seasonings = ingredients.filter((i) => byId.get(i.foodId)?.kind === '調味料');

  const ingredientList = (items: Recipe['ingredients']) => (
    <ul className="list">
      {items.map((i) => {
        const food = byId.get(i.foodId);
        return (
          <li key={i.foodId} className="list-item">
            <span className="group-dot" data-group={food?.foodGroup ?? ''} aria-hidden="true" />
            <span className="list-main">
              {food?.name ?? '(辞書にない食材)'}
              {i.main && <span className="tag" style={{ marginLeft: 6 }}>主</span>}
            </span>
            <span className="list-end">{food ? (scaled ? formatApproxAmount : formatAmount)(i.amount, food.unit) : i.amount}</span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="form">
      <RecipeActions recipe={recipe} />
      <div className="card">
        <div>
          {recipe.course}・{recipe.minutes}分・{DIFFICULTY_LABELS[recipe.difficulty]}・{scaled ? `元のレシピは${recipe.servings}人分` : `${recipe.servings}人分`}
        </div>
        <div className="tags" style={{ marginTop: 8 }}>
          {recipe.methods.map((m) => (
            <span key={m} className="tag">
              {m}
            </span>
          ))}
          {recipe.flavors.map((f) => (
            <span key={f} className="tag">
              {flavorLabel(f)}
            </span>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          出どころ:{recipe.source}
        </div>
      </div>

      <h3 className="section-title">材料{scaled ? "(この日の人数に合わせた量)" : `(${recipe.servings}人分)`}</h3>
      {scaled && <div className="note">{scaled.label}</div>}
      {main.length > 0 && ingredientList(main)}
      {seasonings.length > 0 && (
        <>
          <span className="field-label">調味料</span>
          {ingredientList(seasonings)}
        </>
      )}

      <h3 className="section-title">手順</h3>
      {recipe.url && (
        <a href={recipe.url} target="_blank" rel="noreferrer">
          レシピのページを開く
        </a>
      )}
      {recipe.steps.length > 0 ? (
        <ol className="steps">
          {recipe.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      ) : (
        !recipe.url && <p className="muted">手順は登録されていません</p>
      )}
    </div>
  );
}

/** お気に入りと感想のボタン。お気に入りはデータベースの今の値を見る(押したらすぐ表示が変わるように) */
function RecipeActions({ recipe }: { recipe: Recipe }) {
  const favorite = useLiveQuery(async () => (await db.recipes.get(recipe.id))?.favorite ?? recipe.favorite, [recipe.id]) ?? recipe.favorite;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return (
    <div className="btn-row">
      <button
        type="button"
        className={`btn${favorite ? ' btn-favorite' : ''}`}
        aria-pressed={favorite}
        onClick={() => void setFavoriteInDb(db, recipe.id, !favorite)}
      >
        {favorite ? '★ お気に入り' : '☆ お気に入りにする'}
      </button>
      <button type="button" className="btn" onClick={() => setFeedbackOpen(true)}>
        この料理の感想
      </button>
      {feedbackOpen && <FeedbackSheet initialText={`${recipe.name}は`}onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
