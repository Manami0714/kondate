// 確定前の献立の提案(下書き)の保存と削除
import type { KondateDB } from './db';
import type { PlanDraft } from './types';

export const DRAFT_ID = 'draft' as const;

export function saveDraft(db: KondateDB, draft: Omit<PlanDraft, 'id'>): Promise<unknown> {
  return db.planDrafts.put({ ...draft, id: DRAFT_ID });
}

export function deleteDraft(db: KondateDB): Promise<void> {
  return db.planDrafts.delete(DRAFT_ID);
}

/** 下書き。なければ null(読み込み中の undefined と区別するため) */
export async function loadDraft(db: KondateDB): Promise<PlanDraft | null> {
  return (await db.planDrafts.get(DRAFT_ID)) ?? null;
}
