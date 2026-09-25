import { useState } from 'react';
import { MemberScreen } from './screens/MemberScreen';
import { RecipeScreen } from './screens/RecipeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StockScreen } from './screens/StockScreen';

type Tab = 'stock' | 'recipes' | 'members' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stock', label: '在庫', icon: '🧊' },
  { id: 'recipes', label: 'レシピ', icon: '📖' },
  { id: 'members', label: 'メンバー', icon: '👪' },
  { id: 'settings', label: '設定', icon: '⚙️' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('stock');

  return (
    <div className="app">
      <main className="app-main">
        {tab === 'stock' && <StockScreen />}
        {tab === 'recipes' && <RecipeScreen />}
        {tab === 'members' && <MemberScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>
      <nav className="tabbar" aria-label="画面の切り替え">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tabbar-item${tab === t.id ? ' is-active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="tabbar-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
