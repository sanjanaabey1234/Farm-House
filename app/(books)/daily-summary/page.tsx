'use client';

import { useState } from 'react';
import { useBooks } from '@/components/BooksProvider';
import { CsvButton, DataTable, exportTableCSV, type Column } from '@/components/DataTable';
import { sum } from '@/components/entry';
import { BooksPage, Card, PageHead } from '@/components/ui';
import { fmtDate, monthKey, monthLabel } from '@/lib/dates';
import { amt, kg } from '@/lib/format';
import { slug } from '@/lib/client/download';
import type { DailyRow } from '@/lib/calc';

export default function DailySummaryPage() {
  return (
    <BooksPage>
      <Inner />
    </BooksPage>
  );
}

function Inner() {
  const { books, business } = useBooks();
  const [month, setMonth] = useState('');
  if (!books || !business) return null;
  const rows = books.daily.filter((r) => !month || monthKey(r.date) === month);
  const n = (f: (r: DailyRow) => number, isKg = false): Pick<Column<DailyRow>, 'render' | 'csv' | 'total' | 'csvTotal' | 'num'> => ({
    num: true,
    render: (r) => (isKg ? kg(f(r)) : amt(f(r))),
    csv: (r) => f(r),
    total: isKg ? kg(sum(rows, f)) : amt(sum(rows, f)),
    csvTotal: sum(rows, f),
  });
  const columns: Column<DailyRow>[] = [
    { key: 'd', label: 'Date', render: (r) => fmtDate(r.date), csv: (r) => fmtDate(r.date) },
    { key: 'ks', label: 'Kg sold', ...n((r) => r.kgSold, true) },
    { key: 'g', label: 'Gross', ...n((r) => r.gross) },
    { key: 'di', label: 'Discounts', ...n((r) => r.discount) },
    { key: 'ne', label: 'Net sales', ...n((r) => r.net) },
    { key: 'rc', label: 'Received', ...n((r) => r.received) },
    { key: 'cr', label: 'Credit sales', ...n((r) => r.credit) },
    { key: 'kb', label: 'Kg bought', ...n((r) => r.kgBought, true) },
    { key: 'pu', label: 'Purchases', ...n((r) => r.purchases) },
    { key: 'ex', label: 'Expenses + wages', ...n((r) => r.expenses) },
    { key: 'kd', label: 'Kg sold − bought', ...n((r) => r.kgDiff, true) },
  ];
  return (
    <>
      <PageHead title="Daily summary" sub="Every day with sales, purchases, expenses or wages." />
      <Card
        title={`${rows.length} day${rows.length === 1 ? '' : 's'}`}
        actions={<CsvButton onClick={() => exportTableCSV(`${slug(business.name)}-daily-summary${month ? `-${month}` : ''}`, columns, rows, true)} />}
      >
        <div className="toolbar">
          <select aria-label="Filter by month" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All months</option>
            {books.months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.date} showTotal empty="No activity yet." />
      </Card>
    </>
  );
}
