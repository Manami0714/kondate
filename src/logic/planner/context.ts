// 献立を組む前の下ごしらえ(純粋関数)
// 日ごとのメンバー・合計倍率・候補のレシピをまとめる
import type { Course, Member, Recipe } from '../../db/types';
import { totalPortion } from '../portion';
import { isCandidate } from './filter';
import type { DayInput, PlannerData, PlanRequest } from './types';

export interface PreparedDay extends DayInput {
  members: Member[];
  /** 「誰向け」で選んだ人。その日にいなければ null */
  forMember: Member | null;
  /** その日のメンバーの倍率の合計 */
  total: number;
  /** 必ず外す条件を通ったレシピ(区分ごと) */
  candidates: Record<Course, Recipe[]>;
}

export type PrepareResult = { ok: true; days: PreparedDay[] } | { ok: false; error: string };

export function prepareDays(request: PlanRequest, data: PlannerData): PrepareResult {
  const days: PreparedDay[] = [];
  for (const day of request.days) {
    const members = day.memberIds
      .map((id) => data.membersById.get(id))
      .filter((m): m is Member => m !== undefined);
    if (members.length === 0) return { ok: false, error: `${day.date} に食べるメンバーがいません。メンバーを登録してください` };

    const forMemberId = request.conditions.forMemberId;
    const forMember = members.find((m) => m.id === forMemberId) ?? null;
    const candidates: Record<Course, Recipe[]> = { 主菜: [], 副菜: [], 汁物: [] };
    for (const r of data.recipes) {
      if (isCandidate(r, members, request.conditions, data.feedbacks, data.foodsById)) candidates[r.course].push(r);
    }
    for (const course of ['主菜', '副菜', '汁物'] as const) {
      if (candidates[course].length === 0) {
        return {
          ok: false,
          error: `${day.date} の${course}に使えるレシピがありません。時間・難易度の条件を緩めるか、レシピを増やしてください`,
        };
      }
    }
    days.push({ ...day, members, forMember, total: totalPortion(members), candidates });
  }
  return { ok: true, days };
}
