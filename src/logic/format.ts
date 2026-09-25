// 画面に出す文字の整形(純粋関数)

const FRACTIONS: [number, string][] = [
  [0.25, '1/4'],
  [0.5, '1/2'],
  [0.75, '3/4'],
  [1 / 3, '1/3'],
  [2 / 3, '2/3'],
];

/** 小数を分数で見せない単位(量が大きく、小数で十分なもの) */
const DECIMAL_UNITS = new Set(['g', 'ml']);

/** 量の表示。「0.25個」→「1/4個」、「1.5本」→「1と1/2本」 */
export function formatAmount(amount: number, unit: string): string {
  if (!DECIMAL_UNITS.has(unit)) {
    const whole = Math.floor(amount);
    const rest = amount - whole;
    const frac = FRACTIONS.find(([v]) => Math.abs(v - rest) < 0.001);
    if (frac) return `${whole > 0 ? `${whole}と` : ''}${frac[1]}${unit}`;
  }
  return `${Math.round(amount * 100) / 100}${unit}`;
}

/** 入力欄に入れる文字。分数で見せられるものは分数にする */
export function amountToInput(amount: number): string {
  const whole = Math.floor(amount);
  const frac = FRACTIONS.find(([v]) => Math.abs(v - (amount - whole)) < 0.001);
  if (frac) return whole > 0 ? `${whole} ${frac[1]}` : frac[1];
  return String(Math.round(amount * 1000) / 1000);
}

export const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'かんたん',
  2: 'ふつう',
  3: 'むずかしい',
};
