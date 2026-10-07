// Input cleaning and validation shared by the forms and the API (requirements 7.3, 4.13).

import { isISODate, periodMonthCount } from './dates';
import { CASH_BANK, DISCOUNT_TYPES, MAX_PERIOD_MONTHS, PAY_BASES, PAY_METHODS } from './defaults';
import { fmtDate } from './dates';
import { purchaseCalc, saleCalc } from './calc';
import type { AnyRecord, Business, Kind, Lists, StockSetting } from './types';
import { isMasterKind, isTxKind } from './types';

type Obj = Record<string, unknown>;

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : v == null ? '' : String(v).trim().slice(0, max));
const n = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return NaN;
  const x = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return isFinite(x) ? x : NaN;
};
const n0 = (v: unknown) => {
  const x = n(v);
  return isNaN(x) ? 0 : x;
};
const oneOf = <T extends string>(v: unknown, opts: readonly T[], dflt: T): T => (opts.includes(v as T) ? (v as T) : dflt);

export interface CleanResult {
  record: AnyRecord | null;
  errors: Record<string, string>;
}

/**
 * Cleans raw input into a record of `kind`. Does not check name uniqueness (needs the other records).
 * `period` enables the in-period date check for transactions.
 */
export function cleanRecord(kind: Kind, raw: Obj, period?: Pick<Business, 'periodStart' | 'periodEnd'>): CleanResult {
  const errors: Record<string, string> = {};
  const id = str(raw.id, 64);
  const need = (field: string, ok: boolean, msg = 'Required') => {
    if (!ok) errors[field] = msg;
  };
  const date = str(raw.date, 10);
  const checkDate = () => {
    if (!isISODate(date)) {
      errors.date = 'Enter a valid date';
      return;
    }
    if (period && (date < period.periodStart || date > period.periodEnd)) {
      errors.date = `Date is outside the period ${fmtDate(period.periodStart)} – ${fmtDate(period.periodEnd)}. Change the date or the period in Client settings.`;
    }
  };
  const positive = (field: string, v: number, label = 'Enter a number') => {
    if (isNaN(v)) errors[field] = label;
    else if (v < 0) errors[field] = 'Cannot be negative';
  };

  let record: AnyRecord | null = null;
  switch (kind) {
    case 'customer': {
      const name = str(raw.name, 120);
      need('name', !!name);
      record = { id, kind, code: str(raw.code, 20), name, phone: str(raw.phone, 40), address: str(raw.address), opening: n0(raw.opening), active: raw.active !== false && raw.active !== 'No' };
      break;
    }
    case 'supplier': {
      const name = str(raw.name, 120);
      need('name', !!name);
      record = { id, kind, code: str(raw.code, 20), name, phone: str(raw.phone, 40), address: str(raw.address), opening: n0(raw.opening) };
      break;
    }
    case 'employee': {
      const name = str(raw.name, 120);
      need('name', !!name);
      record = { id, kind, code: str(raw.code, 20), name, position: str(raw.position, 60), basis: oneOf(raw.basis, PAY_BASES, 'Daily'), rate: n0(raw.rate), phone: str(raw.phone, 40), active: raw.active !== false && raw.active !== 'No' };
      break;
    }
    case 'sale': {
      checkDate();
      const customer = str(raw.customer, 120);
      need('customer', !!customer);
      const kg = n(raw.kg);
      const price = n(raw.price);
      positive('kg', kg);
      positive('price', price);
      if (!isNaN(kg) && kg === 0) errors.kg = 'Kg must be more than 0';
      const discType = oneOf(raw.discType, DISCOUNT_TYPES, 'None');
      const discValue = discType === 'None' ? 0 : n0(raw.discValue);
      if (discValue < 0) errors.discValue = 'Cannot be negative';
      const payment = oneOf(raw.payment, PAY_METHODS, 'Cash');
      const base = { kg: n0(kg), price: n0(price), discType, discValue, payment, received: 0 };
      const net = saleCalc(base).net;
      let received = 0;
      if (payment !== 'Credit') {
        const r = n(raw.received);
        received = isNaN(r) ? net : r;
        if (received < 0) errors.received = 'Cannot be negative';
      }
      record = { id, kind, date, invoice: str(raw.invoice, 40), customer, chickenType: str(raw.chickenType, 60), ...base, received };
      break;
    }
    case 'purchase': {
      checkDate();
      const supplier = str(raw.supplier, 120);
      need('supplier', !!supplier);
      const kg = n(raw.kg);
      const cost = n(raw.cost);
      positive('kg', kg);
      positive('cost', cost);
      if (!isNaN(kg) && kg === 0) errors.kg = 'Kg must be more than 0';
      const otherCost = n0(raw.otherCost);
      if (otherCost < 0) errors.otherCost = 'Cannot be negative';
      const payment = oneOf(raw.payment, PAY_METHODS, 'Cash');
      const base = { kg: n0(kg), cost: n0(cost), otherCost, payment, paid: 0 };
      const total = purchaseCalc(base).total;
      let paid = 0;
      if (payment !== 'Credit') {
        const r = n(raw.paid);
        paid = isNaN(r) ? total : r;
        if (paid < 0) errors.paid = 'Cannot be negative';
      }
      record = { id, kind, date, supplier, invoice: str(raw.invoice, 40), chickenType: str(raw.chickenType, 60), ...base, paid };
      break;
    }
    case 'cpay':
    case 'spay': {
      checkDate();
      const who = kind === 'cpay' ? 'customer' : 'supplier';
      const name = str(raw[who], 120);
      need(who, !!name);
      const amount = n(raw.amount);
      positive('amount', amount);
      if (!isNaN(amount) && amount === 0) errors.amount = 'Amount must be more than 0';
      const method = oneOf(raw.method, CASH_BANK, 'Cash');
      record =
        kind === 'cpay'
          ? { id, kind, date, customer: name, method, amount: n0(amount), ref: str(raw.ref) }
          : { id, kind, date, supplier: name, method, amount: n0(amount), ref: str(raw.ref) };
      break;
    }
    case 'wage': {
      checkDate();
      const employee = str(raw.employee, 120);
      need('employee', !!employee);
      const qty = n(raw.qty);
      const rate = n(raw.rate);
      positive('qty', qty);
      positive('rate', rate);
      const otherPay = n0(raw.otherPay);
      if (otherPay < 0) errors.otherPay = 'Cannot be negative';
      record = {
        id,
        kind,
        date,
        employee,
        workType: str(raw.workType, 60),
        basis: oneOf(raw.basis, PAY_BASES, 'Daily'),
        qty: n0(qty),
        rate: n0(rate),
        otherPay,
        method: oneOf(raw.method, CASH_BANK, 'Cash'),
      };
      break;
    }
    case 'expense': {
      checkDate();
      const amount = n(raw.amount);
      positive('amount', amount);
      if (!isNaN(amount) && amount === 0) errors.amount = 'Amount must be more than 0';
      record = { id, kind, date, category: str(raw.category, 60) || 'Other', description: str(raw.description), method: oneOf(raw.method, CASH_BANK, 'Cash'), amount: n0(amount) };
      break;
    }
    default:
      errors._ = 'Unknown entry type';
  }
  return { record, errors };
}

export function nameClash(kind: Kind, name: string, id: string, existing: { id: string; name: string }[]): boolean {
  if (!isMasterKind(kind)) return false;
  const k = name.trim().toLowerCase();
  return existing.some((r) => r.id !== id && r.name.trim().toLowerCase() === k);
}

const cleanList = (v: unknown, fallback: string[]) => {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : fallback;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const t = str(x, 60);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.length ? out : fallback;
};

/** Cleans editable client settings. */
export function cleanBusiness(raw: Obj, current: Business): { business: Business; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(raw, k);
  const b: Business = { ...current };
  for (const f of ['name', 'owner', 'type', 'address', 'phone', 'email', 'preparedBy'] as const) if (has(f)) b[f] = str(raw[f], 200);
  if (has('periodStart')) b.periodStart = str(raw.periodStart, 10);
  if (has('periodEnd')) b.periodEnd = str(raw.periodEnd, 10);
  if (has('openingCash')) b.openingCash = n0(raw.openingCash);
  if (has('openingBank')) b.openingBank = n0(raw.openingBank);
  if (has('lists') && raw.lists && typeof raw.lists === 'object') {
    const l = raw.lists as Obj;
    const lists: Lists = {
      chickenTypes: cleanList(l.chickenTypes, current.lists.chickenTypes),
      expenseCategories: cleanList(l.expenseCategories, current.lists.expenseCategories),
      workTypes: cleanList(l.workTypes, current.lists.workTypes),
    };
    b.lists = lists;
  }
  if (has('stock') && raw.stock && typeof raw.stock === 'object') {
    const stock: Record<string, StockSetting> = {};
    for (const [k, v] of Object.entries(raw.stock as Obj).slice(0, 200)) {
      const o = (v ?? {}) as Obj;
      const phys = n(o.physical);
      stock[str(k, 60)] = { opening: n0(o.opening), physical: isNaN(phys) ? null : phys };
    }
    b.stock = stock;
  }
  if (!b.name) errors.name = 'Business name is required';
  errors.period = periodError(b.periodStart, b.periodEnd) ?? '';
  if (!errors.period) delete errors.period;
  return { business: b, errors };
}

export function periodError(start: string, end: string): string | null {
  if (!isISODate(start) || !isISODate(end)) return 'Enter valid period dates';
  if (end < start) return 'Period end must be after period start';
  if (periodMonthCount(start, end) > MAX_PERIOD_MONTHS) return `The period can be at most ${MAX_PERIOD_MONTHS} months`;
  return null;
}

export { isTxKind };
