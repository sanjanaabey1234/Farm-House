'use client';

import { useBooks } from '@/components/BooksProvider';
import type { Column } from '@/components/DataTable';
import { EntryList, FormActions, FormError, NameInput, Preview, dateCol, sum, useEntryForm, type FormValues } from '@/components/entry';
import { BooksPage, Card, Field, PageHead } from '@/components/ui';
import { purchaseCalc } from '@/lib/calc';
import { PAY_METHODS } from '@/lib/defaults';
import { amt, kg, num, rate, rs } from '@/lib/format';
import type { AnyRecord, PayMethod, Purchase } from '@/lib/types';

const blank = (date: string): FormValues => ({
  date,
  supplier: '',
  invoice: '',
  chickenType: 'Chicken',
  kg: '',
  cost: '',
  otherCost: '',
  payment: 'Cash',
  paid: '',
  paidTouched: '',
});

const toValues = (r: AnyRecord): FormValues => {
  const p = r as Purchase;
  const total = purchaseCalc(p).total;
  const touched = p.payment !== 'Credit' && Math.abs(p.paid - total) > 0.004;
  return {
    date: p.date,
    supplier: p.supplier,
    invoice: p.invoice,
    chickenType: p.chickenType,
    kg: String(p.kg),
    cost: String(p.cost),
    otherCost: p.otherCost ? String(p.otherCost) : '',
    payment: p.payment,
    paid: touched ? String(p.paid) : '',
    paidTouched: touched ? '1' : '',
  };
};

const toInput = (v: FormValues) => {
  const { paidTouched, ...rest } = v;
  return { ...rest, paid: v.payment === 'Credit' ? 0 : paidTouched ? v.paid : '' };
};

export default function PurchasesPage() {
  return (
    <BooksPage>
      <Inner />
    </BooksPage>
  );
}

function Inner() {
  const { books } = useBooks();
  const f = useEntryForm('purchase', blank, { focusAfterSave: 'supplier', toInput });
  const { values: v, bind, errors, set } = f;
  if (!books) return null;

  const calc = purchaseCalc({ kg: num(v.kg), cost: num(v.cost), otherCost: num(v.otherCost), payment: v.payment as PayMethod, paid: 0 });
  const paid = v.payment === 'Credit' ? 0 : v.paidTouched ? num(v.paid) : calc.total;
  const known = books.supplierNames.find((n) => n.toLowerCase() === v.supplier.trim().toLowerCase());

  return (
    <>
      <PageHead title="Purchases" sub="Chicken bought by the kg, with transport or handling as other cost." />
      <Card title={f.editingId ? 'Edit purchase' : 'New purchase'}>
        <form ref={f.formRef} onSubmit={f.submit} noValidate>
          <FormError message={f.formError} />
          <div className="form-grid">
            <Field label="Date" required error={errors.date} htmlFor="purchase-date">
              <input type="date" {...bind('date')} />
            </Field>
            <Field
              label="Supplier"
              required
              error={errors.supplier}
              htmlFor="purchase-supplier"
              hint={known ? <span className="owes">{known} is owed {rs(books.supplierBalance(known))}</span> : v.supplier ? 'New supplier' : undefined}
            >
              <NameInput listId="dl-suppliers" names={books.supplierNames} {...bind('supplier')} />
            </Field>
            <Field label="Invoice no." htmlFor="purchase-invoice">
              <input {...bind('invoice')} />
            </Field>
            <Field label="Chicken type" htmlFor="purchase-chickenType">
              <select {...bind('chickenType')}>
                {[...new Set([...books.chickenTypes, v.chickenType].filter(Boolean))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Kg received" required error={errors.kg} htmlFor="purchase-kg">
              <input inputMode="decimal" {...bind('kg')} />
            </Field>
            <Field label="Cost per kg (Rs.)" required error={errors.cost} htmlFor="purchase-cost">
              <input inputMode="decimal" {...bind('cost')} />
            </Field>
            <Field label="Other cost (Rs.)" error={errors.otherCost} hint="Transport / handling" htmlFor="purchase-otherCost">
              <input inputMode="decimal" {...bind('otherCost')} />
            </Field>
            <Field label="Payment" htmlFor="purchase-payment">
              <select {...bind('payment')}>
                {PAY_METHODS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount paid (Rs.)" error={errors.paid} hint={v.payment === 'Credit' ? 'Credit: always 0' : 'Lower it for a part payment'} htmlFor="purchase-paid">
              <input
                inputMode="decimal"
                {...bind('paid')}
                value={v.payment === 'Credit' ? '0' : v.paidTouched ? v.paid : calc.total ? String(Math.round(calc.total * 100) / 100) : ''}
                disabled={bind('paid').disabled || v.payment === 'Credit'}
                onChange={(e) => {
                  set('paid', e.target.value);
                  set('paidTouched', '1');
                }}
              />
            </Field>
          </div>
          <Preview
            items={[
              ['Purchase cost', `Rs. ${amt(calc.purchaseCost)}`],
              ['Total', `Rs. ${amt(calc.total)}`],
              ['Balance owed', `Rs. ${amt(calc.total - paid)}`],
            ]}
          />
          <FormActions editing={!!f.editingId} busy={f.busy} onCancel={() => f.reset()} />
        </form>
      </Card>

      <EntryList<Purchase>
        title="Purchases"
        kind="purchase"
        csvName="purchases"
        rows={books.data.purchase}
        searchText={(r) => `${r.invoice} ${r.supplier} ${r.chickenType} ${r.payment}`}
        onEdit={(r) => f.startEdit(r, toValues)}
        columns={(shown): Column<Purchase>[] => {
          const c = (r: Purchase) => books.purchaseCalcs.get(r.id)!;
          return [
            dateCol<Purchase>(),
            { key: 'sup', label: 'Supplier', render: (r) => r.supplier, csv: (r) => r.supplier },
            { key: 'inv', label: 'Invoice', render: (r) => r.invoice, csv: (r) => r.invoice },
            { key: 'type', label: 'Type', render: (r) => r.chickenType, csv: (r) => r.chickenType },
            { key: 'kg', label: 'Kg', num: true, render: (r) => kg(r.kg), csv: (r) => r.kg, total: kg(sum(shown, (r) => r.kg)), csvTotal: sum(shown, (r) => r.kg) },
            { key: 'cost', label: 'Cost/kg', num: true, render: (r) => rate(r.cost), csv: (r) => r.cost },
            { key: 'pc', label: 'Purchase cost', num: true, render: (r) => amt(c(r).purchaseCost), csv: (r) => c(r).purchaseCost, total: amt(sum(shown, (r) => c(r).purchaseCost)), csvTotal: sum(shown, (r) => c(r).purchaseCost) },
            { key: 'oc', label: 'Other cost', num: true, render: (r) => amt(r.otherCost), csv: (r) => r.otherCost, total: amt(sum(shown, (r) => r.otherCost)), csvTotal: sum(shown, (r) => r.otherCost) },
            { key: 'tot', label: 'Total', num: true, render: (r) => amt(c(r).total), csv: (r) => c(r).total, total: amt(sum(shown, (r) => c(r).total)), csvTotal: sum(shown, (r) => c(r).total) },
            { key: 'pay', label: 'Payment', render: (r) => r.payment, csv: (r) => r.payment },
            { key: 'paid', label: 'Paid', num: true, render: (r) => amt(c(r).paid), csv: (r) => c(r).paid, total: amt(sum(shown, (r) => c(r).paid)), csvTotal: sum(shown, (r) => c(r).paid) },
            { key: 'bal', label: 'Balance', num: true, render: (r) => amt(c(r).balance), csv: (r) => c(r).balance, total: amt(sum(shown, (r) => c(r).balance)), csvTotal: sum(shown, (r) => c(r).balance) },
          ];
        }}
      />
    </>
  );
}
