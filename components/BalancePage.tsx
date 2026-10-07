'use client';

import { useState } from 'react';
import { useBooks } from './BooksProvider';
import { CsvButton, DataTable, exportTableCSV, type Column } from './DataTable';
import { sum } from './entry';
import { BooksPage, Card, Modal, PageHead, Tile } from './ui';
import { fmtDate } from '@/lib/dates';
import { amt, rs } from '@/lib/format';
import { slug } from '@/lib/client/download';
import type { BalanceRow, LedgerLine } from '@/lib/calc';

/** Customers owe / Owed to suppliers (requirements 4.8, 4.9, 7.4). */
export function BalancePage({ who }: { who: 'customer' | 'supplier' }) {
  return (
    <BooksPage>
      <Inner who={who} />
    </BooksPage>
  );
}

function Inner({ who }: { who: 'customer' | 'supplier' }) {
  const { books, business } = useBooks();
  const [open, setOpen] = useState<string | null>(null);
  if (!books || !business) return null;
  const isC = who === 'customer';
  const rows = [...(isC ? books.debtors : books.creditors)].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  const total = sum(rows, (r) => r.balance);
  const openCount = rows.filter((r) => Math.abs(r.balance) > 0.5).length;
  const n = (label: string, key: string, f: (r: BalanceRow) => number): Column<BalanceRow> => ({
    key,
    label,
    num: true,
    render: (r) => amt(f(r)),
    csv: (r) => f(r),
    total: amt(sum(rows, f)),
    csvTotal: sum(rows, f),
  });
  const columns: Column<BalanceRow>[] = [
    {
      key: 'n',
      label: isC ? 'Customer' : 'Supplier',
      render: (r) => (
        <button type="button" className="btn-link" onClick={() => setOpen(r.name)}>
          {r.name}
        </button>
      ),
      csv: (r) => r.name,
    },
    n('Opening balance', 'o', (r) => r.opening),
    n(isC ? 'Credit sales' : 'Credit purchases', 'c', (r) => r.credit),
    n('Payments', 'p', (r) => r.payments),
    { ...n('Balance due', 'b', (r) => r.balance), render: (r) => <b>{amt(r.balance)}</b> },
  ];
  const title = isC ? 'Customers owe' : 'Owed to suppliers';

  return (
    <>
      <PageHead
        title={title}
        sub={isC ? 'Balance due = opening balance + credit sales − payments.' : 'Balance due = opening balance + credit purchases (unpaid balances) − payments.'}
      />
      <div className="tiles">
        <Tile label={isC ? 'Total customers owe' : 'Total owed to suppliers'} value={rs(total)} />
        <Tile label="Open balances" value={openCount} sub={`of ${rows.length} ${isC ? 'customers' : 'suppliers'}`} />
      </div>
      <Card title="Balances" actions={<CsvButton onClick={() => exportTableCSV(`${slug(business.name)}-${isC ? 'customers-owe' : 'owed-to-suppliers'}`, columns, rows, true)} />}>
        <p className="small muted mt0">Click a name to open their account.</p>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.name} showTotal empty={`No ${isC ? 'customers' : 'suppliers'} yet.`} />
      </Card>
      {open ? <AccountModal who={who} name={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function AccountModal({ who, name, onClose }: { who: 'customer' | 'supplier'; name: string; onClose: () => void }) {
  const { books, business } = useBooks();
  if (!books || !business) return null;
  const isC = who === 'customer';
  const acc = isC ? books.customerLedger(name) : books.supplierLedger(name);
  type Line = LedgerLine & { key: string };
  const lines: Line[] = [
    { key: 'open', date: business.periodStart, description: 'Opening balance', ref: '', increase: 0, decrease: 0, balance: acc.opening },
    ...acc.lines.map((l, i) => ({ ...l, key: String(i) })),
  ];
  const columns: Column<Line>[] = [
    { key: 'd', label: 'Date', render: (r) => fmtDate(r.date), csv: (r) => fmtDate(r.date) },
    { key: 'ds', label: 'Details', render: (r) => r.description, csv: (r) => r.description },
    { key: 'r', label: 'Ref / invoice', render: (r) => r.ref, csv: (r) => r.ref },
    { key: 'i', label: isC ? 'Credit sale' : 'Credit purchase', num: true, render: (r) => amt(r.increase), csv: (r) => r.increase, total: amt(sum(acc.lines, (r) => r.increase)) },
    { key: 'p', label: 'Payment', num: true, render: (r) => amt(r.decrease), csv: (r) => r.decrease, total: amt(sum(acc.lines, (r) => r.decrease)) },
    { key: 'b', label: 'Balance', num: true, render: (r) => amt(r.balance), csv: (r) => r.balance, total: amt(acc.balance) },
  ];
  return (
    <Modal title={`${name} — account`} onClose={onClose} wide>
      <div className="tiles">
        <Tile label="Opening balance" value={rs(acc.opening)} />
        <Tile label="Balance due now" value={rs(acc.balance)} />
      </div>
      <DataTable columns={columns} rows={lines} rowKey={(r) => r.key} showTotal totalLabel="Closing" />
      <div className="modal-actions">
        <CsvButton onClick={() => exportTableCSV(`${slug(business.name)}-${slug(name)}-account`, columns, lines)} />
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
