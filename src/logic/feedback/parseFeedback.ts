// 口頭フィードバックの読み取り(純粋関数)
// 例:「ほうれん草は好きなんだけど、胡麻和えが微妙だった」→ ほうれん草(食材):好き/胡麻味の和え物:提案時の嫌い
import { DISH_WORDS, type DishWord } from '../../data/dishWords';
import { SENTIMENT_WORDS, type Sentiment } from '../../data/sentimentWords';
import type { FeedbackKind, Food, Recipe } from '../../db/types';
import { normalizeForSearch } from '../foodSearch';
import { cleanText, toMatchForm } from '../textInput/normalize';
import { findSpans, type Span, type Term } from '../textInput/spans';
import { comboValue, type FeedbackTarget } from './target';

/** 読み取った評価の候補1つ */
export interface FeedbackCandidate {
  target: FeedbackTarget;
  /** 文の中の書き方(表示用) */
  word: string;
  /** 推測した評価。評価の言葉が見つからなければ null */
  sentiment: Sentiment | null;
  /**
   * 確認画面の初期値。好き → 好き、嫌いの側 → 必ず「提案時の嫌い」、評価がわからない → null(登録しない)。
   * 「食後の嫌い」は二度と提案されなくなるので、確認画面で本人が選んだときだけにする
   */
  kind: FeedbackKind | null;
}

/** 探す言葉の値。調味料の食材は、長い一致で言葉を隠すためだけに使い、評価の対象にはしない */
type TargetValue = { target: FeedbackTarget } | { skip: true };

/** 同じ長さなら、レシピ → 料理の言い方 → 食材 の順に優先する */
const PRIORITY = { recipe: 0, dish: 1, food: 2 } as const;

/** 料理の言い方を評価の対象にする */
function dishTarget({ method, flavor }: DishWord): FeedbackTarget | null {
  if (method && flavor) return { targetType: '料理法×味付け', targetValue: comboValue(method, flavor) };
  if (method) return { targetType: '料理法', targetValue: method };
  if (flavor) return { targetType: '味付け', targetValue: flavor };
  return null;
}

function targetTerms(foods: readonly Food[], recipes: readonly Recipe[]): Term<TargetValue>[] {
  const terms: Term<TargetValue>[] = [];
  for (const r of recipes) {
    terms.push({ key: normalizeForSearch(r.name), value: { target: { targetType: 'レシピ', targetValue: r.id } }, priority: PRIORITY.recipe });
  }
  for (const d of DISH_WORDS) {
    const target = dishTarget(d);
    if (!target) continue;
    for (const w of d.words) terms.push({ key: normalizeForSearch(w), value: { target }, priority: PRIORITY.dish });
  }
  for (const f of foods) {
    const value: TargetValue = f.kind === '調味料' ? { skip: true } : { target: { targetType: '食材', targetValue: f.id } };
    for (const n of new Set([f.name, ...f.aliases].map(normalizeForSearch))) terms.push({ key: n, value, priority: PRIORITY.food });
  }
  return terms;
}

const SENTIMENT_TERMS: Term<Sentiment>[] = SENTIMENT_WORDS.flatMap((g) =>
  g.words.map((w) => ({ key: normalizeForSearch(w), value: g.sentiment })),
);

/**
 * 文から評価の対象(レシピ名・料理の言い方・食材名)を探し、それぞれに評価の言葉を当てる。
 * - 対象より後ろで最初に出てくる評価の言葉を使う(「ほうれん草と小松菜が好き」は両方とも好き)
 * - 後ろになければ、前で最後に出てくる評価の言葉を使う(「好きなのはほうれん草」)
 * - 同じ対象が2回出たら、最初のものだけ残す
 */
export function parseFeedback(text: string, foods: readonly Food[], recipes: readonly Recipe[]): FeedbackCandidate[] {
  const clean = cleanText(text);
  const match = toMatchForm(clean);
  const targets = findSpans(match, targetTerms(foods, recipes)).filter(
    (s): s is Span<{ target: FeedbackTarget }> => 'target' in s.value,
  );
  const overlapsTarget = (s: Span<Sentiment>) => targets.some((t) => s.start < t.end && t.start < s.end);
  const sentiments = findSpans(match, SENTIMENT_TERMS).filter((s) => !overlapsTarget(s));

  const result: FeedbackCandidate[] = [];
  for (const t of targets) {
    const { target } = t.value;
    if (result.some((r) => r.target.targetType === target.targetType && r.target.targetValue === target.targetValue)) continue;
    const after = sentiments.find((s) => s.start >= t.end);
    const before = [...sentiments].reverse().find((s) => s.end <= t.start);
    const sentiment = (after ?? before)?.value ?? null;
    const kind: FeedbackKind | null = sentiment === '好き' ? '好き' : sentiment === '嫌い' ? '提案時の嫌い' : null;
    result.push({ target, word: clean.slice(t.start, t.end), sentiment, kind });
  }
  return result;
}
