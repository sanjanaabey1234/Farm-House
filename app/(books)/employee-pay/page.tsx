'use client';

import { useBooks } from '@/components/BooksProvider';
import type { Column } from '@/components/DataTable';
import { EntryList, FormActions, FormError, NameInput, Preview, dateCol, sum, useEntryForm, type FormValues } from '@/components/entry';
import { BooksPage, Card, Field, PageHead } from '@/components/ui';
import { wageCalc } from '@/lib/calc';
import { CASH_BANK, PAY_BASES } from '@/lib/defaults';
import { amt, num, rate } from '@/lib/format';
import type { AnyRecord, PayBasis, Wage } from '@/lib/types';

const blank = (date: string): FormValues => ({ date, employee: '', workType: '', basis: 'Daily', qty: '1', rate: '', otherPay: '', method: 'Cash' });

const toValues = (r: AnyRecord): FormValues => {
  const w = r as Wage;
  return { date: w.date, employee: w.employee, workType: w.workType, basis: w.basis, qty: String(w.qty), rate: String(w.rate), otherPay: w.otherPay ? String(w.otherPay) : '', method: w.method };
};

// Labels change with the pay basis (requirements 7.3).
const QTY_LABEL: Record<PayBasis, string> = { 'Per Unit': 'Chickens / units', Daily: 'Days', Monthly: 'Months', Commission: 'Sales (Rs.)' };
const RATE_LABEL: Record<PayBasis, string> = { 'Per Unit': 'Rate per unit (Rs.)', Daily: 'Daily rate (Rs.)', Monthly: 'Monthly salary (Rs.)', Commission: 'Commission %' };

export default function EmployeePayPage() {
  return (
    <BooksPage>
      <Inner />
    </BooksPage>
  );
}

function Inner() {
  const { books, data } = useBooks();
  const f = useEntryForm('wage', blank, { focusAfterSave: 'employee' });
  const { values: v, bind, errors, setValues } = f;
  if (!books) return null;
  const basis = (v.basis as PayBasis) || 'Daily';
  const calc = wageCalc({ basis, qty: num(v.qty), rate: num(v.rate), otherPay: num(v.otherPay) });

  // Choosing an employee fills in their standard position, pay basis and rate. Daily workers default to 1 day.
  const onEmployee = (name: string) => {
    const e = data.employee.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    setValues((o) => {
      const next: FormValues = { ...o, employee: name };
      if (e && !f.editingId) {
        next.workType = e.position || o.workType;
        next.basis = e.basis;
        next.rate = String(e.rate || '');
        if (e.basis === 'Daily') next.qty = '1';
        else if (o.basis === 'Daily' && o.qty === '1') next.qty = '';
      }
      return next;
    });
  };

  return (
    <>
      <PageHead title="Employee pay" sub="Wages per unit, daily, monthly or commission. Wages are recorded only here, never in other expenses." />
      <Card title={f.editingId ? 'Edit pay' : 'New pay entry'}>
        <form ref={f.formRef} onSubmit={f.submit} noValidate>
          <FormError message={f.formError} />
          <div className="form-grid">
            <Field label="Date" required error={errors.date} htmlFor="wage-date">
              <input type="date" {...bind('date')} />
            </Field>
            <Field label="Employee" required error={errors.employee} htmlFor="wage-employee">
              <NameInput listId="dl-employees" names={books.employeeNames} {...bind('employee')} onChange={(e) => onEmployee(e.target.value)} />
            </Field>
            <Field label="Work type" htmlFor="wage-workType">
              <select {...bind('workType')}>
                <option value="">—</option>
                {[...new Set([...books.workTypes, v.workType].filter(Boolean))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Pay basis" htmlFor="wage-basis">
              <select {...bind('basis')}>
                {PAY_BASES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label={QTY_LABEL[basis]} required error={errors.qty} htmlFor="wage-qty">
              <input inputMode="decimal" {...bind('qty')} />
            </Field>
            <Field label={RATE_LABEL[basis]} required error={errors.rate} hint={basis === 'Commission' ? 'Whole number: 1 = 1%' : undefined} htmlFor="wage-rate">
              <input inputMode="decimal" {...bind('rate')} />
            </Field>
            <Field label="Other pay (Rs.)" error={errors.otherPay} hint="Bonus / allowance" htmlFor="wage-otherPay">
              <input inputMode="decimal" {...bind('otherPay')} />
            </Field>
            <Field label="Paid from" htmlFor="wage-method">
              <select {...bind('method')}>
                {CASH_BANK.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <Preview
            items={[
              ['Calculated pay', `Rs. ${amt(calc.calculated)}`],
              ['Total pay', `Rs. ${amt(calc.total)}`],
            ]}
          />
          <FormActions editing={!!f.editingId} busy={f.busy} onCancel={() => f.reset()} />
        </form>
      </Card>
      <EntryList<Wage>
        title="Pay entries"
        kind="wage"
        csvName="employee-pay"
        rows={books.data.wage}
        searchText={(r) => `${r.employee} ${r.workType} ${r.basis} ${r.method}`}
        onEdit={(r) => f.startEdit(r, toValues)}
        columns={(shown): Column<Wage>[] => {
          const c = (r: Wage) => books.wageCalcs.get(r.id)!;
          return [
            dateCol<Wage>(),
            { key: 'emp', label: 'Employee', render: (r) => r.employee, csv: (r) => r.employee },
            { key: 'wt', label: 'Work type', render: (r) => r.workType, csv: (r) => r.workType },
            { key: 'b', label: 'Pay basis', render: (r) => r.basis, csv: (r) => r.basis },
            { key: 'q', label: 'Qty / days / sales', num: true, render: (r) => rate(r.qty), csv: (r) => r.qty },
            { key: 'r', label: 'Rate / %', num: true, render: (r) => rate(r.rate), csv: (r) => r.rate },
            { key: 'cp', label: 'Calculated', num: true, render: (r) => amt(c(r).calculated), csv: (r) => c(r).calculated, total: amt(sum(shown, (r) => c(r).calculated)), csvTotal: sum(shown, (r) => c(r).calculated) },
            { key: 'op', label: 'Other pay', num: true, render: (r) => amt(r.otherPay), csv: (r) => r.otherPay, total: amt(sum(shown, (r) => r.otherPay)), csvTotal: sum(shown, (r) => r.otherPay) },
            { key: 'tp', label: 'Total pay', num: true, render: (r) => amt(c(r).total), csv: (r) => c(r).total, total: amt(sum(shown, (r) => c(r).total)), csvTotal: sum(shown, (r) => c(r).total) },
            { key: 'm', label: 'Cash/Bank', render: (r) => r.method, csv: (r) => r.method },
          ];
        }}
      />
    </>
  );
}
