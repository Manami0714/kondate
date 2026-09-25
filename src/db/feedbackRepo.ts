// 評価(口頭フィードバックの結果)の保存と削除
import type { KondateDB } from './db';
import type { Feedback, FeedbackKind } from './types';
import { toDateTimeString } from '../logic/date';
import type { FeedbackTarget } from '../logic/feedback/target';
import { randomId, type IdGenerator } from '../logic/id';

/** 確認画面で選んだ評価をまとめて保存する。元の発言は全部に同じものを入れる */
export async function saveFeedbacksInDb(
  db: KondateDB,
  entries: readonly (FeedbackTarget & { kind: FeedbackKind })[],
  originalText: string,
  now: Date,
  newId: IdGenerator = randomId,
): Promise<void> {
  const at = toDateTimeString(now);
  const rows: Feedback[] = entries.map((e) => ({
    id: newId(),
    at,
    targetType: e.targetType,
    targetValue: e.targetValue,
    kind: e.kind,
    originalText: originalText.trim(),
  }));
  await db.feedbacks.bulkAdd(rows);
}

export async function deleteFeedbackInDb(db: KondateDB, id: string): Promise<void> {
  await db.feedbacks.delete(id);
}
