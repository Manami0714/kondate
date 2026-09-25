import type { ReactNode } from 'react';

interface Props {
  label: string;
  hint?: string;
  children: ReactNode;
}

/** 入力欄と見出しのまとまり */
export function Field({ label, hint, children }: Props) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="errors" role="alert">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
