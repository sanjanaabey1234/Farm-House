'use client';

import { useMemo, useState } from 'react';
import { useBooks } from './BooksProvider';
import { CsvButton, DataTable, exportTableCSV, type Column } from './DataTable';
import { FormActions, FormError, useEntryForm, type FormValues } from './entry';
import { BooksPage, Card, ConfirmDeleteButton, Field, PageHead } from './ui';
import { PAY_BASES } from '@/lib/defaults';
import { amt, rate } from '@/lib/format';
import { slug } from '@/lib/client/download';
import type { AnyRecord, Customer, Employee, MasterRecord, Supplier } from '@/lib/types';

type MasterKind = MasterRecord['kind'];

const TITLES: Record<MasterKind, { title: string; sub: string; one: string }> = {
  customer: { title: 'Customers', sub: 'Hotels, restaurants and shops you sell to. Opening balance = what they owed at the period start.', one: 'customer' },
  supplier: { title: 'Suppliers', sub: 'Who you buy chicken from. Opening balance = what you owed them at the period start.', one: 'supplier' },
  employee: { title: 'Employees', sub: 'Standard position, pay basis and rate fill in automatically on Employee pay.', one: 'employee' },
};

const blankFor = (kind: MasterKind) => (): FormValues =>
  kind === 'employee'
    ? { code: '', name: '', position: '', basis: 'Daily', rate: '', phone: '', active: 'Yes' }
    : { code: '', name: '', phone: '', address: '', opening: '', active: 'Yes' };

const toValues = (r: AnyRecord): FormValues => {
  const m = r as MasterRecord;
  if (m.kind === 'employee') return { code: m.code, name: m.name, position: m.position, basis: m.basis, rate: String(m.rate || ''), phone: m.phone, active: m.active ? 'Yes' : 'No' };
  return { code: m.code, name: m.name, phone: m.phone, address: m.address, opening: m.opening ? String(m.opening) : '', active: m.kind === 'customer' ? (m.active ? 'Yes' : 'No') : 'Yes' };
};

const toInput = (v: FormValues) => ({ ...v, active: v.active !== 'No' });

export function MasterPage({ kind }: { kind: MasterKind }) {
  return (
    <BooksPage>
      <Inner kind={kind} />
    </BooksPage>
  );
}

function Inner({ kind }: { kind: MasterKind }) {
  const { books, data, canEdit, deleteRecord, notify, business } = useBooks();
  const f = useEntryForm(kind, blankFor(kind), { focusAfterSave: 'name', toInput });
  const { bind, errors } = f;
  const [q, setQ] = useState('');
  const t = TITLES[kind];
  const rows = data[kind] as MasterRecord[];
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...rows]
      .filter((r) => !needle || `${r.code} ${r.name} ${r.phone} ${'address' in r ? r.address : ''} ${'position' in r ? r.position : ''}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));
  }, [rows, q]);
  if (!books) return null;

  const balance = (r: MasterRecord) => (kind === 'customer' ? books.customerBalance(r.name) : books.supplierBalance(r.name));
  const columns: Column<MasterRecord>[] =
    kind === 'employee'
      ? [
          { key: 'code', label: 'ID', render: (r) => r.code, csv: (r) => r.code },
          { key: 'name', label: 'Name', render: (r) => r.name, csv: (r) => r.name },
          { key: 'pos', label: 'Position / work type', render: (r) => (r as Employee).position, csv: (r) => (r as Employee).position },
          { key: 'basis', label: 'Pay basis', render: (r) => (r as Employee).basis, csv: (r) => (r as Employee).basis },
          { key: 'rate', label: 'Standard rate', num: true, render: (r) => rate((r as Employee).rate), csv: (r) => (r as Employee).rate },
          { key: 'phone', label: 'Phone', render: (r) => r.phone, csv: (r) => r.phone },
          { key: 'active', label: 'Active', render: (r) => ((r as Employee).active ? 'Yes' : 'No'), csv: (r) => ((r as Employee).active ? 'Yes' : 'No') },
        ]
      : [
          { key: 'code', label: 'ID', render: (r) => r.code, csv: (r) => r.code },
          { key: 'name', label: 'Name', render: (r) => r.name, csv: (r) => r.name },
          { key: 'phone', label: 'Phone', render: (r) => r.phone, csv: (r) => r.phone },
          { key: 'addr', label: 'Address', render: (r) => (r as Customer).address, csv: (r) => (r as Customer).address },
          {
            key: 'open',
            label: 'Opening balance',
            num: true,
            render: (r) => amt((r as Customer | Supplier).opening),
            csv: (r) => (r as Customer | Supplier).opening,
            total: amt(shown.reduce((s, r) => s + ((r as Customer).opening || 0), 0)),
          },
          { key: 'bal', label: 'Balance due now', num: true, render: (r) => amt(balance(r)), csv: (r) => balance(r), total: amt(shown.reduce((s, r) => s + balance(r), 0)) },
          ...(kind === 'customer'
            ? [{ key: 'active', label: 'Active', render: (r: MasterRecord) => ((r as Customer).active ? 'Yes' : 'No'), csv: (r: MasterRecord) => ((r as Customer).active ? 'Yes' : 'No') }]
            : []),
        ];

  return (
    <>
      <PageHead title={t.title} sub={t.sub} />
      <Card title={f.editingId ? `Edit ${t.one}` : `New ${t.one}`}>
        <form ref={f.formRef} onSubmit={f.submit} noValidate>
          <FormError message={f.formError} />
          <div className="form-grid">
            <Field label="ID" hint="Left blank = next number" htmlFor={`${kind}-code`}>
              <input {...bind('code')} />
            </Field>
            <Field label="Name" required error={errors.name} htmlFor={`${kind}-name`}>
              <input {...bind('name')} />
            </Field>
            {kind === 'employee' ? (
              <>
                <Field label="Position / work type" htmlFor={`${kind}-position`}>
                  <select {...bind('position')}>
                    <option value="">—</option>
                    {[...new Set([...books.workTypes, f.values.position].filter(Boolean))].map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Pay basis" htmlFor={`${kind}-basis`}>
                  <select {...bind('basis')}>
                    {PAY_BASES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </Field>
                <Field label={f.values.basis === 'Commission' ? 'Commission %' : 'Standard rate (Rs.)'} error={errors.rate} hint={f.values.basis === 'Commission' ? 'Whole number: 1 = 1%' : undefined} htmlFor={`${kind}-rate`}>
                  <input inputMode="decimal" {...bind('rate')} />
                </Field>
                <Field label="Phone" htmlFor={`${kind}-phone`}>
                  <input {...bind('phone')} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Phone" htmlFor={`${kind}-phone`}>
                  <input {...bind('phone')} />
                </Field>
                <Field label="Address" wide htmlFor={`${kind}-address`}>
                  <input {...bind('address')} />
                </Field>
                <Field label="Opening balance (Rs.)" error={errors.opening} htmlFor={`${kind}-opening`}>
                  <input inputMode="decimal" {...bind('opening')} />
                </Field>
              </>
            )}
            {kind !== 'supplier' ? (
              <Field label="Active" htmlFor={`${kind}-active`}>
                <select {...bind('active')}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </Field>
            ) : null}
          </div>
          <FormActions editing={!!f.editingId} busy={f.busy} onCancel={() => f.reset()} />
        </form>
      </Card>
      <Card
        title={`${t.title} (${shown.length})`}
        actions={<CsvButton onClick={() => exportTableCSV(`${slug(business?.name ?? '')}-${kind}s`, columns, shown)} />}
      >
        <div className="toolbar">
          <input type="search" placeholder="Search…" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(r) => r.id}
          showTotal={kind !== 'employee'}
          empty={`No ${t.one}s yet. Names typed on entry pages still appear in the reports.`}
          actions={
            canEdit
              ? (r) => (
                  <>
                    <button type="button" className="btn btn-sm" onClick={() => f.startEdit(r, toValues)}>
                      Edit
                    </button>
                    <ConfirmDeleteButton
                      onConfirm={async () => {
                        const res = await deleteRecord(kind, r.id);
                        notify(res.ok ? `${r.name} removed from the list` : (res.error ?? 'Not deleted'), res.ok ? 'ok' : 'error');
                      }}
                    />
                  </>
                )
              : undefined
          }
        />
      </Card>
    </>
  );
}
