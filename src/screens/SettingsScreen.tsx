import { useFoods } from '../hooks/useFoods';
import { BackupSection } from './settings/BackupSection';
import { HouseholdSection } from './settings/HouseholdSection';
import { PantrySection } from './settings/PantrySection';

export function SettingsScreen() {
  const foodData = useFoods();
  if (!foodData) return <p className="muted">読み込み中…</p>;

  return (
    <>
      <div className="screen-header">
        <h1 className="screen-title">設定</h1>
      </div>
      <PantrySection foods={foodData.foods} />
      <HouseholdSection />
      <BackupSection />
    </>
  );
}
