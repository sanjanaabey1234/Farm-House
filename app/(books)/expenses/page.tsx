'use client';

import { useBooks } from '@/components/BooksProvider';
import type { Column } from '@/components/DataTable';
import { EntryList, FormActions, FormError, dateCol, sum, useEntryForm, type FormValues } from '@/components/entry';
import { BooksPage, Card, Field, PageHead } from '@/components/ui';
import { CASH_BANK } from '@/lib/defaults';
import { amt } from '@/lib/format';
import type { AnyRecord, Expense } from '@/lib/types';

const blank = (date: string): FormValues => ({ date, category: 'Transport', description: '', method: 'Cash', amount: '' });
const toValues = (r: AnyRecord): FormValues => {
  const e = r as Expense;
  return { date: e.date, category: e.category, description: e.description, method: e.method, amount: String(e.amount) };
};

export default function ExpensesPage() {
  return (
    <BooksPage>
      <Inner />
    </BooksPage>
  );
}

function Inner() {
  const { books } = useBooks();
  const f = useEntryForm('expense', blank, { focusAfterSave: 'category' });
  const { values: v, bind, errors } = f;
  if (!books) return null;
  return (
    <>
      <PageHead title="Other expenses" sub="Running expenses paid from cash or bank. Wages go on Employee pay, not here." />
      <Card title={f.editingId ? 'Edit expense' : 'New expense'}>
        <form ref={f.formRef} onSubmit={f.submit} noValidate>
          <FormError message={f.formError} />
          <div className="form-grid">
            <Field label="Date" required error={errors.date} htmlFor="expense-date">
              <input type="date" {...bind('date')} />
            </Field>
            <Field label="Category" htmlFor="expense-category">
              <select {...bind('category')}>
                {[...new Set([...books.expenseCategories, v.category].filter(Boolean))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Description" wide htmlFor="expense-description">
              <input {...bind('description')} />
            </Field>
            <Field label="Paid from" htmlFor="expense-method">
              <select {...bind('method')}>
                {CASH_BANK.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount (Rs.)" required error={errors.amount} htmlFor="expense-amount">
              <input inputMode="decimal" {...bind('amount')} />
            </Field>
          </div>
          <FormActions editing={!!f.editingId} busy={f.busy} onCancel={() => f.reset()} />
        </form>
      </Card>
      <EntryList<Expense>
        title="Expenses"
        kind="expense"
        csvName="expenses"
        rows={books.data.expense}
        searchText={(r) => `${r.category} ${r.description} ${r.method}`}
        onEdit={(r) => f.startEdit(r, toValues)}
        columns={(shown): Column<Expense>[] => [
          dateCol<Expense>(),
          { key: 'cat', label: 'Category', render: (r) => r.category, csv: (r) => r.category },
          { key: 'desc', label: 'Description', render: (r) => r.description, csv: (r) => r.description },
          { key: 'm', label: 'Cash/Bank', render: (r) => r.method, csv: (r) => r.method },
          { key: 'amt', label: 'Amount', num: true, render: (r) => amt(r.amount), csv: (r) => r.amount, total: amt(sum(shown, (r) => r.amount)), csvTotal: sum(shown, (r) => r.amount) },
        ]}
      />
    </>
  );
}
