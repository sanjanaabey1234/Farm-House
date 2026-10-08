// Business rules and reports (requirements section 4). The Excel export reproduces the same rules as formulas.

import { monthEnd, monthKey, monthsBetween } from './dates';
import { amt } from './format';
import type {
  BookData,
  Business,
  CustomerPayment,
  Purchase,
  Sale,
  SupplierPayment,
  Wage,
} from './types';

// ---------------------------------------------------------------- row rules

export interface SaleCalc {
  gross: number;
  discount: number;
  net: number;
  received: number;
  credit: number;
}

export function discountAmount(gross: number, kg: number, type: string, value: number): number {
  const v = Number(value) || 0;
  switch (type) {
    case 'Amount':
      return v;
    case 'Per Kg':
      return v * kg;
    case 'Percentage':
      return (gross * v) / 100; // whole-number percentages: 5 means 5% (rule 4.2)
    default:
      return 0;
  }
}

export function saleCalc(s: Pick<Sale, 'kg' | 'price' | 'discType' | 'discValue' | 'payment' | 'received'>): SaleCalc {
  const kg = Number(s.kg) || 0;
  const gross = kg * (Number(s.price) || 0);
  const discount = discountAmount(gross, kg, s.discType, s.discValue);
  const net = gross - discount;
  const received = s.payment === 'Credit' ? 0 : Number(s.received) || 0;
  return { gross, discount, net, received, credit: net - received };
}

export interface PurchaseCalc {
  purchaseCost: number;
  total: number;
  paid: number;
  balance: number;
}

export function purchaseCalc(p: Pick<Purchase, 'kg' | 'cost' | 'otherCost' | 'payment' | 'paid'>): PurchaseCalc {
  const purchaseCost = (Number(p.kg) || 0) * (Number(p.cost) || 0);
  const total = purchaseCost + (Number(p.otherCost) || 0);
  const paid = p.payment === 'Credit' ? 0 : Number(p.paid) || 0;
  return { purchaseCost, total, paid, balance: total - paid };
}

export interface WageCalc {
  calculated: number;
  total: number;
}

export function wageCalc(w: Pick<Wage, 'basis' | 'qty' | 'rate' | 'otherPay'>): WageCalc {
  const q = Number(w.qty) || 0;
  const r = Number(w.rate) || 0;
  const calculated = w.basis === 'Commission' ? (q * r) / 100 : q * r;
  return { calculated, total: calculated + (Number(w.otherPay) || 0) };
}

// ---------------------------------------------------------------- report types

export interface DailyRow {
  date: string;
  kgSold: number;
  gross: number;
  discount: number;
  net: number;
  received: number;
  credit: number;
  kgBought: number;
  purchases: number;
  expenses: number; // expenses + wages
  kgDiff: number; // kg sold − bought
}

export interface MoneyBookRow {
  date: string;
  salesIn: number;
  customerPayments: number;
  totalIn: number;
  purchasesPaid: number;
  supplierPayments: number;
  wages: number;
  expenses: number;
  totalOut: number;
  balance: number;
}

/** One cash or bank movement (a sale, purchase, payment, wage or expense) with the book balance after it. */
export interface MoneyBookEntry {
  id: string;
  date: string;
  type: 'Sale' | 'Customer payment' | 'Purchase' | 'Supplier payment' | 'Wages' | 'Expense';
  ref: string; // invoice no. or payment reference
  party: string; // customer, supplier, employee or expense category
  details: string;
  in: number;
  out: number;
  balance: number;
}

export interface MoneyBook {
  method: 'Cash' | 'Bank';
  opening: number;
  rows: MoneyBookRow[]; // days with activity
  entries: MoneyBookEntry[]; // every movement in date order, money in before money out on a day
  totalIn: number;
  totalOut: number;
  closing: number;
  lowest: number;
  /** balance at the end of a date (inclusive) */
  balanceAt(date: string): number;
}

export interface StockRow {
  type: string;
  opening: number;
  purchased: number;
  available: number;
  sold: number;
  closing: number;
  physical: number | null;
  diff: number | null;
  diffPct: number | null;
}

export interface BalanceRow {
  name: string;
  opening: number;
  credit: number;
  payments: number;
  balance: number;
}

export interface MonthlyRow {
  month: string;
  kgBought: number;
  kgSold: number;
  netSales: number;
  purchases: number;
  avgCost: number;
  avgCostFromPeriod: boolean;
  cogs: number;
  grossProfit: number;
  expenses: number; // other expenses + wages
  wages: number;
  otherExpenses: number;
  netProfit: number;
  cash: number;
  bank: number;
  debtors: number;
  creditors: number;
}

export interface CustomerMonthRow {
  month: string;
  lines: number;
  kg: number;
  gross: number;
  discount: number;
  net: number;
  avgPrice: number;
  paidAtSale: number;
  credit: number;
  payments: number;
  balance: number;
}

export interface CustomerMonthly {
  name: string;
  opening: number;
  balanceNow: number;
  rows: CustomerMonthRow[];
  totals: Omit<CustomerMonthRow, 'month' | 'balance'>;
}

export interface GridRow {
  name: string;
  byMonth: number[];
  kg: number;
  net: number;
  balance: number;
}

export interface LedgerLine {
  date: string;
  description: string;
  ref: string;
  increase: number; // credit sale / credit purchase
  decrease: number; // payment
  balance: number;
}

export interface Books {
  business: Business;
  data: BookData; // only in-period transactions
  months: string[];
  saleCalcs: Map<string, SaleCalc>;
  purchaseCalcs: Map<string, PurchaseCalc>;
  wageCalcs: Map<string, WageCalc>;
  customerNames: string[];
  supplierNames: string[];
  employeeNames: string[];
  chickenTypes: string[];
  expenseCategories: string[];
  workTypes: string[];
  daily: DailyRow[];
  cash: MoneyBook;
  bank: MoneyBook;
  stock: StockRow[];
  debtors: BalanceRow[];
  creditors: BalanceRow[];
  monthly: MonthlyRow[];
  monthlyTotals: Omit<MonthlyRow, 'month' | 'avgCostFromPeriod'>;
  periodAvgCost: number;
  customerBalance(name: string): number;
  supplierBalance(name: string): number;
  customerMonthly(name: string): CustomerMonthly;
  customerGrid: GridRow[];
  customerLedger(name: string): { opening: number; lines: LedgerLine[]; balance: number };
  supplierLedger(name: string): { opening: number; lines: LedgerLine[]; balance: number };
}

// ---------------------------------------------------------------- helpers

const key = (s: string) => s.trim().toLowerCase();

function uniqueNames(...lists: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) for (const n of list) {
    const t = (n ?? '').trim();
    if (t && !seen.has(key(t))) seen.set(key(t), t);
  }
  return [...seen.values()];
}

function sumBy<T>(rows: T[], f: (r: T) => number): number {
  let s = 0;
  for (const r of rows) s += f(r);
  return s;
}

export function inPeriod(b: Pick<Business, 'periodStart' | 'periodEnd'>, date: string): boolean {
  return !!date && date >= b.periodStart && date <= b.periodEnd;
}

export function filterToPeriod(b: Business, d: BookData): BookData {
  const f = <T extends { date: string }>(rows: T[]) => rows.filter((r) => inPeriod(b, r.date));
  return {
    customer: d.customer,
    supplier: d.supplier,
    employee: d.employee,
    sale: f(d.sale),
    purchase: f(d.purchase),
    cpay: f(d.cpay),
    spay: f(d.spay),
    wage: f(d.wage),
    expense: f(d.expense),
  };
}

// ---------------------------------------------------------------- the books

export function computeBooks(business: Business, all: BookData): Books {
  const data = filterToPeriod(business, all);
  const months = monthsBetween(business.periodStart, business.periodEnd);

  const saleCalcs = new Map<string, SaleCalc>();
  for (const s of data.sale) saleCalcs.set(s.id, saleCalc(s));
  const purchaseCalcs = new Map<string, PurchaseCalc>();
  for (const p of data.purchase) purchaseCalcs.set(p.id, purchaseCalc(p));
  const wageCalcs = new Map<string, WageCalc>();
  for (const w of data.wage) wageCalcs.set(w.id, wageCalc(w));
  const sc = (s: Sale) => saleCalcs.get(s.id)!;
  const pc = (p: Purchase) => purchaseCalcs.get(p.id)!;
  const wc = (w: Wage) => wageCalcs.get(w.id)!;

  const customerNames = uniqueNames(
    data.customer.map((c) => c.name),
    data.sale.map((s) => s.customer),
    data.cpay.map((p) => p.customer),
  );
  const supplierNames = uniqueNames(
    data.supplier.map((c) => c.name),
    data.purchase.map((s) => s.supplier),
    data.spay.map((p) => p.supplier),
  );
  const employeeNames = uniqueNames(data.employee.map((c) => c.name), data.wage.map((w) => w.employee));
  const chickenTypes = uniqueNames(
    business.lists.chickenTypes,
    data.sale.map((s) => s.chickenType),
    data.purchase.map((p) => p.chickenType),
  );
  const expenseCategories = uniqueNames(business.lists.expenseCategories, data.expense.map((e) => e.category));
  const workTypes = uniqueNames(
    business.lists.workTypes,
    data.employee.map((e) => e.position),
    data.wage.map((w) => w.workType),
  );

  // ---- daily summary (days with activity)
  const dayMap = new Map<string, DailyRow>();
  const day = (date: string) => {
    let r = dayMap.get(date);
    if (!r) {
      r = { date, kgSold: 0, gross: 0, discount: 0, net: 0, received: 0, credit: 0, kgBought: 0, purchases: 0, expenses: 0, kgDiff: 0 };
      dayMap.set(date, r);
    }
    return r;
  };
  for (const s of data.sale) {
    const c = sc(s);
    const r = day(s.date);
    r.kgSold += Number(s.kg) || 0;
    r.gross += c.gross;
    r.discount += c.discount;
    r.net += c.net;
    r.received += c.received;
    r.credit += c.credit;
  }
  for (const p of data.purchase) {
    const r = day(p.date);
    r.kgBought += Number(p.kg) || 0;
    r.purchases += pc(p).total;
  }
  for (const e of data.expense) day(e.date).expenses += Number(e.amount) || 0;
  for (const w of data.wage) day(w.date).expenses += wc(w).total;
  for (const r of dayMap.values()) r.kgDiff = r.kgSold - r.kgBought;
  // payments-only days still count as activity for the cash/bank books, but the daily summary keeps sales/purchase/expense days
  const daily = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // ---- cash and bank books
  const moneyBook = (method: 'Cash' | 'Bank', opening: number): MoneyBook => {
    const m = new Map<string, MoneyBookRow>();
    const row = (date: string) => {
      let r = m.get(date);
      if (!r) {
        r = { date, salesIn: 0, customerPayments: 0, totalIn: 0, purchasesPaid: 0, supplierPayments: 0, wages: 0, expenses: 0, totalOut: 0, balance: 0 };
        m.set(date, r);
      }
      return r;
    };
    for (const s of data.sale) if (s.payment === method) row(s.date).salesIn += sc(s).received;
    for (const p of data.cpay) if (p.method === method) row(p.date).customerPayments += Number(p.amount) || 0;
    for (const p of data.purchase) if (p.payment === method) row(p.date).purchasesPaid += pc(p).paid;
    for (const p of data.spay) if (p.method === method) row(p.date).supplierPayments += Number(p.amount) || 0;
    for (const w of data.wage) if (w.method === method) row(w.date).wages += wc(w).total;
    for (const e of data.expense) if (e.method === method) row(e.date).expenses += Number(e.amount) || 0;
    const rows = [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
    const entry = (e: Omit<MoneyBookEntry, 'balance'>): MoneyBookEntry => ({ ...e, balance: 0 });
    const entries: MoneyBookEntry[] = [
      ...data.sale
        .filter((s) => s.payment === method)
        .map((s) => {
          const c = sc(s);
          const part = Math.abs(c.credit) > 0.0001 ? ` · part-paid, ${amt(c.credit)} on credit` : '';
          return entry({ id: s.id, date: s.date, type: 'Sale', ref: s.invoice, party: s.customer, details: `${s.kg} kg ${s.chickenType || ''} @ ${s.price}${part}`, in: c.received, out: 0 });
        }),
      ...data.cpay
        .filter((p) => p.method === method)
        .map((p) => entry({ id: p.id, date: p.date, type: 'Customer payment', ref: p.ref, party: p.customer, details: 'Payment received', in: Number(p.amount) || 0, out: 0 })),
      ...data.purchase
        .filter((p) => p.payment === method)
        .map((p) => {
          const c = pc(p);
          const part = Math.abs(c.balance) > 0.0001 ? ` · part-paid, ${amt(c.balance)} owed` : '';
          return entry({ id: p.id, date: p.date, type: 'Purchase', ref: p.invoice, party: p.supplier, details: `${p.kg} kg ${p.chickenType || ''} @ ${p.cost}${part}`, in: 0, out: c.paid });
        }),
      ...data.spay
        .filter((p) => p.method === method)
        .map((p) => entry({ id: p.id, date: p.date, type: 'Supplier payment', ref: p.ref, party: p.supplier, details: 'Payment made', in: 0, out: Number(p.amount) || 0 })),
      ...data.wage
        .filter((w) => w.method === method)
        .map((w) => entry({ id: w.id, date: w.date, type: 'Wages', ref: '', party: w.employee, details: w.workType || w.basis, in: 0, out: wc(w).total })),
      ...data.expense
        .filter((e) => e.method === method)
        .map((e) => entry({ id: e.id, date: e.date, type: 'Expense', ref: '', party: e.category, details: e.description, in: 0, out: Number(e.amount) || 0 })),
    ].sort((a, b) => a.date.localeCompare(b.date) || Number(b.in > 0) - Number(a.in > 0));
    let running = opening;
    for (const e of entries) {
      running += e.in - e.out;
      e.balance = running;
    }
    let bal = opening;
    let lowest = opening;
    let totalIn = 0;
    let totalOut = 0;
    for (const r of rows) {
      r.totalIn = r.salesIn + r.customerPayments;
      r.totalOut = r.purchasesPaid + r.supplierPayments + r.wages + r.expenses;
      bal += r.totalIn - r.totalOut;
      r.balance = bal;
      lowest = Math.min(lowest, bal);
      totalIn += r.totalIn;
      totalOut += r.totalOut;
    }
    return {
      method,
      opening,
      rows,
      entries,
      totalIn,
      totalOut,
      closing: bal,
      lowest,
      balanceAt(date: string) {
        let b = opening;
        for (const r of rows) {
          if (r.date > date) break;
          b = r.balance;
        }
        return b;
      },
    };
  };
  const cash = moneyBook('Cash', Number(business.openingCash) || 0);
  const bank = moneyBook('Bank', Number(business.openingBank) || 0);

  // ---- stock (kg) per chicken type
  const stock: StockRow[] = chickenTypes.map((type) => {
    const st = business.stock?.[type];
    const opening = Number(st?.opening) || 0;
    const purchased = sumBy(data.purchase.filter((p) => key(p.chickenType || '') === key(type)), (p) => Number(p.kg) || 0);
    const sold = sumBy(data.sale.filter((s) => key(s.chickenType || '') === key(type)), (s) => Number(s.kg) || 0);
    const available = opening + purchased;
    const closing = available - sold;
    const physical = st?.physical === null || st?.physical === undefined || (st.physical as unknown) === '' ? null : Number(st.physical);
    const diff = physical === null ? null : physical - closing;
    const diffPct = diff === null || available === 0 ? null : diff / available;
    return { type, opening, purchased, available, sold, closing, physical, diff, diffPct };
  });

  // ---- debtors and creditors
  const custOpening = new Map(data.customer.map((c) => [key(c.name), Number(c.opening) || 0]));
  const suppOpening = new Map(data.supplier.map((c) => [key(c.name), Number(c.opening) || 0]));
  const debtors: BalanceRow[] = customerNames.map((name) => {
    const k = key(name);
    const opening = custOpening.get(k) ?? 0;
    const credit = sumBy(data.sale.filter((s) => key(s.customer) === k), (s) => sc(s).credit);
    const payments = sumBy(data.cpay.filter((p) => key(p.customer) === k), (p) => Number(p.amount) || 0);
    return { name, opening, credit, payments, balance: opening + credit - payments };
  });
  const creditors: BalanceRow[] = supplierNames.map((name) => {
    const k = key(name);
    const opening = suppOpening.get(k) ?? 0;
    const credit = sumBy(data.purchase.filter((p) => key(p.supplier) === k), (p) => pc(p).balance);
    const payments = sumBy(data.spay.filter((p) => key(p.supplier) === k), (p) => Number(p.amount) || 0);
    return { name, opening, credit, payments, balance: opening + credit - payments };
  });
  const debtorMap = new Map(debtors.map((d) => [key(d.name), d.balance]));
  const creditorMap = new Map(creditors.map((d) => [key(d.name), d.balance]));

  // ---- monthly summary
  const totalKgBought = sumBy(data.purchase, (p) => Number(p.kg) || 0);
  const totalPurchaseCost = sumBy(data.purchase, (p) => pc(p).total);
  const periodAvgCost = totalKgBought > 0 ? totalPurchaseCost / totalKgBought : 0;
  const totalCustOpening = sumBy(data.customer, (c) => Number(c.opening) || 0);
  const totalSuppOpening = sumBy(data.supplier, (c) => Number(c.opening) || 0);

  const monthly: MonthlyRow[] = months.map((month) => {
    const inM = (d: string) => monthKey(d) === month;
    const sales = data.sale.filter((s) => inM(s.date));
    const purchases = data.purchase.filter((p) => inM(p.date));
    const kgBought = sumBy(purchases, (p) => Number(p.kg) || 0);
    const kgSold = sumBy(sales, (s) => Number(s.kg) || 0);
    const netSales = sumBy(sales, (s) => sc(s).net);
    const purchaseCost = sumBy(purchases, (p) => pc(p).total);
    const avgCostFromPeriod = !(kgBought > 0);
    const avgCost = kgBought > 0 ? purchaseCost / kgBought : periodAvgCost;
    const cogs = kgSold * avgCost;
    const grossProfit = netSales - cogs;
    const otherExpenses = sumBy(data.expense.filter((e) => inM(e.date)), (e) => Number(e.amount) || 0);
    const wages = sumBy(data.wage.filter((w) => inM(w.date)), (w) => wc(w).total);
    const expenses = otherExpenses + wages;
    const end = monthEnd(month) < business.periodEnd ? monthEnd(month) : business.periodEnd;
    const upTo = (d: string) => d <= end;
    const debtorsAt =
      totalCustOpening +
      sumBy(data.sale.filter((s) => upTo(s.date)), (s) => sc(s).credit) -
      sumBy(data.cpay.filter((p) => upTo(p.date)), (p) => Number(p.amount) || 0);
    const creditorsAt =
      totalSuppOpening +
      sumBy(data.purchase.filter((p) => upTo(p.date)), (p) => pc(p).balance) -
      sumBy(data.spay.filter((p) => upTo(p.date)), (p) => Number(p.amount) || 0);
    return {
      month,
      kgBought,
      kgSold,
      netSales,
      purchases: purchaseCost,
      avgCost,
      avgCostFromPeriod,
      cogs,
      grossProfit,
      expenses,
      wages,
      otherExpenses,
      netProfit: grossProfit - expenses,
      cash: cash.balanceAt(end),
      bank: bank.balanceAt(end),
      debtors: debtorsAt,
      creditors: creditorsAt,
    };
  });
  const last = monthly[monthly.length - 1];
  const monthlyTotals = {
    kgBought: sumBy(monthly, (m) => m.kgBought),
    kgSold: sumBy(monthly, (m) => m.kgSold),
    netSales: sumBy(monthly, (m) => m.netSales),
    purchases: sumBy(monthly, (m) => m.purchases),
    avgCost: periodAvgCost,
    cogs: sumBy(monthly, (m) => m.cogs),
    grossProfit: sumBy(monthly, (m) => m.grossProfit),
    expenses: sumBy(monthly, (m) => m.expenses),
    wages: sumBy(monthly, (m) => m.wages),
    otherExpenses: sumBy(monthly, (m) => m.otherExpenses),
    netProfit: sumBy(monthly, (m) => m.netProfit),
    cash: last?.cash ?? cash.closing,
    bank: last?.bank ?? bank.closing,
    debtors: last?.debtors ?? 0,
    creditors: last?.creditors ?? 0,
  };

  // ---- customer monthly
  const customerMonthly = (name: string): CustomerMonthly => {
    const k = key(name);
    const sales = data.sale.filter((s) => key(s.customer) === k);
    const pays = data.cpay.filter((p) => key(p.customer) === k);
    const opening = custOpening.get(k) ?? 0;
    const rows: CustomerMonthRow[] = months.map((month) => {
      const ms = sales.filter((s) => monthKey(s.date) === month);
      const kgSum = sumBy(ms, (s) => Number(s.kg) || 0);
      const gross = sumBy(ms, (s) => sc(s).gross);
      const end = monthEnd(month);
      return {
        month,
        lines: ms.length,
        kg: kgSum,
        gross,
        discount: sumBy(ms, (s) => sc(s).discount),
        net: sumBy(ms, (s) => sc(s).net),
        avgPrice: kgSum > 0 ? gross / kgSum : 0,
        paidAtSale: sumBy(ms, (s) => sc(s).received),
        credit: sumBy(ms, (s) => sc(s).credit),
        payments: sumBy(pays.filter((p) => monthKey(p.date) === month), (p) => Number(p.amount) || 0),
        balance:
          opening +
          sumBy(sales.filter((s) => s.date <= end), (s) => sc(s).credit) -
          sumBy(pays.filter((p) => p.date <= end), (p) => Number(p.amount) || 0),
      };
    });
    const tKg = sumBy(rows, (r) => r.kg);
    const tGross = sumBy(rows, (r) => r.gross);
    return {
      name,
      opening,
      balanceNow: debtorMap.get(k) ?? opening,
      rows,
      totals: {
        lines: sumBy(rows, (r) => r.lines),
        kg: tKg,
        gross: tGross,
        discount: sumBy(rows, (r) => r.discount),
        net: sumBy(rows, (r) => r.net),
        avgPrice: tKg > 0 ? tGross / tKg : 0,
        paidAtSale: sumBy(rows, (r) => r.paidAtSale),
        credit: sumBy(rows, (r) => r.credit),
        payments: sumBy(rows, (r) => r.payments),
      },
    };
  };

  const customerGrid: GridRow[] = customerNames.map((name) => {
    const k = key(name);
    const sales = data.sale.filter((s) => key(s.customer) === k);
    return {
      name,
      byMonth: months.map((m) => sumBy(sales.filter((s) => monthKey(s.date) === m), (s) => sc(s).net)),
      kg: sumBy(sales, (s) => Number(s.kg) || 0),
      net: sumBy(sales, (s) => sc(s).net),
      balance: debtorMap.get(k) ?? 0,
    };
  });

  // ---- accounts (ledgers)
  const ledger = (
    opening: number,
    inc: { date: string; description: string; ref: string; amount: number }[],
    dec: { date: string; description: string; ref: string; amount: number }[],
  ) => {
    const items = [
      ...inc.map((i) => ({ ...i, increase: i.amount, decrease: 0, order: 0 })),
      ...dec.map((i) => ({ ...i, increase: 0, decrease: i.amount, order: 1 })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    let bal = opening;
    const lines: LedgerLine[] = items.map((i) => {
      bal += i.increase - i.decrease;
      return { date: i.date, description: i.description, ref: i.ref, increase: i.increase, decrease: i.decrease, balance: bal };
    });
    return { opening, lines, balance: bal };
  };

  const customerLedger = (name: string) => {
    const k = key(name);
    return ledger(
      custOpening.get(k) ?? 0,
      data.sale
        .filter((s) => key(s.customer) === k && Math.abs(sc(s).credit) > 0.0001)
        .map((s: Sale) => ({
          date: s.date,
          description: `${s.payment === 'Credit' ? 'Credit sale' : 'Part-paid sale'} · ${s.kg} kg ${s.chickenType || ''}`.trim(),
          ref: s.invoice,
          amount: sc(s).credit,
        })),
      data.cpay
        .filter((p) => key(p.customer) === k)
        .map((p: CustomerPayment) => ({ date: p.date, description: `Payment (${p.method})`, ref: p.ref, amount: Number(p.amount) || 0 })),
    );
  };

  const supplierLedger = (name: string) => {
    const k = key(name);
    return ledger(
      suppOpening.get(k) ?? 0,
      data.purchase
        .filter((p) => key(p.supplier) === k && Math.abs(pc(p).balance) > 0.0001)
        .map((p: Purchase) => ({
          date: p.date,
          description: `${p.payment === 'Credit' ? 'Credit purchase' : 'Part-paid purchase'} · ${p.kg} kg ${p.chickenType || ''}`.trim(),
          ref: p.invoice,
          amount: pc(p).balance,
        })),
      data.spay
        .filter((p) => key(p.supplier) === k)
        .map((p: SupplierPayment) => ({ date: p.date, description: `Payment (${p.method})`, ref: p.ref, amount: Number(p.amount) || 0 })),
    );
  };

  return {
    business,
    data,
    months,
    saleCalcs,
    purchaseCalcs,
    wageCalcs,
    customerNames,
    supplierNames,
    employeeNames,
    chickenTypes,
    expenseCategories,
    workTypes,
    daily,
    cash,
    bank,
    stock,
    debtors,
    creditors,
    monthly,
    monthlyTotals,
    periodAvgCost,
    customerBalance: (name) => debtorMap.get(key(name)) ?? custOpening.get(key(name)) ?? 0,
    supplierBalance: (name) => creditorMap.get(key(name)) ?? suppOpening.get(key(name)) ?? 0,
    customerMonthly,
    customerGrid,
    customerLedger,
    supplierLedger,
  };
}

// ---------------------------------------------------------------- dashboard

export interface DashboardFigures {
  netSales: number;
  kgSold: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  netMarginPct: number;
  kgBought: number;
  purchases: number;
  cash: number;
  bank: number;
  customersOwe: number;
  owedToSuppliers: number;
  todaySales: number;
  todayKg: number;
}

/** month = null for the whole period. */
export function dashboardFigures(b: Books, month: string | null, today: string): DashboardFigures {
  const rows = month ? b.monthly.filter((m) => m.month === month) : b.monthly;
  const netSales = sumBy(rows, (r) => r.netSales);
  const netProfit = sumBy(rows, (r) => r.netProfit);
  const m = month ? rows[0] : undefined;
  const todaySales = b.data.sale.filter((s) => s.date === today);
  return {
    netSales,
    kgSold: sumBy(rows, (r) => r.kgSold),
    grossProfit: sumBy(rows, (r) => r.grossProfit),
    expenses: sumBy(rows, (r) => r.expenses),
    netProfit,
    netMarginPct: netSales ? (netProfit / netSales) * 100 : 0,
    kgBought: sumBy(rows, (r) => r.kgBought),
    purchases: sumBy(rows, (r) => r.purchases),
    cash: m ? m.cash : b.cash.closing,
    bank: m ? m.bank : b.bank.closing,
    customersOwe: m ? m.debtors : sumBy(b.debtors, (d) => d.balance),
    owedToSuppliers: m ? m.creditors : sumBy(b.creditors, (d) => d.balance),
    todaySales: sumBy(todaySales, (s) => b.saleCalcs.get(s.id)!.net),
    todayKg: sumBy(todaySales, (s) => Number(s.kg) || 0),
  };
}

