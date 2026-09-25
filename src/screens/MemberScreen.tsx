import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import { db } from '../db/db';
import type { Member, MemberKind } from '../db/types';
import { useFoods } from '../hooks/useFoods';
import { MemberForm } from './MemberForm';

type Mode = { type: 'none' } | { type: 'edit'; member: Member | null };

export function MemberScreen() {
  const foodData = useFoods();
  const members = useLiveQuery(() => db.members.toArray(), []);
  const [mode, setMode] = useState<Mode>({ type: 'none' });

  if (!foodData || !members) return <p className="muted">読み込み中…</p>;

  const section = (kind: MemberKind) => {
    const list = members.filter((m) => m.kind === kind).sort((a, b) => b.age - a.age);
    return (
      <>
        <h2 className="section-title">{kind}</h2>
        {list.length === 0 ? (
          <div className="empty">{kind}はまだいません</div>
        ) : (
          <ul className="list">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" className="list-item" onClick={() => setMode({ type: 'edit', member: m })}>
                  <span className="list-main">
                    <span className="list-title">{m.name}</span>
                    <div className="list-sub">
                      {m.sex}・{m.age}歳・{m.appetite}
                      {m.portionOverride !== null && `・倍率${m.portionOverride}`}
                      {m.allergyFoodIds.length > 0 && `・アレルギー${m.allergyFoodIds.length}件`}
                    </div>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  return (
    <>
      <div className="screen-header">
        <h1 className="screen-title">メンバー</h1>
        <button type="button" className="btn btn-primary" onClick={() => setMode({ type: 'edit', member: null })}>
          ＋ 追加
        </button>
      </div>
      {section('家族')}
      {section('ゲスト')}

      {mode.type === 'edit' && (
        <Sheet title={mode.member ? mode.member.name : 'メンバーを追加'} onClose={() => setMode({ type: 'none' })}>
          <MemberForm
            member={mode.member}
            foods={foodData.foods}
            byId={foodData.byId}
            onDone={() => setMode({ type: 'none' })}
          />
        </Sheet>
      )}
    </>
  );
}
