// 読まない言葉を作る(純粋関数)
import type { IgnoredWord } from '../../db/types';
import { toDateTimeString } from '../date';
import { normalizeForSearch } from '../foodSearch';

/** 「食材ではない」を選んだ商品の言葉から、読まない言葉を作る。空なら null */
export function makeIgnoredWord(label: string, now: Date): IgnoredWord | null {
  const word = normalizeForSearch(label);
  if (word === '') return null;
  return { word, label: label.trim(), addedAt: toDateTimeString(now) };
}
