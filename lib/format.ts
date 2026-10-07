// Display formats (requirements 7.8): Rs. with thousands separators, negatives in brackets, zero as "–".

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const two = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function bracket(n: number, f: Intl.NumberFormat): string {
  if (!isFinite(n)) return '–';
  const r = Math.round(n * 100) / 100;
  if (Math.abs(r) < 0.005) return '–';
  const s = f.format(Math.abs(r));
  if (s === '0' || s === '0.00') return '–';
  return r < 0 ? `(${s})` : s;
}

/** Amount without the Rs. prefix, e.g. "52,000" or "(527,000)". */
export function amt(n: number): string {
  return bracket(n, int);
}

/** Amount with the Rs. prefix, e.g. "Rs. 52,000". */
export function rs(n: number): string {
  const s = amt(n);
  return s === '–' ? 'Rs. –' : `Rs. ${s}`;
}

/** Rate (price per kg etc.) with 2 decimals. */
export function rate(n: number): string {
  return bracket(n, two);
}

/** Kilograms with 2 decimals. */
export function kg(n: number): string {
  return bracket(n, two);
}

export function pct(n: number): string {
  if (!isFinite(n)) return '–';
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

/** Round to 2 decimals for CSV / storage. */
export function r2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function num(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    return isFinite(n) ? n : 0;
  }
  return 0;
}
