'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBooks } from '@/components/BooksProvider';
import { BarChart } from '@/components/BarChart';
import { DataTable } from '@/components/DataTable';
import { BooksPage, Card, PageHead, Tile } from '@/components/ui';
import { dashboardFigures } from '@/lib/calc';
import { fmtDate, monthLabel, shortMonthLabel, todayISO } from '@/lib/dates';
import { amt, kg, pct, rs } from '@/lib/format';
import type { Sale } from '@/lib/types';

export default function DashboardPage() {
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
  const today = todayISO();
  const d = dashboardFigures(books, month || null, today);
  const balances = [...books.debtors].filter((x) => Math.abs(x.balance) > 0.5).sort((a, b) => b.balance - a.balance).slice(0, 6);
  const latest = [...books.data.sale].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <>
      <PageHead title={business.name} sub={`Dashboard · period ${fmtDate(business.periodStart)} – ${fmtDate(business.periodEnd)}`}>
        <select aria-label="Show period or month" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Whole period</option>
          {books.months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </PageHead>

      <div className="tiles">
        <Tile label="Net sales" value={rs(d.netSales)} sub={`${kg(d.kgSold)} kg sold`} />
        <Tile label="Gross profit" value={rs(d.grossProfit)} negative={d.grossProfit < 0} />
        <Tile label="Expenses + wages" value={rs(d.expenses)} />
        <Tile label="Net profit" value={rs(d.netProfit)} negative={d.netProfit < 0} sub={`${pct(d.netMarginPct)} of sales`} />
        <Tile label="Chicken bought" value={`${kg(d.kgBought)} kg`} sub={rs(d.purchases)} />
        <Tile label={month ? 'Cash (month-end)' : 'Cash'} value={rs(d.cash)} negative={d.cash < 0} />
        <Tile label={month ? 'Bank (month-end)' : 'Bank'} value={rs(d.bank)} negative={d.bank < 0} />
        <Tile label="Customers owe" value={rs(d.customersOwe)} />
        <Tile label="Owed to suppliers" value={rs(d.owedToSuppliers)} />
        <Tile label="Today's sales" value={rs(d.todaySales)} sub={`${kg(d.todayKg)} kg · ${fmtDate(today)}`} />
      </div>

      <Card title="Net sales and net profit by month">
        <BarChart
          labels={books.months.map(shortMonthLabel)}
          series={[
            { label: 'Net sales', color: 'var(--chart-1)', values: books.monthly.map((m) => m.netSales) },
            { label: 'Net profit', color: 'var(--chart-2)', values: books.monthly.map((m) => m.netProfit) },
          ]}
        />
      </Card>

      <div className="grid-2">
        <Card title="Biggest customer balances" actions={<Link href="/customers-owe" className="btn btn-sm">All balances</Link>}>
          <DataTable
            columns={[
              { key: 'n', label: 'Customer', render: (r) => r.name },
              { key: 'b', label: 'Balance due', num: true, render: (r) => amt(r.balance) },
            ]}
            rows={balances}
            rowKey={(r) => r.name}
            empty="No customer balances."
          />
        </Card>
        <Card title="Latest sales" actions={<Link href="/sales" className="btn btn-sm">All sales</Link>}>
          <DataTable<Sale>
            columns={[
              { key: 'd', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'c', label: 'Customer', render: (r) => r.customer },
              { key: 'k', label: 'Kg', num: true, render: (r) => kg(r.kg) },
              { key: 'n', label: 'Net', num: true, render: (r) => amt(books.saleCalcs.get(r.id)!.net) },
              { key: 'p', label: 'Payment', render: (r) => r.payment },
            ]}
            rows={latest}
            rowKey={(r) => r.id}
            empty="No sales yet."
          />
        </Card>
      </div>
    </>
  );
}
