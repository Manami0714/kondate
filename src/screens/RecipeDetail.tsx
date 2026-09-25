import type { Food, Recipe } from '../db/types';
import { flavorLabel } from '../data/tags';
import { DIFFICULTY_LABELS, formatAmount } from '../logic/format';

interface Props {
  recipe: Recipe;
  byId: Map<string, Food>;
}

/** レシピの中身を見る */
export function RecipeDetail({ recipe, byId }: Props) {
  const main = recipe.ingredients.filter((i) => byId.get(i.foodId)?.kind !== '調味料');
  const seasonings = recipe.ingredients.filter((i) => byId.get(i.foodId)?.kind === '調味料');

  const ingredientList = (items: Recipe['ingredients']) => (
    <ul className="list">
      {items.map((i) => {
        const food = byId.get(i.foodId);
        return (
          <li key={i.foodId} className="list-item">
            <span className="group-dot" data-group={food?.foodGroup ?? ''} aria-hidden="true" />
            <span className="list-main">{food?.name ?? '(辞書にない食材)'}</span>
            <span className="list-end">{food ? formatAmount(i.amount, food.unit) : i.amount}</span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="form">
      <div className="card">
        <div>
          {recipe.course}・{recipe.minutes}分・{DIFFICULTY_LABELS[recipe.difficulty]}・{recipe.servings}人分
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

      <h3 className="section-title">材料({recipe.servings}人分)</h3>
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
