'use client';

import { useState } from 'react';
import { useBooks } from '@/components/BooksProvider';
import { BarChart } from '@/components/BarChart';
import { CsvButton, DataTable, exportTableCSV, type Column } from '@/components/DataTable';
import { sum } from '@/components/entry';
import { BooksPage, Card, PageHead, Tile } from '@/components/ui';
import { monthLabel, shortMonthLabel } from '@/lib/dates';
import { amt, kg, rate, rs } from '@/lib/format';
import { slug } from '@/lib/client/download';
import type { CustomerMonthRow, GridRow } from '@/lib/calc';

export default function CustomerMonthlyPage() {
  return (
    <BooksPage>
      <Inner />
    </BooksPage>
  );
}

function Inner() {
  const { books, business } = useBooks();
  const [picked, setPicked] = useState('');
  if (!books || !business) return null;
  const names = books.customerNames;
  const name = names.includes(picked) ? picked : (names[0] ?? '');
  const cm = name ? books.customerMonthly(name) : null;

  const n = (label: string, key: string, f: (r: CustomerMonthRow) => number, fmt: (x: number) => string, total?: number): Column<CustomerMonthRow> => ({
    key,
    label,
    num: true,
    render: (r) => fmt(f(r)),
    csv: (r) => f(r),
    total: total === undefined ? undefined : fmt(total),
    csvTotal: total,
  });
  const rows = cm?.rows ?? [];
  const t = cm?.totals;
  const columns: Column<CustomerMonthRow>[] = [
    { key: 'm', label: 'Month', render: (r) => monthLabel(r.month), csv: (r) => monthLabel(r.month) },
    n('Sales lines', 'l', (r) => r.lines, (x) => (x ? String(x) : '–'), t?.lines),
    n('Kg bought', 'k', (r) => r.kg, kg, t?.kg),
    n('Gross sales', 'g', (r) => r.gross, amt, t?.gross),
    n('Discounts', 'd', (r) => r.discount, amt, t?.discount),
    n('Net sales', 'n', (r) => r.net, amt, t?.net),
    n('Avg price/kg', 'a', (r) => r.avgPrice, rate, t?.avgPrice),
    n('Paid at sale', 'p', (r) => r.paidAtSale, amt, t?.paidAtSale),
    n('Credit sales', 'c', (r) => r.credit, amt, t?.credit),
    n('Payments received', 'r', (r) => r.payments, amt, t?.payments),
    n('Balance due month-end', 'b', (r) => r.balance, amt, cm?.balanceNow),
  ];

  const grid = books.customerGrid;
  const gridCols: Column<GridRow>[] = [
    {
      key: 'n',
      label: 'Customer',
      render: (r) => (
        <button type="button" className="btn-link" onClick={() => setPicked(r.name)}>
          {r.name}
        </button>
      ),
      csv: (r) => r.name,
    },
    ...books.months.map(
      (m, i): Column<GridRow> => ({
        key: m,
        label: shortMonthLabel(m),
        num: true,
        render: (r) => amt(r.byMonth[i]),
        csv: (r) => r.byMonth[i],
        total: amt(sum(grid, (r) => r.byMonth[i])),
        csvTotal: sum(grid, (r) => r.byMonth[i]),
      }),
    ),
    { key: 'kg', label: 'Total kg', num: true, render: (r) => kg(r.kg), csv: (r) => r.kg, total: kg(sum(grid, (r) => r.kg)), csvTotal: sum(grid, (r) => r.kg) },
    { key: 'net', label: 'Total net sales', num: true, render: (r) => amt(r.net), csv: (r) => r.net, total: amt(sum(grid, (r) => r.net)), csvTotal: sum(grid, (r) => r.net) },
    { key: 'bal', label: 'Balance due', num: true, render: (r) => amt(r.balance), csv: (r) => r.balance, total: amt(sum(grid, (r) => r.balance)), csvTotal: sum(grid, (r) => r.balance) },
  ];

  return (
    <>
      <PageHead title="Customer monthly" sub="Month-by-month sales, payments and balance for one customer, plus every customer by month.">
        <select aria-label="Customer" value={name} onChange={(e) => setPicked(e.target.value)} disabled={!names.length}>
          {names.length ? null : <option value="">No customers yet</option>}
          {names.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </PageHead>

      {cm && t ? (
        <>
          <div className="tiles">
            <Tile label="Net sales" value={rs(t.net)} />
            <Tile label="Kg bought" value={kg(t.kg)} sub={`${t.lines} sales line${t.lines === 1 ? '' : 's'}`} />
            <Tile label="Average price/kg" value={`Rs. ${rate(t.avgPrice)}`} />
            <Tile label="Opening balance" value={rs(cm.opening)} />
            <Tile label="Balance due now" value={rs(cm.balanceNow)} />
          </div>
          <Card
            title={`${name} by month`}
            actions={<CsvButton onClick={() => exportTableCSV(`${slug(business.name)}-${slug(name)}-monthly`, columns, rows, true)} />}
          >
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.month} showTotal />
          </Card>
          <Card title={`Net sales by month — ${name}`}>
            <BarChart labels={books.months.map(shortMonthLabel)} series={[{ label: 'Net sales', color: 'var(--chart-1)', values: rows.map((r) => r.net) }]} height={200} />
          </Card>
        </>
      ) : null}

      <Card
        title="All customers — net sales by month"
        actions={<CsvButton onClick={() => exportTableCSV(`${slug(business.name)}-all-customers-by-month`, gridCols, grid, true)} />}
      >
        <p className="small muted mt0">Click a name to select that customer.</p>
        <DataTable columns={gridCols} rows={grid} rowKey={(r) => r.name} showTotal selectedKey={name} empty="No customers yet." />
      </Card>
    </>
  );
}
