import { useFoods } from '../hooks/useFoods';
import { BackupSection } from './settings/BackupSection';
import { FeedbackSection } from './settings/FeedbackSection';
import { IgnoredWordsSection } from './settings/IgnoredWordsSection';
import { FoodDictionarySection } from './settings/FoodDictionarySection';
import { HouseholdSection } from './settings/HouseholdSection';
import { PantrySection } from './settings/PantrySection';
import { HelpButton } from '../components/HelpButton';
import { UsageSection } from './settings/UsageSection';

export function SettingsScreen() {
  const foodData = useFoods();
  if (!foodData) return <p className="muted">読み込み中…</p>;

  return (
    <>
      <div className="screen-header">
        <div className="screen-title-row">
          <h1 className="screen-title">設定</h1>
          <HelpButton screen="settings" />
        </div>
      </div>
      <UsageSection />
      <PantrySection foods={foodData.foods} />
      <FoodDictionarySection foods={foodData.foods} />
      <HouseholdSection />
      <FeedbackSection byId={foodData.byId} />
      <IgnoredWordsSection />
      <BackupSection />
    </>
  );
}
