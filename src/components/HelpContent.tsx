import type { ScreenHelp } from '../data/help';

/** 1画面分の説明:ひとこと説明と、できること(箇条書き) */
export function HelpContent({ help }: { help: ScreenHelp }) {
  return (
    <div className="help-content">
      <p style={{ margin: 0 }}>{help.summary}</p>
      <ul className="help-points">
        {help.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
