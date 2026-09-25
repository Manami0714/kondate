// 読み込んだデータの形を確かめる小さな道具
// 形が違えば ValidationError を投げ、どこが違うかを日本語で伝える

export class ValidationError extends Error {}

export type Obj = Record<string, unknown>;

export function fail(path: string, expected: string): never {
  throw new ValidationError(`${path} が${expected}ではありません`);
}

export function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'オブジェクト');
  return value as Obj;
}

export function str(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string') fail(`${path}.${key}`, '文字');
  return v;
}

export function strOrNull(o: Obj, key: string, path: string): string | null {
  const v = o[key];
  if (v === null) return null;
  if (typeof v !== 'string') fail(`${path}.${key}`, '文字か null');
  return v;
}

export function num(o: Obj, key: string, path: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, '数字');
  return v;
}

export function numOrNull(o: Obj, key: string, path: string): number | null {
  const v = o[key];
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, '数字か null');
  return v;
}

export function bool(o: Obj, key: string, path: string): boolean {
  const v = o[key];
  if (typeof v !== 'boolean') fail(`${path}.${key}`, 'true/false');
  return v;
}

export function arr(o: Obj, key: string, path: string): unknown[] {
  const v = o[key];
  if (!Array.isArray(v)) fail(`${path}.${key}`, '配列');
  return v;
}

export function strArr(o: Obj, key: string, path: string): string[] {
  return arr(o, key, path).map((v, i) => {
    if (typeof v !== 'string') fail(`${path}.${key}[${i}]`, '文字');
    return v;
  });
}

/** 決まった値のどれかであることを確かめる */
export function oneOf<T extends string | number>(
  o: Obj,
  key: string,
  allowed: readonly T[],
  path: string,
): T {
  const v = o[key];
  if (!(allowed as readonly unknown[]).includes(v)) fail(`${path}.${key}`, `「${allowed.join('/')}」のどれか`);
  return v as T;
}

export function oneOfArr<T extends string>(o: Obj, key: string, allowed: readonly T[], path: string): T[] {
  return strArr(o, key, path).map((v, i) => {
    if (!(allowed as readonly string[]).includes(v)) fail(`${path}.${key}[${i}]`, `「${allowed.join('/')}」のどれか`);
    return v as T;
  });
}
