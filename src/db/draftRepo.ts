// 確定前の献立の提案(下書き)の保存と削除
// 3日分用(id: 'draft')と作り直し用(id: 'rebuild')を、同じ表に1件ずつ持つ
import type { KondateDB } from './db';
import type { PlanDraft, RebuildDraft } from './types';

export const DRAFT_ID = 'draft' as const;
export const REBUILD_DRAFT_ID = 'rebuild' as const;

export function saveDraft(db: KondateDB, draft: Omit<PlanDraft, 'id'>): Promise<unknown> {
  return db.planDrafts.put({ ...draft, id: DRAFT_ID });
}

export function deleteDraft(db: KondateDB): Promise<void> {
  return db.planDrafts.delete(DRAFT_ID);
}

/** 3日分用の下書き。なければ null(読み込み中の undefined と区別するため) */
export async function loadDraft(db: KondateDB): Promise<PlanDraft | null> {
  const draft = await db.planDrafts.get(DRAFT_ID);
  return draft && draft.id === DRAFT_ID ? draft : null;
}

export function saveRebuildDraft(db: KondateDB, draft: Omit<RebuildDraft, 'id'>): Promise<unknown> {
  return db.planDrafts.put({ ...draft, id: REBUILD_DRAFT_ID });
}

export function deleteRebuildDraft(db: KondateDB): Promise<void> {
  return db.planDrafts.delete(REBUILD_DRAFT_ID);
}

/** 作り直し用の下書き。なければ null */
export async function loadRebuildDraft(db: KondateDB): Promise<RebuildDraft | null> {
  const draft = await db.planDrafts.get(REBUILD_DRAFT_ID);
  return draft && draft.id === REBUILD_DRAFT_ID ? draft : null;
}
