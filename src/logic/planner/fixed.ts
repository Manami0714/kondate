// 料理の指定(純粋関数)
// 指定の一覧の出し入れと、指定した料理に出す注意を作る
import type { Course, Feedback, FixedDish, Food, Member, PlanConditions, Recipe } from '../../db/types';
import { targetLabel } from '../feedback/target';
import { DIFFICULTY_LABELS } from '../format';
import { afterMealDislikes, allergyHits } from './filter';
import { mainFoodIds } from './mainFoods';
import type { PlannerData } from './types';

export type FixedWarningKind = 'アレルギー' | '食後の嫌い' | '時間' | '主な材料';

export interface FixedWarning {
  kind: FixedWarningKind;
  text: string;
}

const COURSE_ORDER: readonly Course[] = ['主菜', '副菜', '汁物'];

/** その枠に指定したレシピのID。指定がなければ null */
export function fixedRecipeId(fixed: readonly FixedDish[], dayIndex: number, course: Course): string | null {
  return fixed.find((f) => f.dayIndex === dayIndex && f.course === course)?.recipeId ?? null;
}

/** 指定を足す。同じ枠にすでに指定があれば置き換える */
export function setFixed(fixed: readonly FixedDish[], item: FixedDish): FixedDish[] {
  return [...removeFixed(fixed, item.dayIndex, item.course), item].sort(
    (a, b) => a.dayIndex - b.dayIndex || COURSE_ORDER.indexOf(a.course) - COURSE_ORDER.indexOf(b.course),
  );
}

/** その枠の指定を外す */
export function removeFixed(fixed: readonly FixedDish[], dayIndex: number, course: Course): FixedDish[] {
  return fixed.filter((f) => !(f.dayIndex === dayIndex && f.course === course));
}

/**
 * アレルギー・食後の嫌いの注意文。確定したあとの献立や料理の詳細にも出し続ける。
 * アプリが選んだ料理は必ず外す条件を通っているので、ふつうは指定した料理にだけ出る
 * (確定のあとでアレルギーや食後の嫌いを登録したときは、アプリが選んだ料理にも出る)
 */
export function safetyWarnings(
  recipe: Recipe,
  members: readonly Member[],
  feedbacks: readonly Feedback[],
  foodsById: ReadonlyMap<string, Food>,
  recipesById: ReadonlyMap<string, Recipe>,
): FixedWarning[] {
  const allergy = allergyHits(recipe, members, foodsById).map(
    (hit): FixedWarning => ({ kind: 'アレルギー', text: `${hit.member.name}のアレルギー(${hit.items.join('、')})に当てはまります` }),
  );
  const dislikes = afterMealDislikes(recipe, feedbacks);
  const dislike: FixedWarning[] =
    dislikes.length > 0
      ? [
          {
            kind: '食後の嫌い',
            text: `「食後の嫌い」(${dislikes.map((f) => targetLabel(f, foodsById, recipesById)).join('、')})に当てはまります`,
          },
        ]
      : [];
  return [...allergy, ...dislike];
}

/** 時間・難易度の条件を超えているときの注意 */
function timeWarnings(recipe: Recipe, conditions: PlanConditions): FixedWarning[] {
  const warnings: FixedWarning[] = [];
  if (conditions.maxMinutes !== null && recipe.minutes > conditions.maxMinutes) {
    warnings.push({ kind: '時間', text: `調理時間(${recipe.minutes}分)が、条件の${conditions.maxMinutes}分を超えています` });
  }
  if (recipe.difficulty > conditions.maxDifficulty) {
    warnings.push({
      kind: '時間',
      text: `難易度(${DIFFICULTY_LABELS[recipe.difficulty]})が、条件の「${DIFFICULTY_LABELS[conditions.maxDifficulty]}まで」を超えています`,
    });
  }
  return warnings;
}

/** 同じ日に指定したほかの料理と、主な材料がかぶるときの注意 */
function mainOverlapWarnings(
  recipe: Recipe,
  dayIndex: number,
  fixed: readonly FixedDish[],
  foodsById: ReadonlyMap<string, Food>,
  recipesById: ReadonlyMap<string, Recipe>,
): FixedWarning[] {
  const mains = new Set(mainFoodIds(recipe, foodsById));
  return fixed
    .filter((f) => f.dayIndex === dayIndex && f.course !== recipe.course)
    .flatMap((f) => {
      const other = recipesById.get(f.recipeId);
      if (!other) return [];
      const shared = mainFoodIds(other, foodsById).filter((id) => mains.has(id));
      if (shared.length === 0) return [];
      const names = shared.map((id) => foodsById.get(id)?.name ?? id).join('、');
      return [{ kind: '主な材料' as const, text: `同じ日に指定した「${other.name}」と、主な材料(${names})がかぶっています` }];
    });
}

export interface FixedWarningInput {
  recipe: Recipe;
  dayIndex: number;
  /** 今の指定の一覧(この料理自身の指定は含んでも含まなくてもよい) */
  fixed: readonly FixedDish[];
  /** その日のメンバー */
  members: readonly Member[];
  conditions: PlanConditions;
  feedbacks: readonly Feedback[];
  foodsById: ReadonlyMap<string, Food>;
  recipesById: ReadonlyMap<string, Recipe>;
}

/** 指定した(しようとしている)料理に出す注意。アレルギー・食後の嫌い・時間と難易度・主な材料のかぶり */
export function fixedDishWarnings(input: FixedWarningInput): FixedWarning[] {
  const { recipe, dayIndex, fixed, members, conditions, feedbacks, foodsById, recipesById } = input;
  return [
    ...safetyWarnings(recipe, members, feedbacks, foodsById, recipesById),
    ...timeWarnings(recipe, conditions),
    ...mainOverlapWarnings(recipe, dayIndex, fixed, foodsById, recipesById),
  ];
}

/** 入れる前に「それでも入れる」の確認がいる注意か(アレルギー・食後の嫌い) */
export function needsConfirm(warnings: readonly FixedWarning[]): boolean {
  return warnings.some((w) => w.kind === 'アレルギー' || w.kind === '食後の嫌い');
}

/** 画面から使う:その日のメンバーIDと登録データから、その枠に入れる料理の注意を作る(同じ枠の今の指定は見ない) */
export function warningsForSlot(
  recipe: Recipe,
  dayIndex: number,
  memberIds: readonly string[],
  fixed: readonly FixedDish[],
  conditions: PlanConditions,
  data: PlannerData,
): FixedWarning[] {
  return fixedDishWarnings({
    recipe,
    dayIndex,
    fixed: removeFixed(fixed, dayIndex, recipe.course),
    members: memberIds.map((id) => data.membersById.get(id)).filter((m): m is Member => m !== undefined),
    conditions,
    feedbacks: data.feedbacks,
    foodsById: data.foodsById,
    recipesById: new Map(data.recipes.map((r) => [r.id, r])),
  });
}
