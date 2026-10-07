'use client';

import { useBooks } from './BooksProvider';
import type { Column } from './DataTable';
import { EntryList, FormActions, FormError, NameInput, dateCol, sum, useEntryForm, type FormValues } from './entry';
import { BooksPage, Card, Field, PageHead } from './ui';
import { CASH_BANK } from '@/lib/defaults';
import { amt, rs } from '@/lib/format';
import type { AnyRecord, CustomerPayment, SupplierPayment } from '@/lib/types';

type Pay = CustomerPayment | SupplierPayment;

/** Customer payments and supplier payments share one page layout. */
export function PaymentEntryPage({ who }: { who: 'customer' | 'supplier' }) {
  return (
    <BooksPage>
      <Inner who={who} />
    </BooksPage>
  );
}

function Inner({ who }: { who: 'customer' | 'supplier' }) {
  const { books } = useBooks();
  const kind = who === 'customer' ? 'cpay' : 'spay';
  const blank = (date: string): FormValues => ({ date, [who]: '', method: 'Cash', amount: '', ref: '' });
  const toValues = (r: AnyRecord): FormValues => {
    const p = r as Pay;
    return { date: p.date, [who]: 'customer' in p ? p.customer : p.supplier, method: p.method, amount: String(p.amount), ref: p.ref };
  };
  const f = useEntryForm(kind, blank, { focusAfterSave: who });
  const { values: v, bind, errors } = f;
  if (!books) return null;

  const isC = who === 'customer';
  const names = isC ? books.customerNames : books.supplierNames;
  const known = names.find((n) => n.toLowerCase() === (v[who] ?? '').trim().toLowerCase());
  const balance = known ? (isC ? books.customerBalance(known) : books.supplierBalance(known)) : 0;
  const rows = (isC ? books.data.cpay : books.data.spay) as Pay[];
  const nameOf = (p: Pay) => ('customer' in p ? p.customer : p.supplier);

  return (
    <>
      <PageHead
        title={isC ? 'Customer payments' : 'Supplier payments'}
        sub={isC ? 'Money received from customers. It reduces what the customer owes.' : 'Money paid to suppliers. It reduces what is owed to the supplier.'}
      />
      <Card title={f.editingId ? 'Edit payment' : 'New payment'}>
        <form ref={f.formRef} onSubmit={f.submit} noValidate>
          <FormError message={f.formError} />
          <div className="form-grid">
            <Field label="Date" required error={errors.date} htmlFor={`${kind}-date`}>
              <input type="date" {...bind('date')} />
            </Field>
            <Field
              label={isC ? 'Customer' : 'Supplier'}
              required
              error={errors[who]}
              htmlFor={`${kind}-${who}`}
              hint={known ? <span className="owes">{isC ? `${known} owes ${rs(balance)}` : `${known} is owed ${rs(balance)}`}</span> : undefined}
            >
              <NameInput listId={`dl-${who}s`} names={names} {...bind(who)} />
            </Field>
            <Field label={isC ? 'Received in' : 'Paid from'} htmlFor={`${kind}-method`}>
              <select {...bind('method')}>
                {CASH_BANK.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount (Rs.)" required error={errors.amount} htmlFor={`${kind}-amount`}>
              <input inputMode="decimal" {...bind('amount')} />
            </Field>
            <Field label="Reference / notes" wide htmlFor={`${kind}-ref`}>
              <input {...bind('ref')} />
            </Field>
          </div>
          <FormActions editing={!!f.editingId} busy={f.busy} onCancel={() => f.reset()} />
        </form>
      </Card>
      <EntryList<Pay>
        title="Payments"
        kind={kind}
        csvName={isC ? 'customer-payments' : 'supplier-payments'}
        rows={rows}
        searchText={(r) => `${nameOf(r)} ${r.method} ${r.ref}`}
        onEdit={(r) => f.startEdit(r, toValues)}
        columns={(shown): Column<Pay>[] => [
          dateCol<Pay>(),
          { key: 'name', label: isC ? 'Customer' : 'Supplier', render: nameOf, csv: nameOf },
          { key: 'm', label: 'Cash/Bank', render: (r) => r.method, csv: (r) => r.method },
          { key: 'amt', label: 'Amount', num: true, render: (r) => amt(r.amount), csv: (r) => r.amount, total: amt(sum(shown, (r) => r.amount)), csvTotal: sum(shown, (r) => r.amount) },
          { key: 'ref', label: 'Reference / notes', render: (r) => r.ref, csv: (r) => r.ref },
        ]}
      />
    </>
  );
}
