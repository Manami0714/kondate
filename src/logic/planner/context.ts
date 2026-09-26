// 献立を組む前の下ごしらえ(純粋関数)
// 日ごとのメンバー・合計倍率・候補のレシピ・指定した料理をまとめる
import type { Course, Member, Recipe } from '../../db/types';
import { totalPortion } from '../portion';
import { isCandidate } from './filter';
import { fixedRecipeId } from './fixed';
import type { DayInput, PlannerData, PlanRequest } from './types';

export interface PreparedDay extends DayInput {
  members: Member[];
  /** 「誰向け」で選んだ人。その日にいなければ null */
  forMember: Member | null;
  /** その日のメンバーの倍率の合計 */
  total: number;
  /** 必ず外す条件を通ったレシピ(区分ごと) */
  candidates: Record<Course, Recipe[]>;
  /** 指定した料理(区分ごと)。指定した料理は必ず外す条件を見ない */
  fixed: Partial<Record<Course, Recipe>>;
}

export type PrepareResult = { ok: true; days: PreparedDay[] } | { ok: false; error: string };

const COURSES = ['主菜', '副菜', '汁物'] as const;

export function prepareDays(request: PlanRequest, data: PlannerData): PrepareResult {
  const recipesById = new Map(data.recipes.map((r) => [r.id, r]));
  const days: PreparedDay[] = [];
  for (const [dayIndex, day] of request.days.entries()) {
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

    const fixed: Partial<Record<Course, Recipe>> = {};
    for (const course of COURSES) {
      const fixedId = fixedRecipeId(request.fixed ?? [], dayIndex, course);
      if (fixedId !== null) {
        const recipe = recipesById.get(fixedId);
        // 指定のあとでレシピが消されたり、区分が変えられたりしたとき
        if (!recipe || recipe.course !== course) {
          return { ok: false, error: `${day.date} の${course}に指定した料理が見つかりません。指定を外してください` };
        }
        fixed[course] = recipe;
      } else if (candidates[course].length === 0) {
        // 指定した枠は候補を使わないので、指定のない枠だけ候補が要る
        return {
          ok: false,
          error: `${day.date} の${course}に使えるレシピがありません。時間・難易度の条件を緩めるか、レシピを増やしてください`,
        };
      }
    }
    days.push({ ...day, members, forMember, total: totalPortion(members), candidates, fixed });
  }
  return { ok: true, days };
}
