// ショートカットに貼る JavaScript(docs/shortcut/kondate-import.js)を、偽のページで動かして確かめる
import { describe, expect, it } from 'vitest';
import script from '../../../docs/shortcut/kondate-import.js?raw';
import { PAGE_INGREDIENTS_HEADING, PAGE_STEPS_HEADING } from '../../config/recipeImport';
import { readPastedText } from './clipboard';
import {
  COOKPAD_LIKE,
  DELISH_LIKE,
  KURASHIRU_LIKE,
  LONG_STEP_TEXT,
  PAGE_TEXT,
  PAGE_TEXT_NO_STEPS_HEADING,
  STEP_TEXT,
} from './fixtures';

interface FakePage {
  ldJson: string[];
  canonical?: string;
  href?: string;
  title?: string;
  text?: string;
}

/** 偽の document・location を渡してスクリプトを動かし、completion に渡された文字を返す */
function runScript(page: FakePage): string {
  const document = {
    title: page.title ?? '',
    body: { innerText: page.text ?? '' },
    querySelectorAll: (selector: string) =>
      selector === 'script[type="application/ld+json"]' ? page.ldJson.map((textContent) => ({ textContent })) : [],
    querySelector: (selector: string) =>
      selector === 'link[rel="canonical"]' && page.canonical ? { href: page.canonical } : null,
  };
  const location = { href: page.href ?? 'https://example.com/page' };
  let output: string | null = null;
  const run = new Function('document', 'location', 'completion', script) as (
    d: typeof document,
    l: typeof location,
    c: (v: string) => void,
  ) => void;
  run(document, location, (value) => {
    output = value;
  });
  if (output === null) throw new Error('completion が呼ばれませんでした');
  return output;
}

describe('ショートカットのスクリプト', () => {
  it.each([
    ['クックパッドの形', COOKPAD_LIKE, 7],
    ['クラシルの形(@graph)', KURASHIRU_LIKE, 6],
    ['デリッシュキッチンの形(配列・@type が配列)', DELISH_LIKE, 7],
  ])('%s から Recipe を取り出す', (_label, data, count) => {
    const output = runScript({
      ldJson: ['{壊れた JSON', JSON.stringify({ '@type': 'Organization' }), JSON.stringify(data)],
      canonical: 'https://example.com/recipe/1',
      href: 'https://example.com/recipe/1?from=share',
    });
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toMatchObject({ kondate: 1, kind: 'recipe', url: 'https://example.com/recipe/1' });
    expect(parsed.recipeIngredient).toHaveLength(count);
    // 作り方は入れない
    expect(output).not.toContain(STEP_TEXT);
    expect(Object.keys(parsed)).not.toContain('recipeInstructions');
    // アプリで読める
    expect(readPastedText(output).ok).toBe(true);
  });

  it('canonical がなければ、今の URL を使う', () => {
    const output = runScript({ ldJson: [JSON.stringify(COOKPAD_LIKE)], href: 'https://example.com/r/2' });
    expect(JSON.parse(output)).toMatchObject({ url: 'https://example.com/r/2' });
  });

  it('構造化データがなければ、材料の見出しから作り方の手前までと時間の行だけを入れる', () => {
    const output = runScript({ ldJson: [], title: 'テスト用 キャベツとツナのサラダ | テストサイト', text: PAGE_TEXT });
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toMatchObject({ kondate: 1, kind: 'text', title: 'テスト用 キャベツとツナのサラダ | テストサイト' });
    expect(parsed.text).toBe(
      ['調理時間:約10分', '材料(2人分)', 'キャベツ', '1/4個', 'ツナ缶', '1缶', '<ドレッシング>', 'マヨネーズ 大さじ2', '塩 少々', '買い物リストに入れる'].join('\n'),
    );
    // 作り方と、材料の前のサイトの案内は入れない
    expect(output).not.toContain(STEP_TEXT);
    expect(output).not.toContain('材料から探す');
    // アプリで材料・時間・人数を読める
    const read = readPastedText(output);
    if (!read.ok) throw new Error(read.error);
    expect(read.page).toMatchObject({ name: 'テスト用 キャベツとツナのサラダ', minutes: 10, servings: 2 });
    expect(read.page.ingredientLines).toEqual(['キャベツ 1/4個', 'ツナ缶 1缶', 'マヨネーズ 大さじ2', '塩 少々']);
  });

  it('「作り方」の見出しがなくても、長い行(作り方の文章)の手前で止める。時間・人数が別の行でも取り出す', () => {
    const output = runScript({ ldJson: [], title: 'テスト用 大根と油揚げの煮物', text: PAGE_TEXT_NO_STEPS_HEADING });
    expect(output).not.toContain(STEP_TEXT);
    expect(output).not.toContain(LONG_STEP_TEXT);
    expect(output).not.toContain('紹介文');
    const read = readPastedText(output);
    if (!read.ok) throw new Error(read.error);
    expect(read.page).toMatchObject({ minutes: 30, servings: 2 });
    expect(read.page.ingredientLines).toEqual(['大根 1/4本', '油揚げ 1枚', 'めんつゆ 大さじ2']);
  });

  it('材料の見出しがなければ、材料の行は入れない(作り方も入らない)', () => {
    const output = runScript({ ldJson: [], title: 'テスト', text: `お知らせ\n${STEP_TEXT}\n${LONG_STEP_TEXT}` });
    expect(output).not.toContain(STEP_TEXT);
    expect(output).not.toContain(LONG_STEP_TEXT);
    expect(readPastedText(output).ok).toBe(false);
  });

  it('材料・作り方の見出しの決まりが、アプリの設定と同じ', () => {
    expect(script).toContain(PAGE_INGREDIENTS_HEADING.source);
    expect(script).toContain(PAGE_STEPS_HEADING.source);
  });
});
