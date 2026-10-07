'use client';

import { useBooks } from '@/components/BooksProvider';
import { EntryList, FormActions, FormError, NameInput, Preview, dateCol, sum, useEntryForm, type FormValues } from '@/components/entry';
import type { Column } from '@/components/DataTable';
import { BooksPage, Card, Field, PageHead } from '@/components/ui';
import { saleCalc } from '@/lib/calc';
import { DISCOUNT_TYPES, PAY_METHODS } from '@/lib/defaults';
import { amt, kg, num, rate, rs } from '@/lib/format';
import type { AnyRecord, DiscountType, PayMethod, Sale } from '@/lib/types';

const blank = (date: string): FormValues => ({
  date,
  invoice: '',
  customer: '',
  chickenType: 'Chicken',
  kg: '',
  price: '',
  discType: 'None',
  discValue: '',
  payment: 'Cash',
  received: '',
  receivedTouched: '',
});

const toValues = (r: AnyRecord): FormValues => {
  const s = r as Sale;
  const net = saleCalc(s).net;
  const touched = s.payment !== 'Credit' && Math.abs(s.received - net) > 0.004;
  return {
    date: s.date,
    invoice: s.invoice,
    customer: s.customer,
    chickenType: s.chickenType,
    kg: String(s.kg),
    price: String(s.price),
    discType: s.discType,
    discValue: s.discType === 'None' ? '' : String(s.discValue),
    payment: s.payment,
    received: touched ? String(s.received) : '',
    receivedTouched: touched ? '1' : '',
  };
};

const toInput = (v: FormValues) => {
  const { receivedTouched, ...rest } = v;
  // untouched amount received = full net (the cleaner fills it in); credit is always 0
  return { ...rest, received: v.payment === 'Credit' ? 0 : receivedTouched ? v.received : '' };
};

export default function SalesPage() {
  return (
    <BooksPage>
      <SalesInner />
    </BooksPage>
  );
}

function SalesInner() {
  const { books } = useBooks();
  const f = useEntryForm('sale', blank, { focusAfterSave: 'invoice', toInput });
  const { values: v, bind, errors, set } = f;
  if (!books) return null;

  const calc = saleCalc({
    kg: num(v.kg),
    price: num(v.price),
    discType: v.discType as DiscountType,
    discValue: num(v.discValue),
    payment: v.payment as PayMethod,
    received: v.payment === 'Credit' ? 0 : v.receivedTouched ? num(v.received) : NaN,
  });
  const net = calc.net;
  const received = v.payment === 'Credit' ? 0 : v.receivedTouched ? num(v.received) : net;
  const creditAdded = net - received;
  const knownCustomer = books.customerNames.find((n) => n.toLowerCase() === v.customer.trim().toLowerCase());
  const discHint = { None: '', Amount: 'Rs. off the invoice', 'Per Kg': 'Rs. per kg', Percentage: 'Whole number: 5 = 5%' }[v.discType as DiscountType];

  return (
    <>
      <PageHead title="Sales" sub="Sales by kg with the actual price charged to each customer on the day." />
      <Card title={f.editingId ? 'Edit sale' : 'New sale'}>
        <form ref={f.formRef} onSubmit={f.submit} noValidate>
          <FormError message={f.formError} />
          <div className="form-grid">
            <Field label="Date" required error={errors.date} htmlFor="sale-date">
              <input type="date" {...bind('date')} required />
            </Field>
            <Field label="Invoice no." htmlFor="sale-invoice">
              <input {...bind('invoice')} />
            </Field>
            <Field
              label="Customer"
              required
              error={errors.customer}
              htmlFor="sale-customer"
              hint={knownCustomer ? <span className="owes">{knownCustomer} owes {rs(books.customerBalance(knownCustomer))}</span> : v.customer ? 'New customer' : undefined}
            >
              <NameInput listId="dl-customers" names={books.customerNames} {...bind('customer')} />
            </Field>
            <Field label="Chicken type" htmlFor="sale-chickenType">
              <select {...bind('chickenType')}>
                {[...new Set([...books.chickenTypes, v.chickenType].filter(Boolean))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Kg" required error={errors.kg} htmlFor="sale-kg">
              <input inputMode="decimal" {...bind('kg')} />
            </Field>
            <Field label="Price per kg (Rs.)" required error={errors.price} htmlFor="sale-price">
              <input inputMode="decimal" {...bind('price')} />
            </Field>
            <Field label="Discount type" htmlFor="sale-discType">
              <select {...bind('discType')}>
                {DISCOUNT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Discount value" error={errors.discValue} hint={discHint} htmlFor="sale-discValue">
              <input inputMode="decimal" {...bind('discValue')} disabled={bind('discValue').disabled || v.discType === 'None'} />
            </Field>
            <Field label="Payment" htmlFor="sale-payment">
              <select {...bind('payment')}>
                {PAY_METHODS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Amount received (Rs.)"
              error={errors.received}
              hint={v.payment === 'Credit' ? 'Credit: always 0' : 'Lower it for a part payment'}
              htmlFor="sale-received"
            >
              <input
                inputMode="decimal"
                {...bind('received')}
                value={v.payment === 'Credit' ? '0' : v.receivedTouched ? v.received : net ? String(Math.round(net * 100) / 100) : ''}
                disabled={bind('received').disabled || v.payment === 'Credit'}
                onChange={(e) => {
                  set('received', e.target.value);
                  set('receivedTouched', '1');
                }}
              />
            </Field>
          </div>
          <Preview
            items={[
              ['Gross', `Rs. ${amt(calc.gross)}`],
              ['Discount', `Rs. ${amt(calc.discount)}`],
              ['Net', `Rs. ${amt(net)}`],
              ['Credit added', `Rs. ${amt(creditAdded)}`],
            ]}
          />
          <FormActions editing={!!f.editingId} busy={f.busy} onCancel={() => f.reset()} />
        </form>
      </Card>

      <EntryList<Sale>
        title="Sales"
        kind="sale"
        csvName="sales"
        rows={books.data.sale}
        searchText={(r) => `${r.invoice} ${r.customer} ${r.chickenType} ${r.payment}`}
        onEdit={(r) => f.startEdit(r, toValues)}
        columns={(shown): Column<Sale>[] => {
          const c = (r: Sale) => books.saleCalcs.get(r.id)!;
          return [
            dateCol<Sale>(),
            { key: 'inv', label: 'Invoice', render: (r) => r.invoice, csv: (r) => r.invoice },
            { key: 'cust', label: 'Customer', render: (r) => r.customer, csv: (r) => r.customer },
            { key: 'type', label: 'Type', render: (r) => r.chickenType, csv: (r) => r.chickenType },
            { key: 'kg', label: 'Kg', num: true, render: (r) => kg(r.kg), csv: (r) => r.kg, total: kg(sum(shown, (r) => r.kg)), csvTotal: sum(shown, (r) => r.kg) },
            { key: 'price', label: 'Price/kg', num: true, render: (r) => rate(r.price), csv: (r) => r.price },
            { key: 'gross', label: 'Gross', num: true, render: (r) => amt(c(r).gross), csv: (r) => c(r).gross, total: amt(sum(shown, (r) => c(r).gross)), csvTotal: sum(shown, (r) => c(r).gross) },
            { key: 'dt', label: 'Discount', render: (r) => (r.discType === 'None' ? '–' : `${r.discType} ${r.discValue}`), csv: (r) => (r.discType === 'None' ? '' : `${r.discType} ${r.discValue}`) },
            { key: 'disc', label: 'Discount', num: true, render: (r) => amt(c(r).discount), csv: (r) => c(r).discount, total: amt(sum(shown, (r) => c(r).discount)), csvTotal: sum(shown, (r) => c(r).discount) },
            { key: 'net', label: 'Net', num: true, render: (r) => amt(c(r).net), csv: (r) => c(r).net, total: amt(sum(shown, (r) => c(r).net)), csvTotal: sum(shown, (r) => c(r).net) },
            { key: 'pay', label: 'Payment', render: (r) => r.payment, csv: (r) => r.payment },
            { key: 'rec', label: 'Received', num: true, render: (r) => amt(c(r).received), csv: (r) => c(r).received, total: amt(sum(shown, (r) => c(r).received)), csvTotal: sum(shown, (r) => c(r).received) },
            { key: 'cr', label: 'Credit added', num: true, render: (r) => amt(c(r).credit), csv: (r) => c(r).credit, total: amt(sum(shown, (r) => c(r).credit)), csvTotal: sum(shown, (r) => c(r).credit) },
          ];
        }}
      />
    </>
  );
}
