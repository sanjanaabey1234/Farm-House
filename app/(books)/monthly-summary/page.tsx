'use client';

import { useBooks } from '@/components/BooksProvider';
import { CsvButton, DataTable, exportTableCSV, type Column } from '@/components/DataTable';
import { BooksPage, Card, Notice, PageHead, Tile } from '@/components/ui';
import { monthLabel } from '@/lib/dates';
import { amt, kg, rate, rs } from '@/lib/format';
import { slug } from '@/lib/client/download';
import type { MonthlyRow } from '@/lib/calc';

export default function MonthlySummaryPage() {
  return (
    <BooksPage>
      <Inner />
    </BooksPage>
  );
}

function Inner() {
  const { books, business } = useBooks();
  if (!books || !business) return null;
  const t = books.monthlyTotals;
  type Key = Exclude<keyof MonthlyRow, 'month' | 'avgCostFromPeriod'>;
  const n = (label: string, key: Key, fmt: (x: number) => string, totalLabel?: string): Column<MonthlyRow> => ({
    key,
    label,
    num: true,
    render: (r) => <span className={r[key] < 0 ? 'neg-text' : undefined}>{fmt(r[key])}</span>,
    csv: (r) => r[key],
    total: totalLabel ?? fmt(t[key]),
    csvTotal: t[key],
  });
  const columns: Column<MonthlyRow>[] = [
    { key: 'm', label: 'Month', render: (r) => monthLabel(r.month), csv: (r) => monthLabel(r.month), total: 'Total / closing', csvTotal: 'Total / closing' },
    n('Kg purchased', 'kgBought', kg),
    n('Kg sold', 'kgSold', kg),
    n('Net sales', 'netSales', amt),
    n('Purchases', 'purchases', amt),
    {
      key: 'avg',
      label: 'Avg cost/kg',
      num: true,
      render: (r) => (
        <span title={r.avgCostFromPeriod ? 'Nothing bought this month: period average used' : undefined}>
          {rate(r.avgCost)}
          {r.avgCostFromPeriod && r.kgSold ? '*' : ''}
        </span>
      ),
      csv: (r) => r.avgCost,
      total: rate(t.avgCost),
      csvTotal: t.avgCost,
    },
    n('Cost of chicken sold', 'cogs', amt),
    n('Gross profit', 'grossProfit', amt),
    n('Expenses + wages', 'expenses', amt),
    n('Net profit', 'netProfit', amt),
    n('Cash (month-end)', 'cash', amt),
    n('Bank (month-end)', 'bank', amt),
    n('Debtors (month-end)', 'debtors', amt),
    n('Creditors (month-end)', 'creditors', amt),
  ];

  return (
    <>
      <PageHead title="Monthly summary" sub="Monthly gross and net profit with month-end balances." />
      <div className="tiles">
        <Tile label="Net sales" value={rs(t.netSales)} />
        <Tile label="Gross profit" value={rs(t.grossProfit)} negative={t.grossProfit < 0} />
        <Tile label="Net profit" value={rs(t.netProfit)} negative={t.netProfit < 0} />
        <Tile label="Period average cost/kg" value={`Rs. ${rate(books.periodAvgCost)}`} />
      </div>
      <Card title="By month" actions={<CsvButton onClick={() => exportTableCSV(`${slug(business.name)}-monthly-summary`, columns, books.monthly, true)} />}>
        <DataTable columns={columns} rows={books.monthly} rowKey={(r) => r.month} showTotal />
      </Card>
      <Notice>
        <b>Cost method.</b> Cost of chicken sold = kg sold × average cost per kg. The average cost is the month&apos;s total purchase cost (including other cost) ÷ kg purchased.
        If nothing was bought in a month, the period average (Rs. {rate(books.periodAvgCost)}) is used — marked *. This average cost method is a management estimate; confirm the final
        cost-of-sales treatment against the client&apos;s accounting method.
      </Notice>
    </>
  );
}
