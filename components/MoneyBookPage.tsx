'use client';

import { useState } from 'react';
import { useBooks } from './BooksProvider';
import { CsvButton, DataTable, exportTableCSV, type Column } from './DataTable';
import { sum } from './entry';
import { BooksPage, Card, Notice, PageHead, Tile } from './ui';
import { fmtDate, monthKey, monthLabel } from '@/lib/dates';
import { amt, rs } from '@/lib/format';
import { slug } from '@/lib/client/download';
import type { MoneyBookEntry, MoneyBookRow } from '@/lib/calc';

const ENTRY_TYPES: MoneyBookEntry['type'][] = ['Sale', 'Customer payment', 'Purchase', 'Supplier payment', 'Wages', 'Expense'];

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
  const [view, setView] = useState<'daily' | 'invoice'>('daily');
  const [day, setDay] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  if (!books || !business) return null;
  const book = method === 'Cash' ? books.cash : books.bank;
  const rows = book.rows.filter((r) => !month || monthKey(r.date) === month);
  const needle = q.trim().toLowerCase();
  const entries = book.entries.filter(
    (e) =>
      (day ? e.date === day : !month || monthKey(e.date) === month) &&
      (!type || e.type === type) &&
      (!needle || `${e.ref} ${e.party} ${e.details} ${e.type}`.toLowerCase().includes(needle)),
  );
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
  const entryColumns: Column<MoneyBookEntry>[] = [
    { key: 'd', label: 'Date', render: (e) => fmtDate(e.date), csv: (e) => fmtDate(e.date) },
    { key: 'ty', label: 'Type', render: (e) => e.type, csv: (e) => e.type },
    { key: 'ref', label: 'Invoice / ref', render: (e) => e.ref || <span className="muted">–</span>, csv: (e) => e.ref },
    { key: 'pa', label: 'Customer / supplier / payee', render: (e) => e.party, csv: (e) => e.party },
    { key: 'de', label: 'Details', render: (e) => e.details, csv: (e) => e.details },
    { key: 'in', label: 'In', num: true, render: (e) => amt(e.in), csv: (e) => e.in, total: amt(sum(entries, (e) => e.in)), csvTotal: sum(entries, (e) => e.in) },
    { key: 'out', label: 'Out', num: true, render: (e) => amt(e.out), csv: (e) => e.out, total: amt(sum(entries, (e) => e.out)), csvTotal: sum(entries, (e) => e.out) },
    {
      key: 'bal',
      label: 'Balance after',
      num: true,
      render: (e) => <span className={e.balance < 0 ? 'neg-text' : undefined}>{amt(e.balance)}</span>,
      csv: (e) => e.balance,
    },
  ];
  const label = method === 'Cash' ? 'Cash book' : 'Bank book';
  const file = `${slug(business.name)}-${method.toLowerCase()}-book`;
  const viewButton = (v: typeof view, text: string) => (
    <button type="button" className={`btn btn-sm${view === v ? ' btn-primary' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>
      {text}
    </button>
  );
  const monthSelect = (
    <select
      aria-label="Filter by month"
      value={month}
      onChange={(e) => {
        setMonth(e.target.value);
        setDay('');
      }}
    >
      <option value="">All months</option>
      {books.months.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  );

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
      {view === 'daily' ? (
        <Card
          title="Daily movements"
          actions={
            <>
              {viewButton('daily', 'Daily totals')}
              {viewButton('invoice', 'By invoice')}
              <CsvButton onClick={() => exportTableCSV(`${file}${month ? `-${month}` : ''}`, columns, rows, true)} />
            </>
          }
        >
          <div className="toolbar">
            {monthSelect}
            <span className="small muted">Opening balance {rs(book.opening)} · click a day to see its invoices</span>
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.date}
            showTotal
            empty={`No ${method.toLowerCase()} movements yet.`}
            onRowClick={(r) => {
              setDay(r.date);
              setView('invoice');
            }}
          />
        </Card>
      ) : (
        <Card
          title={`Invoice-wise movements (${entries.length}${entries.length !== book.entries.length ? ` of ${book.entries.length}` : ''})`}
          actions={
            <>
              {viewButton('daily', 'Daily totals')}
              {viewButton('invoice', 'By invoice')}
              <CsvButton onClick={() => exportTableCSV(`${file}-invoices${day ? `-${day}` : month ? `-${month}` : ''}`, entryColumns, entries, true)} />
            </>
          }
        >
          <div className="toolbar">
            {monthSelect}
            <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {ENTRY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input type="search" placeholder="Invoice no., name or details…" aria-label="Search by invoice" value={q} onChange={(e) => setQ(e.target.value)} />
            {day ? (
              <button type="button" className="btn btn-sm" onClick={() => setDay('')}>
                {fmtDate(day)} ✕
              </button>
            ) : null}
          </div>
          <DataTable
            columns={entryColumns}
            rows={entries}
            rowKey={(e) => e.id}
            showTotal
            empty={book.entries.length ? 'No entries match the filter.' : `No ${method.toLowerCase()} movements yet.`}
          />
        </Card>
      )}
    </>
  );
}
