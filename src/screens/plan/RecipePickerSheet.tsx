import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import type { Course, Recipe } from '../../db/types';
import { normalizeForSearch } from '../../logic/foodSearch';
import { DIFFICULTY_LABELS } from '../../logic/format';
import { needsConfirm, type FixedWarning, type FixedWarningKind } from '../../logic/planner/fixed';

interface Props {
  /** 見出し(例:「2日目の主菜を選ぶ」) */
  title: string;
  course: Course;
  recipes: readonly Recipe[];
  /** そのレシピを入れたときの注意 */
  warningsFor: (recipe: Recipe) => FixedWarning[];
  onPick: (recipe: Recipe) => void;
  onClose: () => void;
}

/** 一覧に出す短い印 */
const KIND_TAGS: Record<FixedWarningKind, string> = {
  アレルギー: 'アレルギー',
  食後の嫌い: '食後の嫌い',
  時間: '条件の時間・難易度を超える',
  主な材料: '主な材料がかぶる',
};

/** 献立に入れる料理を選ぶ:区分のレシピを、名前で探す・お気に入りだけに絞る */
export function RecipePickerSheet({ title, course, recipes, warningsFor, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  /** アレルギー・食後の嫌いがあり、「それでも入れる」を確かめている料理 */
  const [confirming, setConfirming] = useState<{ recipe: Recipe; warnings: FixedWarning[] } | null>(null);

  const q = normalizeForSearch(query);
  // お気に入りを先に、あとは名前順
  const list = recipes
    .filter((r) => r.course === course && (!favoritesOnly || r.favorite) && (q === '' || normalizeForSearch(r.name).includes(q)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'ja'));

  const pick = (recipe: Recipe) => {
    const warnings = warningsFor(recipe);
    if (needsConfirm(warnings)) setConfirming({ recipe, warnings });
    else onPick(recipe);
  };

  if (confirming) {
    return (
      <Sheet title={confirming.recipe.name} onClose={onClose}>
        <div className="form">
          {confirming.warnings.map((w) => (
            <div key={w.text} className="note note-warn">
              {w.text}
            </div>
          ))}
          <p style={{ margin: 0 }}>それでも献立に入れますか?入れた後も、献立の画面にこの注意を出し続けます。</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setConfirming(null)}>
              やめる
            </button>
            <button type="button" className="btn btn-danger" onClick={() => onPick(confirming.recipe)}>
              それでも入れる
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="form">
        <input
          className="input"
          type="search"
          placeholder="料理名で探す"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filter-row">
          <button
            type="button"
            aria-pressed={favoritesOnly}
            className={favoritesOnly ? 'chip is-on' : 'chip'}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            ★ お気に入りだけ
          </button>
        </div>
        {list.length === 0 ? (
          <div className="empty">{favoritesOnly ? `お気に入りの${course}は見つかりません` : `${course}のレシピは見つかりません`}</div>
        ) : (
          <ul className="list">
            {list.map((r) => {
              const kinds = [...new Set(warningsFor(r).map((w) => w.kind))];
              return (
                <li key={r.id}>
                  <button type="button" className="list-item" onClick={() => pick(r)}>
                    <span className="list-main">
                      <span className="list-title">{r.name}</span>
                      <div className="list-sub">
                        {r.minutes}分・{DIFFICULTY_LABELS[r.difficulty]}
                      </div>
                      {kinds.length > 0 && (
                        <div className="tags" style={{ marginTop: 4 }}>
                          {kinds.map((k) => (
                            <span key={k} className="tag">
                              ⚠ {KIND_TAGS[k]}
                            </span>
                          ))}
                        </div>
                      )}
                    </span>
                    {r.favorite && (
                      <span className="favorite-mark" aria-label="お気に入り">
                        ★
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
