// 選択ボタン。1つ選ぶもの(SingleChoice)と、複数選ぶもの(MultiChoice)

interface SingleProps<T extends string | number> {
  options: readonly T[];
  /** null ならまだ何も選んでいない */
  value: T | null;
  onChange: (value: T) => void;
  label?: (value: T) => string;
}

export function SingleChoice<T extends string | number>({ options, value, onChange, label }: SingleProps<T>) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          className={`chip${o === value ? ' is-on' : ''}`}
          onClick={() => onChange(o)}
        >
          {label ? label(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

interface MultiProps<T extends string> {
  options: readonly T[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  label?: (value: T) => string;
}

export function MultiChoice<T extends string>({ options, value, onChange, label }: MultiProps<T>) {
  const toggle = (o: T) => {
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  };
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value.includes(o)}
          className={`chip${value.includes(o) ? ' is-on' : ''}`}
          onClick={() => toggle(o)}
        >
          {label ? label(o) : o}
        </button>
      ))}
    </div>
  );
}
