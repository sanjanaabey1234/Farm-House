'use client';

import { useState } from 'react';
import { useBooks } from './BooksProvider';
import { CsvButton, DataTable, exportTableCSV, type Column } from './DataTable';
import { sum } from './entry';
import { BooksPage, Card, Notice, PageHead, Tile } from './ui';
import { fmtDate, monthKey, monthLabel } from '@/lib/dates';
import { amt, rs } from '@/lib/format';
import { slug } from '@/lib/client/download';
import type { MoneyBookRow } from '@/lib/calc';

/** Cash book and bank book (requirements 4.7, 7.4). */
export function MoneyBookPage({ method }: { method: 'Cash' | 'Bank' }) {
  return (
    <BooksPage>
      <Inner method={method} />
    </BooksPage>
  );
}

function Inner({ method }: { method: 'Cash' | 'Bank' }) {
  const { books, business } = useBooks();
  const [month, setMonth] = useState('');
  if (!books || !business) return null;
  const book = method === 'Cash' ? books.cash : books.bank;
  const rows = book.rows.filter((r) => !month || monthKey(r.date) === month);
  const negDays = book.rows.filter((r) => r.balance < 0);
  const n = (label: string, key: string, f: (r: MoneyBookRow) => number, total = true): Column<MoneyBookRow> => ({
    key,
    label,
    num: true,
    render: (r) => amt(f(r)),
    csv: (r) => f(r),
    total: total ? amt(sum(rows, f)) : undefined,
    csvTotal: total ? sum(rows, f) : undefined,
  });
  const columns: Column<MoneyBookRow>[] = [
    { key: 'd', label: 'Date', render: (r) => fmtDate(r.date), csv: (r) => fmtDate(r.date) },
    n('Sales received', 'si', (r) => r.salesIn),
    n('Customer payments', 'cp', (r) => r.customerPayments),
    n('Total in', 'ti', (r) => r.totalIn),
    n('Purchases paid', 'pp', (r) => r.purchasesPaid),
    n('Supplier payments', 'sp', (r) => r.supplierPayments),
    n('Wages', 'wa', (r) => r.wages),
    n('Expenses', 'ex', (r) => r.expenses),
    n('Total out', 'to', (r) => r.totalOut),
    {
      key: 'bal',
      label: 'Balance',
      num: true,
      render: (r) => <span className={r.balance < 0 ? 'neg-text' : undefined}>{amt(r.balance)}</span>,
      csv: (r) => r.balance,
    },
  ];
  const label = method === 'Cash' ? 'Cash book' : 'Bank book';

  return (
    <>
      <PageHead title={label} sub={`Money in and out by ${method.toLowerCase()}. Balance = previous balance + in − out.`} />
      {negDays.length ? (
        <Notice tone="warn">
          The {method.toLowerCase()} balance goes below zero on {negDays.length} day{negDays.length === 1 ? '' : 's'} (first on {fmtDate(negDays[0].date)}). Check for missing
          {method === 'Cash' ? ' cash receipts or the opening cash' : ' deposits or the opening bank balance'}.
        </Notice>
      ) : null}
      <div className="tiles">
        <Tile label="Opening" value={rs(book.opening)} />
        <Tile label="Total in" value={rs(book.totalIn)} />
        <Tile label="Total out" value={rs(book.totalOut)} />
        <Tile label="Closing" value={rs(book.closing)} negative={book.closing < 0} />
      </div>
      <Card
        title="Daily movements"
        actions={<CsvButton onClick={() => exportTableCSV(`${slug(business.name)}-${method.toLowerCase()}-book${month ? `-${month}` : ''}`, columns, rows, true)} />}
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
          <span className="small muted">Opening balance {rs(book.opening)}</span>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.date} showTotal empty={`No ${method.toLowerCase()} movements yet.`} />
      </Card>
    </>
  );
}
