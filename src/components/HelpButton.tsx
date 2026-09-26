import { useState } from 'react';
import { SCREEN_HELP, type HelpScreen } from '../data/help';
import { HelpContent } from './HelpContent';
import { Sheet } from './Sheet';

/** 見出しの横の「?」ボタン。押すとその画面の簡単な説明が出る */
export function HelpButton({ screen }: { screen: HelpScreen }) {
  const [open, setOpen] = useState(false);
  const help = SCREEN_HELP[screen];
  return (
    <>
      <button type="button" className="btn btn-help" aria-label={`${help.title}の使い方`} onClick={() => setOpen(true)}>
        ?
      </button>
      {open && (
        <Sheet title={`${help.title}の使い方`} onClose={() => setOpen(false)}>
          <HelpContent help={help} />
        </Sheet>
      )}
    </>
  );
}
