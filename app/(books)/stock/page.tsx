'use client';

import { useEffect, useState } from 'react';
import { useBooks } from '@/components/BooksProvider';
import { CsvButton, DataTable, exportTableCSV, type Column } from '@/components/DataTable';
import { sum } from '@/components/entry';
import { BooksPage, Card, Notice, PageHead } from '@/components/ui';
import { kg } from '@/lib/format';
import { slug } from '@/lib/client/download';
import type { StockRow } from '@/lib/calc';

export default function StockPage() {
  return (
    <BooksPage>
      <Inner />
    </BooksPage>
  );
}

/** Number cell that saves when the user leaves it. */
function StockInput({ value, label, onSave, disabled }: { value: number | null; label: string; onSave: (v: string) => Promise<void>; disabled: boolean }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      onBlur={() => {
        const before = value === null ? '' : String(value);
        if (text.trim() !== before) void onSave(text.trim());
      }}
    />
  );
}

function Inner() {
  const { books, business, canEdit, updateBusiness, notify } = useBooks();
  if (!books || !business) return null;
  const rows = books.stock;

  const save = async (type: string, field: 'opening' | 'physical', text: string) => {
    const cur = business.stock?.[type] ?? { opening: 0, physical: null };
    const value = text === '' ? (field === 'opening' ? 0 : null) : Number(text.replace(/,/g, ''));
    if (value !== null && !isFinite(value)) {
      notify('Type a number', 'error');
      return;
    }
    const res = await updateBusiness({ stock: { [type]: { ...cur, [field]: value } } });
    notify(res.ok ? 'Stock saved' : (res.error ?? 'Not saved'), res.ok ? 'ok' : 'error');
  };

  const columns: Column<StockRow>[] = [
    { key: 't', label: 'Chicken type', render: (r) => r.type, csv: (r) => r.type, total: 'Total' },
    {
      key: 'o',
      label: 'Opening kg',
      num: true,
      render: (r) => <StockInput value={r.opening || null} label={`Opening kg for ${r.type}`} disabled={!canEdit} onSave={(v) => save(r.type, 'opening', v)} />,
      csv: (r) => r.opening,
      total: kg(sum(rows, (r) => r.opening)),
      csvTotal: sum(rows, (r) => r.opening),
    },
    { key: 'p', label: 'Purchased kg', num: true, render: (r) => kg(r.purchased), csv: (r) => r.purchased, total: kg(sum(rows, (r) => r.purchased)), csvTotal: sum(rows, (r) => r.purchased) },
    { key: 'a', label: 'Available kg', num: true, render: (r) => kg(r.available), csv: (r) => r.available, total: kg(sum(rows, (r) => r.available)), csvTotal: sum(rows, (r) => r.available) },
    { key: 's', label: 'Sold kg', num: true, render: (r) => kg(r.sold), csv: (r) => r.sold, total: kg(sum(rows, (r) => r.sold)), csvTotal: sum(rows, (r) => r.sold) },
    { key: 'c', label: 'Estimated closing kg', num: true, render: (r) => <b className={r.closing < 0 ? 'neg-text' : undefined}>{kg(r.closing)}</b>, csv: (r) => r.closing, total: kg(sum(rows, (r) => r.closing)), csvTotal: sum(rows, (r) => r.closing) },
    {
      key: 'ph',
      label: 'Physical count kg',
      num: true,
      render: (r) => <StockInput value={r.physical} label={`Physical count for ${r.type}`} disabled={!canEdit} onSave={(v) => save(r.type, 'physical', v)} />,
      csv: (r) => r.physical ?? '',
    },
    { key: 'd', label: 'Difference kg', num: true, render: (r) => (r.diff === null ? '' : <span className={r.diff < 0 ? 'neg-text' : undefined}>{kg(r.diff)}</span>), csv: (r) => r.diff ?? '' },
    { key: 'dp', label: 'Difference %', num: true, render: (r) => (r.diffPct === null ? '' : `${(r.diffPct * 100).toFixed(1)}%`), csv: (r) => (r.diffPct === null ? '' : Math.round(r.diffPct * 10000) / 100) },
  ];

  return (
    <>
      <PageHead title="Stock (kg)" sub="Available = opening + purchased. Estimated closing = available − sold." />
      <Notice>
        Stock is an estimate. Processing loss, spoilage and weight differences only show when you enter a physical count. Type the opening kg and physical counts straight into the table.
      </Notice>
      <Card title="Stock by chicken type" actions={<CsvButton onClick={() => exportTableCSV(`${slug(business.name)}-stock`, columns, rows, true)} />}>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.type} showTotal />
      </Card>
    </>
  );
}
