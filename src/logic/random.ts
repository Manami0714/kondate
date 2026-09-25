// 乱数。献立のランダム性は引数で受け取り、テストでは種(seed)を決めて結果を固定する
import type { Rng } from './planner/types';

/** 画面で使うふつうの乱数 */
export const defaultRng: Rng = () => Math.random();

/** 種から毎回同じ並びの乱数を作る(mulberry32 という簡単な方式) */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
