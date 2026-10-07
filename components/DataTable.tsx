'use client';

import type { ReactNode } from 'react';
import { downloadCSV, type CsvValue } from '@/lib/client/download';

export interface Column<T> {
  key: string;
  label: string;
  num?: boolean;
  render: (row: T) => ReactNode;
  csv?: (row: T) => CsvValue;
  total?: ReactNode;
  csvTotal?: CsvValue;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  showTotal,
  totalLabel = 'Total',
  empty = 'Nothing to show yet.',
  onRowClick,
  selectedKey,
  actions,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  showTotal?: boolean;
  totalLabel?: string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  actions?: (row: T) => ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.num ? 'num' : undefined} scope="col">
                {c.label}
              </th>
            ))}
            {actions ? <th className="num" scope="col"><span className="hide-sm">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="empty">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => {
              const k = rowKey(r, i);
              return (
                <tr
                  key={k}
                  className={selectedKey === k ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.num ? 'num' : undefined}>
                      {c.render(r)}
                    </td>
                  ))}
                  {actions ? <td className="actions">{actions(r)}</td> : null}
                </tr>
              );
            })
          )}
          {showTotal && rows.length > 0 ? (
            <tr className="total">
              {columns.map((c, i) => (
                <td key={c.key} className={c.num ? 'num' : undefined}>
                  {i === 0 ? (c.total ?? totalLabel) : (c.total ?? '')}
                </td>
              ))}
              {actions ? <td /> : null}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** Exports exactly what the table shows (plus a totals row when shown). */
export function exportTableCSV<T>(filename: string, columns: Column<T>[], rows: T[], withTotal = false, totalLabel = 'Total') {
  const cols = columns.filter((c) => c.csv);
  const body = rows.map((r) => cols.map((c) => c.csv!(r)));
  if (withTotal && rows.length) body.push(cols.map((c, i) => (i === 0 ? (c.csvTotal ?? totalLabel) : (c.csvTotal ?? ''))));
  downloadCSV(filename, cols.map((c) => c.label), body);
}

export function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-sm" onClick={onClick}>
      Export CSV
    </button>
  );
}
