// ID を作る関数。テストでは差し替えて結果を固定する
export type IdGenerator = () => string;

export const randomId: IdGenerator = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // randomUUID が使えない環境(http で開いたときなど)の予備
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** テスト用:id-1, id-2, … を順に返す */
export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
