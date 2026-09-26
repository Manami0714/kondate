import type { ReactNode } from 'react';
import type { MealStatus } from '../../db/types';
import { formatDayLabel } from '../../logic/date';
import { DIFFICULTY_LABELS } from '../../logic/format';
import { formatDayTotal } from '../../logic/portion';
import { DAY_ALLERGY_NOTE, UNCERTAIN_FOOD_NOTE } from '../../logic/planner/allergyNotes';
import { ALWAYS_YELLOW_SOURCE } from '../../logic/planner/balance';
import type { DaySummary, DishDetail } from '../../logic/planner/summary';

interface Props {
  day: DaySummary;
  status?: MealStatus;
  /** 見出しの右に出すもの(買い足しの品数など) */
  headExtra?: ReactNode;
  onOpenDish: (dish: DishDetail) => void;
  /** 料理ごとのボタン(入れ替えなど) */
  dishAction?: (dish: DishDetail, index: number) => ReactNode;
  /** 指定した料理か(「指定」の印をつける) */
  isFixed?: (dish: DishDetail, index: number) => boolean;
  /** アレルギー・食後の嫌いのほかに出す、料理ごとの注意(指定した料理の時間・主な材料のかぶりなど) */
  dishNotes?: (dish: DishDetail, index: number) => string[];
  children?: ReactNode;
}

/** 1日分の献立:日付・メンバー・注意書き・3品・栄養バランス */
export function DayCard({ day, status, headExtra, onOpenDish, dishAction, isFixed, dishNotes, children }: Props) {
  const { groups } = day.balance;
  return (
    <section className="day-card" data-status={status}>
      <div className="day-head">
        <span className="day-title">
          {formatDayLabel(day.date)}
          {status && status !== '予定' && (
            <span className="tag" style={{ marginLeft: 8 }}>
              {status}
            </span>
          )}
        </span>
        {headExtra}
      </div>
      <div className="muted">{formatDayTotal(day.members)}</div>
      {day.allergyNote && <div className="note note-warn">{DAY_ALLERGY_NOTE}</div>}

      {day.dishes.map((dish, i) => (
        <div key={dish.recipe.id + i}>
          <div className="dish-row">
            <span className="dish-course">{dish.recipe.course}</span>
            <button type="button" className="dish-name" onClick={() => onOpenDish(dish)}>
              {dish.recipe.name}
              {isFixed?.(dish, i) && (
                <span className="tag" style={{ marginLeft: 6 }}>
                  指定
                </span>
              )}
              <div className="list-sub">
                {dish.recipe.minutes}分・{DIFFICULTY_LABELS[dish.recipe.difficulty]}
              </div>
            </button>
            {dishAction && <div className="dish-actions">{dishAction(dish, i)}</div>}
          </div>
          {/* アレルギー・食後の嫌いは、確定したあとも出し続ける */}
          {[...dish.safetyWarnings, ...(dishNotes?.(dish, i) ?? [])].map((text) => (
            <div key={text} className="note note-warn">
              {text}
            </div>
          ))}
          {dish.uncertainFoods.length > 0 && (
            <div className="note note-warn">
              {UNCERTAIN_FOOD_NOTE}({dish.uncertainFoods.join('、')})
            </div>
          )}
        </div>
      ))}

      <div className="balance" aria-label="栄養バランス">
        <span>
          <span className="group-dot" data-group={groups.has('赤') ? '赤' : ''} aria-hidden="true" />赤{groups.has('赤') ? '○' : '×'}
        </span>
        <span>
          <span className="group-dot" data-group={groups.has('緑') ? '緑' : ''} aria-hidden="true" />緑{groups.has('緑') ? '○' : '×'}
        </span>
        <span>
          <span className="group-dot" data-group="黄" aria-hidden="true" />黄○({ALWAYS_YELLOW_SOURCE})
        </span>
      </div>
      {children}
    </section>
  );
}
