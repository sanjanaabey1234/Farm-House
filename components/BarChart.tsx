'use client';

import { amt } from '@/lib/format';

export interface Series {
  label: string;
  color: string;
  values: number[];
}

/** Grouped bar chart that handles negative values (e.g. net loss). */
export function BarChart({ labels, series, height = 240 }: { labels: string[]; series: Series[]; height?: number }) {
  const all = series.flatMap((s) => s.values);
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const padL = 64;
  const padB = 26;
  const padT = 10;
  const groupW = Math.max(34, 12 + series.length * 14);
  const width = padL + labels.length * groupW + 10;
  const plotH = height - padB - padT;
  const y = (v: number) => padT + ((max - v) / span) * plotH;
  const ticks = niceTicks(min, max);
  const barW = Math.min(16, (groupW - 10) / series.length);

  return (
    <div>
      <div className="legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="chart">
        <svg width={Math.max(width, 300)} height={height} role="img" aria-label={series.map((s) => s.label).join(' and ') + ' by month'}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 3'} />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end">
                {amt(t) === '–' ? '0' : amt(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) => {
            const gx = padL + i * groupW + 5;
            return (
              <g key={l}>
                {series.map((s, j) => {
                  const v = s.values[i] ?? 0;
                  const top = y(Math.max(v, 0));
                  const h = Math.abs(y(v) - y(0));
                  return (
                    <rect key={s.label} x={gx + j * barW} y={top} width={barW - 2} height={Math.max(h, v ? 1 : 0)} fill={s.color} rx={2}>
                      <title>{`${l} · ${s.label}: Rs. ${amt(v)}`}</title>
                    </rect>
                  );
                })}
                <text x={gx + (series.length * barW) / 2} y={height - 8} textAnchor="middle">
                  {l}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function niceTicks(min: number, max: number): number[] {
  const span = max - min || 1;
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(Math.round(v * 100) / 100);
  if (!out.includes(0)) out.push(0);
  return out;
}
