// 貼り付けた文字を読む(純粋関数)
// ショートカットがコピーした JSON、構造化データそのもの(JSON-LD)、ただのページの文字の3通りに対応する
import { SHORTCUT_MARK } from '../../config/recipeImport';
import { cleanText } from '../textInput/normalize';
import { recipeMinutes } from './duration';
import { parsePageText } from './pageText';
import { parseServings } from './servings';
import type { ImportedPage } from './types';

export type ReadResult = { ok: true; page: ImportedPage } | { ok: false; error: string };

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter((s): s is string => s !== null);
  const one = str(v);
  return one === null ? [] : [one];
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** HTML の文字参照(&amp; など)を戻す */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code.startsWith('#')) {
      const n = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? all;
  });
}

function isRecipe(node: JsonObject): boolean {
  const type = node['@type'];
  return Array.isArray(type) ? type.includes('Recipe') : type === 'Recipe';
}

/** 配列・@graph・mainEntity の中までたどって Recipe を探す(ショートカットのスクリプトと同じ探し方) */
export function findRecipeNode(node: unknown, depth = 0): JsonObject | null {
  if (depth > 10) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(node)) return null;
  if (isRecipe(node)) return node;
  if (node['@graph'] !== undefined) return findRecipeNode(node['@graph'], depth + 1);
  if (node.mainEntity !== undefined) return findRecipeNode(node.mainEntity, depth + 1);
  return null;
}

/** 構造化データの項目から読む(作り方の項目は読まない) */
function fromRecipeFields(fields: JsonObject, url: string | null): ImportedPage {
  return {
    from: '構造化データ',
    url,
    name: cleanText(decodeEntities(str(fields.name) ?? '')),
    ingredientLines: strList(fields.recipeIngredient)
      .map((l) => cleanText(decodeEntities(l)))
      .filter((l) => l !== ''),
    minutes: recipeMinutes({ totalTime: str(fields.totalTime), cookTime: str(fields.cookTime), prepTime: str(fields.prepTime) }),
    servings: parseServings(strList(fields.recipeYield)),
  };
}

function tryJson(text: string): unknown {
  if (!/^[[{]/.test(text)) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** 文字の中の最初の URL */
function firstUrl(text: string): string | null {
  return /https?:\/\/[^\s"'<>]+/.exec(text)?.[0] ?? null;
}

/** 貼り付けた文字を読む */
export function readPastedText(text: string): ReadResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: '貼り付けた文字がありません' };
  const json = tryJson(trimmed);
  let page: ImportedPage;
  if (isObject(json) && json.kondate === SHORTCUT_MARK) {
    const url = str(json.url);
    if (json.kind === 'recipe') page = fromRecipeFields(json, url);
    else if (json.kind === 'text') page = parsePageText({ title: str(json.title), text: str(json.text) ?? '', url });
    else return { ok: false, error: `ショートカットでページを読めませんでした(${str(json.message) ?? '理由がわかりません'})` };
  } else if (json !== undefined) {
    const recipe = findRecipeNode(json);
    if (!recipe) return { ok: false, error: 'レシピの情報が見つかりませんでした' };
    page = fromRecipeFields(recipe, str(recipe.url));
  } else {
    page = parsePageText({ title: null, text: trimmed, url: firstUrl(trimmed) });
  }
  if (page.ingredientLines.length === 0) {
    return {
      ok: false,
      error: '材料を読み取れませんでした。レシピのページを開いて、ショートカットでコピーしてから貼り付けてください',
    };
  }
  return { ok: true, page };
}
