// Builds the 21-sheet accounting workbook (requirements section 6) with live formulas.
// Works in the browser (dynamic import of exceljs) and in Node (scripts/make-template.ts).

import type { Cell, Workbook, Worksheet } from 'exceljs';
import { computeBooks } from './calc';
import { daysBetween, monthsBetween, parseISO, todayISO } from './dates';
import { CASH_BANK, EXCEL_DISCOUNT_TYPES, PAY_BASES, PAY_METHODS, defaultLists, defaultPeriod } from './defaults';
import type { BookData, Business, Customer, Employee, Supplier } from './types';
import { emptyBookData } from './types';

type ExcelJSModule = { Workbook: new () => Workbook };

// ---------------------------------------------------------------- sheet names and layout

export const SHEETS = {
  instr: 'Instructions',
  dash: 'Dashboard',
  client: 'Client Information',
  cust: 'Customers',
  supp: 'Suppliers',
  emp: 'Employees',
  sales: 'Sales',
  cpay: 'Customer Payments',
  purch: 'Purchases',
  spay: 'Supplier Payments',
  wage: 'Employee Pay',
  exp: 'Expenses',
  daily: 'Daily Summary',
  cash: 'Cash Book',
  bank: 'Bank',
  stock: 'Stock Summary',
  debt: 'Customer Debtors',
  cm: 'Customer Monthly',
  cred: 'Supplier Creditors',
  monthly: 'Monthly Summary',
  lists: 'Lists',
} as const;

const HEADER_ROW = 4;
const DS = 5; // first data row on entry / master sheets
const START = `'${SHEETS.client}'!$B$10`;
const END = `'${SHEETS.client}'!$B$11`;
const OPEN_CASH = `'${SHEETS.client}'!$B$12`;
const OPEN_BANK = `'${SHEETS.client}'!$B$13`;

// ---------------------------------------------------------------- styles

const FONT = 'Arial';
const BLUE = 'FF0000FF';
const GREEN = 'FF008000';
const BLACK = 'FF000000';
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } } as const;
const GREY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } } as const;
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } } as const;
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } } as const;
const THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } } as const;
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export const FMT = {
  amt: '#,##0;(#,##0);"–"',
  rate: '#,##0.00;(#,##0.00);"–"',
  kg: '#,##0.00;(#,##0.00);"–"',
  pct: '0.0%;(0.0%);"–"',
  date: 'dd/mm/yyyy',
  month: 'mmm yyyy',
  inNum: '#,##0.00',
  text: '@',
};

/** Data validation on a cell or range ("C5:C2004"); exceljs supports this at runtime but omits it from its typings. */
function dv(ws: Worksheet, address: string, validation: Record<string, unknown>) {
  (ws as unknown as { dataValidations: { add(a: string, v: unknown): void } }).dataValidations.add(address, validation);
}

function input(c: Cell, numFmt?: string) {
  c.font = { name: FONT, size: 10, color: { argb: BLUE } };
  c.fill = YELLOW_FILL;
  c.border = BORDER;
  if (numFmt) c.numFmt = numFmt;
}

function calc(c: Cell, numFmt?: string, cross = false, bold = false) {
  c.font = { name: FONT, size: 10, color: { argb: cross ? GREEN : BLACK }, bold };
  c.fill = GREY_FILL;
  c.border = BORDER;
  if (numFmt) c.numFmt = numFmt;
}

function f(c: Cell, formula: string, numFmt?: string, cross = false, bold = false) {
  c.value = { formula } as never;
  calc(c, numFmt, cross, bold);
}

function plain(c: Cell, value: unknown, opts: { bold?: boolean; size?: number; italic?: boolean; color?: string } = {}) {
  c.value = value as never;
  c.font = { name: FONT, size: opts.size ?? 10, bold: opts.bold, italic: opts.italic, color: { argb: opts.color ?? BLACK } };
}

function title(ws: Worksheet, text: string, notes: string[] = [], width = 10) {
  plain(ws.getCell('A1'), text, { bold: true, size: 14, color: 'FF1F4E78' });
  notes.slice(0, 2).forEach((n, i) => {
    const c = ws.getCell(2 + i, 1);
    plain(c, n, { italic: true, size: 9, color: 'FF595959' });
    if (width > 1) ws.mergeCells(2 + i, 1, 2 + i, width);
    c.alignment = { wrapText: true, vertical: 'top' };
  });
  if (notes.length) {
    ws.getRow(2).height = 26;
    if (notes.length > 1) ws.getRow(3).height = 26;
  }
}

function header(ws: Worksheet, row: number, cols: [string, number][], startCol = 1) {
  cols.forEach(([label, width], i) => {
    const c = ws.getCell(row, startCol + i);
    c.value = label;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = HEAD_FILL;
    c.border = BORDER;
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    const col = ws.getColumn(startCol + i);
    if (!col.width || col.width < width) col.width = width;
  });
  ws.getRow(row).height = 30;
}

function totalStyle(c: Cell) {
  c.fill = TOTAL_FILL;
  c.font = { ...(c.font ?? {}), name: FONT, size: 10, bold: true };
}

const col = (n: number) => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const xlDate = (iso: string) => parseISO(iso); // UTC midnight → exact Excel serial

// ---------------------------------------------------------------- capacities

interface Capacity {
  sales: number;
  cpay: number;
  purch: number;
  spay: number;
  wage: number;
  exp: number;
  cust: number;
  supp: number;
  emp: number;
  days: number;
  months: number;
  list: number;
}

function capacities(b: Business, d: BookData, blank: boolean): Capacity {
  const dayCount = daysBetween(b.periodStart, b.periodEnd).length;
  const monthCount = monthsBetween(b.periodStart, b.periodEnd).length;
  return {
    sales: Math.max(2000, d.sale.length + 500),
    cpay: Math.max(1000, d.cpay.length + 300),
    purch: Math.max(1000, d.purchase.length + 300),
    spay: Math.max(1000, d.spay.length + 300),
    wage: Math.max(1000, d.wage.length + 300),
    exp: Math.max(1000, d.expense.length + 300),
    cust: Math.max(200, d.customer.length + 50),
    supp: Math.max(100, d.supplier.length + 30),
    emp: Math.max(100, d.employee.length + 30),
    days: blank ? Math.max(366, dayCount) : dayCount,
    months: blank ? Math.max(12, monthCount) : monthCount,
    list: Math.max(15, b.lists.chickenTypes.length, b.lists.expenseCategories.length, b.lists.workTypes.length, PAY_BASES.length) + (blank ? 0 : 5),
  };
}

// ---------------------------------------------------------------- export preparation

/** Fills in names used in entries but missing from master lists, and list items used in entries (requirements 7.5). */
export function prepareExport(business: Business, all: BookData): { business: Business; data: BookData } {
  const books = computeBooks(business, all);
  const data = books.data;
  const key = (s: string) => s.trim().toLowerCase();

  const customers: Customer[] = [...data.customer];
  const haveC = new Set(customers.map((c) => key(c.name)));
  for (const n of books.customerNames)
    if (!haveC.has(key(n))) customers.push({ id: `auto-c-${customers.length}`, kind: 'customer', code: '', name: n, phone: '', address: '', opening: 0, active: true });

  const suppliers: Supplier[] = [...data.supplier];
  const haveS = new Set(suppliers.map((c) => key(c.name)));
  for (const n of books.supplierNames)
    if (!haveS.has(key(n))) suppliers.push({ id: `auto-s-${suppliers.length}`, kind: 'supplier', code: '', name: n, phone: '', address: '', opening: 0 });

  const employees: Employee[] = [...data.employee];
  const haveE = new Set(employees.map((c) => key(c.name)));
  for (const n of books.employeeNames)
    if (!haveE.has(key(n))) {
      const w = data.wage.find((x) => key(x.employee) === key(n));
      employees.push({ id: `auto-e-${employees.length}`, kind: 'employee', code: '', name: n, position: w?.workType ?? '', basis: w?.basis ?? 'Daily', rate: w?.rate ?? 0, phone: '', active: true });
    }

  const code = <T extends { code: string }>(rows: T[], prefix: string) =>
    rows.map((r, i) => ({ ...r, code: r.code || `${prefix}${String(i + 1).padStart(3, '0')}` }));

  return {
    business: {
      ...business,
      lists: { chickenTypes: books.chickenTypes, expenseCategories: books.expenseCategories, workTypes: books.workTypes },
    },
    data: { ...data, customer: code(customers, 'C'), supplier: code(suppliers, 'S'), employee: code(employees, 'E') },
  };
}

export function exportFileName(business: Business | null, today = todayISO()): string {
  const safe = (business?.name || 'Chicken-Wholesale').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 60);
  return business ? `${safe}-accounts-${today}.xlsx` : 'Chicken-Wholesale-Accounts-Template.xlsx';
}

// ---------------------------------------------------------------- the builder

export interface BuildOptions {
  business?: Business | null; // null → blank template
  data?: BookData | null;
}

export function buildWorkbook(ExcelJS: ExcelJSModule, opts: BuildOptions = {}): Workbook {
  const blank = !opts.business;
  let business: Business;
  let data: BookData;
  if (opts.business) {
    const prepared = prepareExport(opts.business, opts.data ?? emptyBookData());
    business = prepared.business;
    data = prepared.data;
  } else {
    business = {
      id: '',
      name: '',
      owner: '',
      type: 'Chicken Wholesale',
      address: '',
      phone: '',
      email: '',
      preparedBy: '',
      ...defaultPeriod(),
      openingCash: 0,
      openingBank: 0,
      lists: defaultLists(),
      stock: {},
      members: [],
    };
    data = emptyBookData();
  }
  const cap = capacities(business, data, blank);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Chicken Wholesale Books';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const ws: Record<keyof typeof SHEETS, Worksheet> = {} as never;
  (Object.keys(SHEETS) as (keyof typeof SHEETS)[]).forEach((k) => {
    ws[k] = wb.addWorksheet(SHEETS[k], { properties: { defaultRowHeight: 15 } });
  });
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: 'visible' }];

  // Last rows of each input range
  const last = {
    sales: DS + cap.sales - 1,
    cpay: DS + cap.cpay - 1,
    purch: DS + cap.purch - 1,
    spay: DS + cap.spay - 1,
    wage: DS + cap.wage - 1,
    exp: DS + cap.exp - 1,
    cust: DS + cap.cust - 1,
    supp: DS + cap.supp - 1,
    emp: DS + cap.emp - 1,
  };
  const LIST_FIRST = 4;
  const LIST_LAST = LIST_FIRST + cap.list - 1;

  const R = (sheet: keyof typeof SHEETS, c: string, lastRow: number, firstRow = DS) => `'${SHEETS[sheet]}'!$${c}$${firstRow}:$${c}$${lastRow}`;
  const S = (c: string) => R('sales', c, last.sales);
  const P = (c: string) => R('purch', c, last.purch);
  const CP = (c: string) => R('cpay', c, last.cpay);
  const SP = (c: string) => R('spay', c, last.spay);
  const EP = (c: string) => R('wage', c, last.wage);
  const EX = (c: string) => R('exp', c, last.exp);
  const LIST = (c: string) => `'${SHEETS.lists}'!$${c}$${LIST_FIRST}:$${c}$${LIST_LAST}`;
  const PERIOD = (dateRange: string) => `${dateRange},">="&${START},${dateRange},"<="&${END}`;

  const listDV = (formula: string, strict: boolean) => ({
    type: 'list' as const,
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: strict ? ('stop' as const) : ('warning' as const),
    errorTitle: 'Not in the list',
    error: strict ? 'Choose a value from the drop-down list.' : 'This name is not in the master list. Add it there so it appears in the reports by name.',
  });
  const dateDV = { type: 'date' as const, operator: 'between' as const, allowBlank: true, formulae: [START, END], showErrorMessage: true, errorStyle: 'warning' as const, errorTitle: 'Date outside the period', error: 'This date is outside the accounting period on Client Information. It will not appear in the reports.' };
  const numDV = { type: 'decimal' as const, operator: 'greaterThanOrEqual' as const, allowBlank: true, formulae: [0], showErrorMessage: true, errorStyle: 'stop' as const, errorTitle: 'Number needed', error: 'Type a number that is 0 or more.' };

  const NAMES = {
    cust: `'${SHEETS.cust}'!$B$${DS}:$B$${last.cust}`,
    supp: `'${SHEETS.supp}'!$B$${DS}:$B$${last.supp}`,
    emp: `'${SHEETS.emp}'!$B$${DS}:$B$${last.emp}`,
  };

  // ============================================================ 21 Lists
  {
    const s = ws.lists;
    title(s, 'Lists — drop-down values', ['Edit or add items in the yellow cells. Drop-downs on the entry sheets read from these columns. Discount type left blank means no discount.'], 7);
    const lists: [string, string[], number][] = [
      ['Chicken Types', business.lists.chickenTypes, 22],
      ['Discount Types', EXCEL_DISCOUNT_TYPES, 16],
      ['Payment Methods', [...PAY_METHODS], 16],
      ['Cash / Bank', [...CASH_BANK], 14],
      ['Work Types', business.lists.workTypes, 18],
      ['Pay Basis', [...PAY_BASES], 16],
      ['Expense Categories', business.lists.expenseCategories, 24],
    ];
    header(s, 3, lists.map(([h, , w]) => [h, w]));
    lists.forEach(([, items], ci) => {
      for (let i = 0; i < cap.list; i++) {
        const c = s.getCell(LIST_FIRST + i, ci + 1);
        if (items[i] !== undefined) c.value = items[i];
        input(c);
      }
    });
    s.views = [{ state: 'frozen', ySplit: 3 }];
  }

  // ============================================================ 3 Client Information
  {
    const s = ws.client;
    title(s, 'Client Information', ['Type the business details and accounting period in the yellow cells. Reports only include entries dated within the period.'], 2);
    const rows: [string, unknown, string?][] = [
      ['Business name', business.name],
      ['Owner name', business.owner],
      ['Business type', business.type || 'Chicken Wholesale'],
      ['Address', business.address],
      ['Telephone', business.phone],
      ['Email', business.email],
      ['Prepared by', business.preparedBy],
      ['Period start', xlDate(business.periodStart), FMT.date],
      ['Period end', xlDate(business.periodEnd), FMT.date],
      ['Opening cash in hand (Rs.)', Number(business.openingCash) || 0, FMT.inNum],
      ['Opening bank balance (Rs.)', Number(business.openingBank) || 0, FMT.inNum],
    ];
    rows.forEach(([label, value, fmt], i) => {
      plain(s.getCell(3 + i, 1), label, { bold: true });
      const c = s.getCell(3 + i, 2);
      c.value = (value ?? '') as never;
      input(c, fmt);
    });
    s.getColumn(1).width = 30;
    s.getColumn(2).width = 40;
  }

  // ============================================================ 4–6 Masters
  {
    const s = ws.cust;
    title(s, 'Customers', ['Master list of customers. Opening Balance is what the customer owed at the period start. Names must be unique.'], 6);
    header(s, HEADER_ROW, [['ID', 8], ['Customer Name', 30], ['Phone', 16], ['Address', 30], ['Opening Balance (Rs.)', 16], ['Active (Yes/No)', 10]]);
    for (let i = 0; i < cap.cust; i++) {
      const r = DS + i;
      const c = data.customer[i];
      const vals = c ? [c.code, c.name, c.phone, c.address, Number(c.opening) || 0, c.active ? 'Yes' : 'No'] : [];
      for (let j = 0; j < 6; j++) {
        const cell = s.getCell(r, j + 1);
        if (vals[j] !== undefined && vals[j] !== '') cell.value = vals[j] as never;
        input(cell, j === 4 ? FMT.inNum : undefined);
      }
    }
    dv(s, `F${DS}:F${last.cust}`, { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] });
    dv(s, `E${DS}:E${last.cust}`, numDV);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }
  {
    const s = ws.supp;
    title(s, 'Suppliers', ['Master list of suppliers. Opening Balance is what you owed the supplier at the period start. Names must be unique.'], 5);
    header(s, HEADER_ROW, [['ID', 8], ['Supplier Name', 30], ['Phone', 16], ['Address', 30], ['Opening Balance (Rs.)', 16]]);
    for (let i = 0; i < cap.supp; i++) {
      const r = DS + i;
      const c = data.supplier[i];
      const vals = c ? [c.code, c.name, c.phone, c.address, Number(c.opening) || 0] : [];
      for (let j = 0; j < 5; j++) {
        const cell = s.getCell(r, j + 1);
        if (vals[j] !== undefined && vals[j] !== '') cell.value = vals[j] as never;
        input(cell, j === 4 ? FMT.inNum : undefined);
      }
    }
    dv(s, `E${DS}:E${last.supp}`, numDV);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }
  {
    const s = ws.emp;
    title(s, 'Employees', ['Master list of employees with their standard work type, pay basis and rate. Commission rate is a whole number (1 = 1%).'], 7);
    header(s, HEADER_ROW, [['ID', 8], ['Employee Name', 26], ['Position / Work Type', 18], ['Pay Basis', 14], ['Standard Rate', 14], ['Phone', 16], ['Active (Yes/No)', 10]]);
    for (let i = 0; i < cap.emp; i++) {
      const r = DS + i;
      const e = data.employee[i];
      const vals = e ? [e.code, e.name, e.position, e.basis, Number(e.rate) || 0, e.phone, e.active ? 'Yes' : 'No'] : [];
      for (let j = 0; j < 7; j++) {
        const cell = s.getCell(r, j + 1);
        if (vals[j] !== undefined && vals[j] !== '') cell.value = vals[j] as never;
        input(cell, j === 4 ? FMT.inNum : undefined);
      }
    }
    dv(s, `C${DS}:C${last.emp}`, listDV(LIST('E'), false));
    dv(s, `D${DS}:D${last.emp}`, listDV(LIST('F'), true));
    dv(s, `G${DS}:G${last.emp}`, { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] });
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }

  // ============================================================ 7 Sales
  {
    const s = ws.sales;
    title(
      s,
      'Sales',
      [
        'Discount Value: Amount = Rs. off the invoice; Per Kg = Rs. per kg; Percentage = whole number (5 = 5%, 0.5 = 0.5%). Leave Discount Type blank for no discount. Price/Kg is the actual price charged to this customer on this day.',
        'Amount Received: leave blank for Cash/Bank when paid in full, or type a lower amount for a part payment. Credit sales are always 0 received. Credit Added = Net Sales − Amount Received.',
      ],
      14,
    );
    header(s, HEADER_ROW, [
      ['Date', 12], ['Invoice No.', 11], ['Customer', 24], ['Chicken Type', 16], ['Kg', 10], ['Price / Kg', 11], ['Gross Sales', 13],
      ['Discount Type', 12], ['Discount Value', 10], ['Discount', 11], ['Net Sales', 13], ['Payment', 10], ['Amount Received', 13], ['Credit Added', 13],
    ]);
    const rows = [...data.sale].sort((a, b) => a.date.localeCompare(b.date) || a.invoice.localeCompare(b.invoice));
    for (let i = 0; i < cap.sales; i++) {
      const r = DS + i;
      const x = rows[i];
      const set = (c: string, v: unknown, fmt?: string) => {
        const cell = s.getCell(`${c}${r}`);
        if (v !== undefined && v !== '' && v !== null) cell.value = v as never;
        input(cell, fmt);
      };
      set('A', x ? xlDate(x.date) : undefined, FMT.date);
      set('B', x?.invoice);
      set('C', x?.customer);
      set('D', x?.chickenType);
      set('E', x?.kg, FMT.inNum);
      set('F', x?.price, FMT.inNum);
      set('H', x && x.discType !== 'None' ? x.discType : undefined);
      set('I', x && x.discType !== 'None' ? x.discValue : undefined, FMT.inNum);
      set('L', x?.payment);
      set('M', x && x.payment !== 'Credit' ? x.received : undefined, FMT.inNum);
      f(s.getCell(`G${r}`), `IF(E${r}="","",E${r}*N(F${r}))`, FMT.amt);
      f(s.getCell(`J${r}`), `IF(G${r}="","",IF(H${r}="Amount",N(I${r}),IF(H${r}="Per Kg",N(I${r})*E${r},IF(H${r}="Percentage",G${r}*N(I${r})/100,0))))`, FMT.amt);
      f(s.getCell(`K${r}`), `IF(G${r}="","",G${r}-J${r})`, FMT.amt);
      f(s.getCell(`N${r}`), `IF(K${r}="","",IF(OR(L${r}="Cash",L${r}="Bank"),K${r}-IF(M${r}="",K${r},M${r}),K${r}))`, FMT.amt);
    }
    dv(s, `A${DS}:A${last.sales}`, dateDV);
    dv(s, `C${DS}:C${last.sales}`, listDV(NAMES.cust, false));
    dv(s, `D${DS}:D${last.sales}`, listDV(LIST('A'), false));
    dv(s, `H${DS}:H${last.sales}`, listDV(LIST('B'), true));
    dv(s, `L${DS}:L${last.sales}`, listDV(LIST('C'), true));
    for (const c of ['E', 'F', 'I', 'M']) dv(s, `${c}${DS}:${c}${last.sales}`, numDV);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }

  // ============================================================ 8 / 10 Customer and supplier payments
  const paymentSheet = (key: 'cpay' | 'spay', who: 'Customer' | 'Supplier') => {
    const s = ws[key];
    const rows = key === 'cpay' ? [...data.cpay].sort((a, b) => a.date.localeCompare(b.date)) : [...data.spay].sort((a, b) => a.date.localeCompare(b.date));
    title(
      s,
      `${who} Payments`,
      [who === 'Customer' ? 'Money received from customers against their balance. Choose Cash or Bank.' : 'Money paid to suppliers against what is owed. Choose Cash or Bank.'],
      5,
    );
    header(s, HEADER_ROW, [['Date', 12], [who, 26], ['Cash / Bank', 11], ['Amount (Rs.)', 14], ['Reference / Notes', 34]]);
    const lastRow = last[key];
    for (let i = 0; i < cap[key]; i++) {
      const r = DS + i;
      const x = rows[i] as (typeof rows)[number] | undefined;
      const name = x ? ('customer' in x ? x.customer : x.supplier) : undefined;
      const vals: [unknown, string?][] = [[x ? xlDate(x.date) : undefined, FMT.date], [name], [x?.method], [x?.amount, FMT.inNum], [x?.ref]];
      vals.forEach(([v, fmt], j) => {
        const cell = s.getCell(r, j + 1);
        if (v !== undefined && v !== '') cell.value = v as never;
        input(cell, fmt);
      });
    }
    dv(s, `A${DS}:A${lastRow}`, dateDV);
    dv(s, `B${DS}:B${lastRow}`, listDV(key === 'cpay' ? NAMES.cust : NAMES.supp, false));
    dv(s, `C${DS}:C${lastRow}`, listDV(LIST('D'), true));
    dv(s, `D${DS}:D${lastRow}`, numDV);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  };
  paymentSheet('cpay', 'Customer');
  paymentSheet('spay', 'Supplier');

  // ============================================================ 9 Purchases
  {
    const s = ws.purch;
    title(
      s,
      'Purchases',
      [
        'Other Cost = transport / handling for this purchase. Amount Paid: leave blank for Cash/Bank when paid in full, or type a lower amount for a part payment. Credit purchases are always 0 paid.',
        'Balance = Total Cost − Amount Paid; it is added to what is owed to the supplier.',
      ],
      12,
    );
    header(s, HEADER_ROW, [
      ['Date', 12], ['Supplier', 24], ['Invoice No.', 11], ['Chicken Type', 16], ['Kg Received', 11], ['Cost / Kg', 11],
      ['Purchase Cost', 14], ['Other Cost', 11], ['Total Cost', 14], ['Payment', 10], ['Amount Paid', 13], ['Balance', 13],
    ]);
    const rows = [...data.purchase].sort((a, b) => a.date.localeCompare(b.date) || a.invoice.localeCompare(b.invoice));
    for (let i = 0; i < cap.purch; i++) {
      const r = DS + i;
      const x = rows[i];
      const set = (c: string, v: unknown, fmt?: string) => {
        const cell = s.getCell(`${c}${r}`);
        if (v !== undefined && v !== '' && v !== null) cell.value = v as never;
        input(cell, fmt);
      };
      set('A', x ? xlDate(x.date) : undefined, FMT.date);
      set('B', x?.supplier);
      set('C', x?.invoice);
      set('D', x?.chickenType);
      set('E', x?.kg, FMT.inNum);
      set('F', x?.cost, FMT.inNum);
      set('H', x?.otherCost || undefined, FMT.inNum);
      set('J', x?.payment);
      set('K', x && x.payment !== 'Credit' ? x.paid : undefined, FMT.inNum);
      f(s.getCell(`G${r}`), `IF(E${r}="","",E${r}*N(F${r}))`, FMT.amt);
      f(s.getCell(`I${r}`), `IF(G${r}="","",G${r}+N(H${r}))`, FMT.amt);
      f(s.getCell(`L${r}`), `IF(I${r}="","",IF(OR(J${r}="Cash",J${r}="Bank"),I${r}-IF(K${r}="",I${r},K${r}),I${r}))`, FMT.amt);
    }
    dv(s, `A${DS}:A${last.purch}`, dateDV);
    dv(s, `B${DS}:B${last.purch}`, listDV(NAMES.supp, false));
    dv(s, `D${DS}:D${last.purch}`, listDV(LIST('A'), false));
    dv(s, `J${DS}:J${last.purch}`, listDV(LIST('C'), true));
    for (const c of ['E', 'F', 'H', 'K']) dv(s, `${c}${DS}:${c}${last.purch}`, numDV);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }

  // ============================================================ 11 Employee Pay
  {
    const s = ws.wage;
    title(
      s,
      'Employee Pay',
      [
        'Quantity / Days / Sales: Per Unit = number of chickens or units; Daily = number of days; Monthly = number of months; Commission = sales amount (Rs.).',
        'Rate / Commission %: commission is a whole number (1 = 1%). Wages are recorded only here, never on Expenses. Other Pay = bonus or allowance.',
      ],
      10,
    );
    header(s, HEADER_ROW, [
      ['Date', 12], ['Employee', 22], ['Work Type', 14], ['Pay Basis', 12], ['Quantity / Days / Sales', 14], ['Rate / Commission %', 13],
      ['Calculated Pay', 14], ['Other Pay', 11], ['Total Pay', 14], ['Cash / Bank', 11],
    ]);
    const rows = [...data.wage].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < cap.wage; i++) {
      const r = DS + i;
      const x = rows[i];
      const set = (c: string, v: unknown, fmt?: string) => {
        const cell = s.getCell(`${c}${r}`);
        if (v !== undefined && v !== '' && v !== null) cell.value = v as never;
        input(cell, fmt);
      };
      set('A', x ? xlDate(x.date) : undefined, FMT.date);
      set('B', x?.employee);
      set('C', x?.workType);
      set('D', x?.basis);
      set('E', x?.qty, FMT.inNum);
      set('F', x?.rate, FMT.inNum);
      set('H', x?.otherPay || undefined, FMT.inNum);
      set('J', x?.method);
      f(s.getCell(`G${r}`), `IF(E${r}="","",IF(D${r}="Commission",E${r}*N(F${r})/100,E${r}*N(F${r})))`, FMT.amt);
      f(s.getCell(`I${r}`), `IF(G${r}="","",G${r}+N(H${r}))`, FMT.amt);
    }
    dv(s, `A${DS}:A${last.wage}`, dateDV);
    dv(s, `B${DS}:B${last.wage}`, listDV(NAMES.emp, false));
    dv(s, `C${DS}:C${last.wage}`, listDV(LIST('E'), false));
    dv(s, `D${DS}:D${last.wage}`, listDV(LIST('F'), true));
    dv(s, `J${DS}:J${last.wage}`, listDV(LIST('D'), true));
    for (const c of ['E', 'F', 'H']) dv(s, `${c}${DS}:${c}${last.wage}`, numDV);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }

  // ============================================================ 12 Expenses
  {
    const s = ws.exp;
    title(s, 'Expenses', ['Other running expenses (not wages — wages go on Employee Pay). Choose a category and Cash or Bank.'], 5);
    header(s, HEADER_ROW, [['Date', 12], ['Category', 22], ['Description', 34], ['Cash / Bank', 11], ['Amount (Rs.)', 14]]);
    const rows = [...data.expense].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < cap.exp; i++) {
      const r = DS + i;
      const x = rows[i];
      const vals: [unknown, string?][] = [[x ? xlDate(x.date) : undefined, FMT.date], [x?.category], [x?.description], [x?.method], [x?.amount, FMT.inNum]];
      vals.forEach(([v, fmt], j) => {
        const cell = s.getCell(r, j + 1);
        if (v !== undefined && v !== '') cell.value = v as never;
        input(cell, fmt);
      });
    }
    dv(s, `A${DS}:A${last.exp}`, dateDV);
    dv(s, `B${DS}:B${last.exp}`, listDV(LIST('G'), false));
    dv(s, `D${DS}:D${last.exp}`, listDV(LIST('D'), true));
    dv(s, `E${DS}:E${last.exp}`, numDV);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }

  // Day chain formula: first row = period start, then +1 until period end.
  const dayChain = (s: Worksheet, first: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const r = first + i;
      if (i === 0) f(s.getCell(`A${r}`), START, FMT.date, true);
      else f(s.getCell(`A${r}`), `IF(A${r - 1}="","",IF(A${r - 1}+1>${END},"",A${r - 1}+1))`, FMT.date, true);
    }
  };

  // ============================================================ 13 Daily Summary
  const dailyTotalRow = DS + cap.days;
  {
    const s = ws.daily;
    title(s, 'Daily Summary', ['One row per day of the period. All figures come from the entry sheets.'], 11);
    header(s, HEADER_ROW, [
      ['Date', 12], ['Kg Sold', 11], ['Gross Sales', 13], ['Discounts', 11], ['Net Sales', 13], ['Received', 13], ['Credit Sales', 13],
      ['Kg Purchased', 12], ['Purchases', 14], ['Expenses + Wages', 13], ['Kg Sold − Bought', 12],
    ]);
    dayChain(s, DS, cap.days);
    for (let i = 0; i < cap.days; i++) {
      const r = DS + i;
      const w = (x: string) => `IF($A${r}="","",${x})`;
      const by = (sum: string, dates: string) => `SUMIFS(${sum},${dates},$A${r})`;
      f(s.getCell(`B${r}`), w(by(S('E'), S('A'))), FMT.kg, true);
      f(s.getCell(`C${r}`), w(by(S('G'), S('A'))), FMT.amt, true);
      f(s.getCell(`D${r}`), w(by(S('J'), S('A'))), FMT.amt, true);
      f(s.getCell(`E${r}`), w(by(S('K'), S('A'))), FMT.amt, true);
      f(s.getCell(`F${r}`), w(`${by(S('K'), S('A'))}-${by(S('N'), S('A'))}`), FMT.amt, true);
      f(s.getCell(`G${r}`), w(by(S('N'), S('A'))), FMT.amt, true);
      f(s.getCell(`H${r}`), w(by(P('E'), P('A'))), FMT.kg, true);
      f(s.getCell(`I${r}`), w(by(P('I'), P('A'))), FMT.amt, true);
      f(s.getCell(`J${r}`), w(`${by(EX('E'), EX('A'))}+${by(EP('I'), EP('A'))}`), FMT.amt, true);
      f(s.getCell(`K${r}`), w(`B${r}-H${r}`), FMT.kg);
    }
    const t = dailyTotalRow;
    plain(s.getCell(`A${t}`), 'Total', { bold: true });
    totalStyle(s.getCell(`A${t}`));
    'BCDEFGHIJK'.split('').forEach((c) => {
      const cell = s.getCell(`${c}${t}`);
      f(cell, `SUM(${c}${DS}:${c}${t - 1})`, c === 'B' || c === 'H' || c === 'K' ? FMT.kg : FMT.amt, false, true);
      totalStyle(cell);
    });
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }

  // ============================================================ 14 / 15 Cash Book and Bank
  const BOOK_FIRST = 7;
  const bookLast = BOOK_FIRST + cap.days - 1;
  const moneySheet = (key: 'cash' | 'bank', method: 'Cash' | 'Bank') => {
    const s = ws[key];
    title(s, method === 'Cash' ? 'Cash Book' : 'Bank Book', [`Money in and out by ${method.toLowerCase()}, one row per day. Balance = previous balance + In − Out.`], 10);
    plain(s.getCell('A3'), 'Opening balance', { bold: true });
    f(s.getCell('B3'), method === 'Cash' ? OPEN_CASH : OPEN_BANK, FMT.amt, true, true);
    plain(s.getCell('A4'), 'Closing balance', { bold: true });
    f(s.getCell('B4'), `IF(COUNT($A$${BOOK_FIRST}:$A$${bookLast})=0,B3,INDEX($J$${BOOK_FIRST}:$J$${bookLast},COUNT($A$${BOOK_FIRST}:$A$${bookLast})))`, FMT.amt, false, true);
    header(s, 6, [
      ['Date', 12], ['Sales Received', 14], ['Customer Payments', 14], ['Total In', 14], ['Purchases Paid', 14],
      ['Supplier Payments', 14], ['Wages', 12], ['Expenses', 12], ['Total Out', 14], ['Balance', 15],
    ]);
    dayChain(s, BOOK_FIRST, cap.days);
    const m = `"${method}"`;
    for (let i = 0; i < cap.days; i++) {
      const r = BOOK_FIRST + i;
      const w = (x: string) => `IF($A${r}="","",${x})`;
      const by = (sum: string, dates: string, methods: string) => `SUMIFS(${sum},${dates},$A${r},${methods},${m})`;
      f(s.getCell(`B${r}`), w(`${by(S('K'), S('A'), S('L'))}-${by(S('N'), S('A'), S('L'))}`), FMT.amt, true);
      f(s.getCell(`C${r}`), w(by(CP('D'), CP('A'), CP('C'))), FMT.amt, true);
      f(s.getCell(`D${r}`), w(`B${r}+C${r}`), FMT.amt);
      f(s.getCell(`E${r}`), w(`${by(P('I'), P('A'), P('J'))}-${by(P('L'), P('A'), P('J'))}`), FMT.amt, true);
      f(s.getCell(`F${r}`), w(by(SP('D'), SP('A'), SP('C'))), FMT.amt, true);
      f(s.getCell(`G${r}`), w(by(EP('I'), EP('A'), EP('J'))), FMT.amt, true);
      f(s.getCell(`H${r}`), w(by(EX('E'), EX('A'), EX('D'))), FMT.amt, true);
      f(s.getCell(`I${r}`), w(`E${r}+F${r}+G${r}+H${r}`), FMT.amt);
      f(s.getCell(`J${r}`), w(i === 0 ? `$B$3+D${r}-I${r}` : `J${r - 1}+D${r}-I${r}`), FMT.amt);
    }
    const t = bookLast + 1;
    plain(s.getCell(`A${t}`), 'Total', { bold: true });
    totalStyle(s.getCell(`A${t}`));
    'BCDEFGHI'.split('').forEach((c) => {
      const cell = s.getCell(`${c}${t}`);
      f(cell, `SUM(${c}${BOOK_FIRST}:${c}${bookLast})`, FMT.amt, false, true);
      totalStyle(cell);
    });
    const cl = s.getCell(`J${t}`);
    f(cl, 'B4', FMT.amt, false, true);
    totalStyle(cl);
    s.views = [{ state: 'frozen', ySplit: 6 }];
  };
  moneySheet('cash', 'Cash');
  moneySheet('bank', 'Bank');

  // ============================================================ 16 Stock Summary
  const stockTotalRow = DS + cap.list;
  {
    const s = ws.stock;
    title(
      s,
      'Stock Summary (kg)',
      ['Type Opening Kg and Physical Count in the yellow cells. Estimated Closing = Opening + Purchased − Sold. Stock is an estimate until a physical count is entered (processing loss, spoilage and weight differences).'],
      9,
    );
    header(s, HEADER_ROW, [
      ['Chicken Type', 20], ['Opening Kg', 12], ['Purchased Kg', 12], ['Available Kg', 12], ['Sold Kg', 12],
      ['Estimated Closing Kg', 13], ['Physical Count Kg', 13], ['Difference Kg', 12], ['Difference %', 11],
    ]);
    for (let i = 0; i < cap.list; i++) {
      const r = DS + i;
      const lr = LIST_FIRST + i;
      const type = business.lists.chickenTypes[i];
      const st = type ? business.stock?.[type] : undefined;
      f(s.getCell(`A${r}`), `IF('${SHEETS.lists}'!$A$${lr}="","",'${SHEETS.lists}'!$A$${lr})`, undefined, true);
      const ob = s.getCell(`B${r}`);
      if (st && Number(st.opening)) ob.value = Number(st.opening);
      input(ob, FMT.inNum);
      const w = (x: string) => `IF($A${r}="","",${x})`;
      f(s.getCell(`C${r}`), w(`SUMIFS(${P('E')},${P('D')},$A${r},${PERIOD(P('A'))})`), FMT.kg, true);
      f(s.getCell(`D${r}`), w(`N(B${r})+C${r}`), FMT.kg);
      f(s.getCell(`E${r}`), w(`SUMIFS(${S('E')},${S('D')},$A${r},${PERIOD(S('A'))})`), FMT.kg, true);
      f(s.getCell(`F${r}`), w(`D${r}-E${r}`), FMT.kg);
      const pc = s.getCell(`G${r}`);
      if (st && st.physical !== null && st.physical !== undefined) pc.value = Number(st.physical);
      input(pc, FMT.inNum);
      f(s.getCell(`H${r}`), `IF(OR($A${r}="",G${r}=""),"",G${r}-F${r})`, FMT.kg);
      f(s.getCell(`I${r}`), `IF(OR(H${r}="",N(D${r})=0),"",H${r}/D${r})`, FMT.pct);
    }
    const t = stockTotalRow;
    plain(s.getCell(`A${t}`), 'Total', { bold: true });
    totalStyle(s.getCell(`A${t}`));
    'BCDEFGH'.split('').forEach((c) => {
      const cell = s.getCell(`${c}${t}`);
      f(cell, `SUM(${c}${DS}:${c}${t - 1})`, FMT.kg, false, true);
      totalStyle(cell);
    });
    const tp = s.getCell(`I${t}`);
    f(tp, `IF(OR(COUNT(H${DS}:H${t - 1})=0,N(D${t})=0),"",H${t}/D${t})`, FMT.pct, false, true);
    totalStyle(tp);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  }

  // ============================================================ 17 / 19 Debtors and Creditors
  const debtTotalRow = DS + cap.cust;
  const credTotalRow = DS + cap.supp;
  const balanceSheet = (key: 'debt' | 'cred') => {
    const s = ws[key];
    const isC = key === 'debt';
    const master = isC ? SHEETS.cust : SHEETS.supp;
    const n = isC ? cap.cust : cap.supp;
    title(
      s,
      isC ? 'Customer Debtors — customers owe' : 'Supplier Creditors — owed to suppliers',
      [isC ? 'Balance Due = Opening Balance + Credit Sales − Payments (entries within the period).' : 'Balance Due = Opening Balance + Credit Purchases (unpaid balances) − Payments (entries within the period).'],
      5,
    );
    header(s, HEADER_ROW, [[isC ? 'Customer' : 'Supplier', 28], ['Opening Balance', 15], [isC ? 'Credit Sales' : 'Credit Purchases', 15], ['Payments', 15], ['Balance Due', 15]]);
    for (let i = 0; i < n; i++) {
      const r = DS + i;
      const w = (x: string) => `IF($A${r}="","",${x})`;
      f(s.getCell(`A${r}`), `IF('${master}'!$B${r}="","",'${master}'!$B${r})`, undefined, true);
      f(s.getCell(`B${r}`), w(`N('${master}'!$E${r})`), FMT.amt, true);
      if (isC) {
        f(s.getCell(`C${r}`), w(`SUMIFS(${S('N')},${S('C')},$A${r},${PERIOD(S('A'))})`), FMT.amt, true);
        f(s.getCell(`D${r}`), w(`SUMIFS(${CP('D')},${CP('B')},$A${r},${PERIOD(CP('A'))})`), FMT.amt, true);
      } else {
        f(s.getCell(`C${r}`), w(`SUMIFS(${P('L')},${P('B')},$A${r},${PERIOD(P('A'))})`), FMT.amt, true);
        f(s.getCell(`D${r}`), w(`SUMIFS(${SP('D')},${SP('B')},$A${r},${PERIOD(SP('A'))})`), FMT.amt, true);
      }
      f(s.getCell(`E${r}`), w(`B${r}+C${r}-D${r}`), FMT.amt);
    }
    const t = DS + n;
    plain(s.getCell(`A${t}`), 'Total', { bold: true });
    totalStyle(s.getCell(`A${t}`));
    'BCDE'.split('').forEach((c) => {
      const cell = s.getCell(`${c}${t}`);
      f(cell, `SUM(${c}${DS}:${c}${t - 1})`, FMT.amt, false, true);
      totalStyle(cell);
    });
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  };
  balanceSheet('debt');
  balanceSheet('cred');

  // ============================================================ 20 Monthly Summary
  const monTotalRow = DS + cap.months;
  const avgRow = monTotalRow + 2;
  const monLast = monTotalRow - 1;
  {
    const s = ws.monthly;
    title(
      s,
      'Monthly Summary',
      [
        'Cost of Chicken Sold = Kg Sold × average cost per kg. Average cost = month\'s total purchase cost (incl. other cost) ÷ kg purchased; if nothing was bought that month, the period average is used.',
        'Assumption: the average cost method is a management estimate. Confirm the final cost-of-sales treatment against the client\'s accounting method. Month-end balances are as at the last day of each month in the period.',
      ],
      14,
    );
    header(s, HEADER_ROW, [
      ['Month', 11], ['Kg Purchased', 12], ['Kg Sold', 11], ['Net Sales', 14], ['Purchases', 14], ['Avg Cost / Kg', 11], ['Cost of Chicken Sold', 14],
      ['Gross Profit', 14], ['Expenses + Wages', 13], ['Net Profit', 14], ['Cash (month-end)', 14], ['Bank (month-end)', 14],
      ['Debtors (month-end)', 14], ['Creditors (month-end)', 14],
    ]);
    header(s, HEADER_ROW, [['From', 11], ['To', 11]], 16);
    for (let i = 0; i < cap.months; i++) {
      const r = DS + i;
      if (i === 0) f(s.getCell(`A${r}`), `DATE(YEAR(${START}),MONTH(${START}),1)`, FMT.month, true);
      else f(s.getCell(`A${r}`), `IF(A${r - 1}="","",IF(DATE(YEAR(A${r - 1}),MONTH(A${r - 1})+1,1)>${END},"",DATE(YEAR(A${r - 1}),MONTH(A${r - 1})+1,1)))`, FMT.month, true);
      f(s.getCell(`P${r}`), `IF($A${r}="","",MAX($A${r},${START}))`, FMT.date, true);
      f(s.getCell(`Q${r}`), `IF($A${r}="","",MIN(DATE(YEAR($A${r}),MONTH($A${r})+1,0),${END}))`, FMT.date, true);
      const w = (x: string) => `IF($A${r}="","",${x})`;
      const inM = (dates: string) => `${dates},">="&$P${r},${dates},"<="&$Q${r}`;
      const upTo = (dates: string) => `${dates},">="&${START},${dates},"<="&$Q${r}`;
      f(s.getCell(`B${r}`), w(`SUMIFS(${P('E')},${inM(P('A'))})`), FMT.kg, true);
      f(s.getCell(`C${r}`), w(`SUMIFS(${S('E')},${inM(S('A'))})`), FMT.kg, true);
      f(s.getCell(`D${r}`), w(`SUMIFS(${S('K')},${inM(S('A'))})`), FMT.amt, true);
      f(s.getCell(`E${r}`), w(`SUMIFS(${P('I')},${inM(P('A'))})`), FMT.amt, true);
      f(s.getCell(`F${r}`), w(`IF(B${r}>0,E${r}/B${r},$B$${avgRow})`), FMT.rate);
      f(s.getCell(`G${r}`), w(`C${r}*F${r}`), FMT.amt);
      f(s.getCell(`H${r}`), w(`D${r}-G${r}`), FMT.amt);
      f(s.getCell(`I${r}`), w(`SUMIFS(${EX('E')},${inM(EX('A'))})+SUMIFS(${EP('I')},${inM(EP('A'))})`), FMT.amt, true);
      f(s.getCell(`J${r}`), w(`H${r}-I${r}`), FMT.amt);
      const bal = (sheet: string) =>
        w(`IFERROR(INDEX('${sheet}'!$J$${BOOK_FIRST}:$J$${bookLast},MATCH($Q${r},'${sheet}'!$A$${BOOK_FIRST}:$A$${bookLast},0)),'${sheet}'!$B$3)`);
      f(s.getCell(`K${r}`), bal(SHEETS.cash), FMT.amt, true);
      f(s.getCell(`L${r}`), bal(SHEETS.bank), FMT.amt, true);
      f(s.getCell(`M${r}`), w(`SUM('${SHEETS.cust}'!$E$${DS}:$E$${last.cust})+SUMIFS(${S('N')},${upTo(S('A'))})-SUMIFS(${CP('D')},${upTo(CP('A'))})`), FMT.amt, true);
      f(s.getCell(`N${r}`), w(`SUM('${SHEETS.supp}'!$E$${DS}:$E$${last.supp})+SUMIFS(${P('L')},${upTo(P('A'))})-SUMIFS(${SP('D')},${upTo(SP('A'))})`), FMT.amt, true);
    }
    const t = monTotalRow;
    plain(s.getCell(`A${t}`), 'Total / closing', { bold: true });
    totalStyle(s.getCell(`A${t}`));
    for (const c of 'BCDEGHIJ'.split('')) {
      const cell = s.getCell(`${c}${t}`);
      f(cell, `SUM(${c}${DS}:${c}${monLast})`, c === 'B' || c === 'C' ? FMT.kg : FMT.amt, false, true);
      totalStyle(cell);
    }
    const fa = s.getCell(`F${t}`);
    f(fa, `$B$${avgRow}`, FMT.rate, false, true);
    totalStyle(fa);
    for (const c of 'KLMN'.split('')) {
      const cell = s.getCell(`${c}${t}`);
      f(cell, `IF(COUNT($A$${DS}:$A$${monLast})=0,"",INDEX(${c}${DS}:${c}${monLast},COUNT($A$${DS}:$A$${monLast})))`, FMT.amt, false, true);
      totalStyle(cell);
    }
    plain(s.getCell(`A${avgRow}`), 'Period average cost per kg', { bold: true });
    f(s.getCell(`B${avgRow}`), `IF(B${t}>0,E${t}/B${t},0)`, FMT.rate, false, true);
    s.views = [{ state: 'frozen', ySplit: HEADER_ROW, xSplit: 1 }];
  }

  // ============================================================ 18 Customer Monthly
  {
    const s = ws.cm;
    const firstCustomer = data.customer[0]?.name ?? '';
    title(s, 'Customer Monthly', ['Choose a customer in the yellow cell. The month table and balances update. The all-customers grid below shows net sales by month for every customer.'], 11);
    plain(s.getCell('A3'), 'Customer', { bold: true });
    const sel = s.getCell('B3');
    if (firstCustomer) sel.value = firstCustomer;
    input(sel);
    dv(s, 'B3', listDV(NAMES.cust, false));
    plain(s.getCell('A4'), 'Opening balance', { bold: true });
    f(s.getCell('B4'), `IF($B$3="",0,IFERROR(INDEX('${SHEETS.cust}'!$E$${DS}:$E$${last.cust},MATCH($B$3,'${SHEETS.cust}'!$B$${DS}:$B$${last.cust},0)),0))`, FMT.amt, true, true);
    plain(s.getCell('A5'), 'Balance due now', { bold: true });
    f(
      s.getCell('B5'),
      `IF($B$3="",0,$B$4+SUMIFS(${S('N')},${S('C')},$B$3,${PERIOD(S('A'))})-SUMIFS(${CP('D')},${CP('B')},$B$3,${PERIOD(CP('A'))}))`,
      FMT.amt,
      true,
      true,
    );
    const TH = 7;
    const TF = 8;
    header(s, TH, [
      ['Month', 18], ['Sales Lines', 12], ['Kg Bought', 12], ['Gross Sales', 14], ['Discounts', 12], ['Net Sales', 14], ['Avg Price / Kg', 12],
      ['Paid at Sale', 14], ['Credit Sales', 14], ['Payments Received', 14], ['Balance Due Month-End', 15],
    ]);
    header(s, TH, [['From', 11], ['To', 11]], 13);
    for (let i = 0; i < cap.months; i++) {
      const r = TF + i;
      const mr = DS + i;
      const MS = `'${SHEETS.monthly}'!`;
      f(s.getCell(`A${r}`), `IF(${MS}$A$${mr}="","",${MS}$A$${mr})`, FMT.month, true);
      f(s.getCell(`M${r}`), `IF(${MS}$P$${mr}="","",${MS}$P$${mr})`, FMT.date, true);
      f(s.getCell(`N${r}`), `IF(${MS}$Q$${mr}="","",${MS}$Q$${mr})`, FMT.date, true);
      const w = (x: string) => `IF(OR($A${r}="",$B$3=""),"",${x})`;
      const crit = `${S('C')},$B$3,${S('A')},">="&$M${r},${S('A')},"<="&$N${r}`;
      f(s.getCell(`B${r}`), w(`COUNTIFS(${crit})`), '#,##0;-#,##0;"–"', true);
      f(s.getCell(`C${r}`), w(`SUMIFS(${S('E')},${crit})`), FMT.kg, true);
      f(s.getCell(`D${r}`), w(`SUMIFS(${S('G')},${crit})`), FMT.amt, true);
      f(s.getCell(`E${r}`), w(`SUMIFS(${S('J')},${crit})`), FMT.amt, true);
      f(s.getCell(`F${r}`), w(`SUMIFS(${S('K')},${crit})`), FMT.amt, true);
      f(s.getCell(`G${r}`), w(`IF(C${r}>0,D${r}/C${r},0)`), FMT.rate);
      f(s.getCell(`I${r}`), w(`SUMIFS(${S('N')},${crit})`), FMT.amt, true);
      f(s.getCell(`H${r}`), w(`F${r}-I${r}`), FMT.amt);
      f(s.getCell(`J${r}`), w(`SUMIFS(${CP('D')},${CP('B')},$B$3,${CP('A')},">="&$M${r},${CP('A')},"<="&$N${r})`), FMT.amt, true);
      f(
        s.getCell(`K${r}`),
        w(`$B$4+SUMIFS(${S('N')},${S('C')},$B$3,${S('A')},">="&${START},${S('A')},"<="&$N${r})-SUMIFS(${CP('D')},${CP('B')},$B$3,${CP('A')},">="&${START},${CP('A')},"<="&$N${r})`),
        FMT.amt,
        true,
      );
    }
    const t = TF + cap.months;
    plain(s.getCell(`A${t}`), 'Total', { bold: true });
    totalStyle(s.getCell(`A${t}`));
    for (const c of 'BCDEFHIJ'.split('')) {
      const cell = s.getCell(`${c}${t}`);
      f(cell, `SUM(${c}${TF}:${c}${t - 1})`, c === 'B' ? '#,##0;-#,##0;"–"' : c === 'C' ? FMT.kg : FMT.amt, false, true);
      totalStyle(cell);
    }
    const ga = s.getCell(`G${t}`);
    f(ga, `IF(C${t}>0,D${t}/C${t},0)`, FMT.rate, false, true);
    totalStyle(ga);
    const gk = s.getCell(`K${t}`);
    f(gk, 'B5', FMT.amt, false, true);
    totalStyle(gk);

    // All-customers grid
    const g0 = t + 3;
    plain(s.getCell(`A${g0}`), 'All customers — net sales by month', { bold: true, size: 12, color: 'FF1F4E78' });
    const gh = g0 + 1;
    const cols: [string, number][] = [['Customer', 26]];
    for (let i = 0; i < cap.months; i++) cols.push(['', 12]);
    cols.push(['Total Kg', 12], ['Total Net Sales', 14], ['Balance Due', 14]);
    header(s, gh, cols);
    for (let i = 0; i < cap.months; i++) {
      const c = s.getCell(gh, 2 + i);
      c.value = { formula: `IF($A$${TF + i}="","",$A$${TF + i})` } as never;
      c.numFmt = FMT.month;
    }
    const kgCol = col(2 + cap.months);
    const netCol = col(3 + cap.months);
    const balCol = col(4 + cap.months);
    for (let j = 0; j < cap.cust; j++) {
      const r = gh + 1 + j;
      const mr = DS + j;
      f(s.getCell(`A${r}`), `IF('${SHEETS.cust}'!$B$${mr}="","",'${SHEETS.cust}'!$B$${mr})`, undefined, true);
      for (let i = 0; i < cap.months; i++) {
        const c = col(2 + i);
        f(
          s.getCell(`${c}${r}`),
          `IF(OR($A${r}="",$A$${TF + i}=""),"",SUMIFS(${S('K')},${S('C')},$A${r},${S('A')},">="&$M$${TF + i},${S('A')},"<="&$N$${TF + i}))`,
          FMT.amt,
          true,
        );
      }
      f(s.getCell(`${kgCol}${r}`), `IF($A${r}="","",SUMIFS(${S('E')},${S('C')},$A${r},${PERIOD(S('A'))}))`, FMT.kg, true);
      f(s.getCell(`${netCol}${r}`), `IF($A${r}="","",SUMIFS(${S('K')},${S('C')},$A${r},${PERIOD(S('A'))}))`, FMT.amt, true);
      f(s.getCell(`${balCol}${r}`), `IF($A${r}="","",'${SHEETS.debt}'!$E$${mr})`, FMT.amt, true);
    }
    const gt = gh + 1 + cap.cust;
    plain(s.getCell(`A${gt}`), 'Total', { bold: true });
    totalStyle(s.getCell(`A${gt}`));
    for (let i = 0; i < cap.months + 3; i++) {
      const c = col(2 + i);
      const cell = s.getCell(`${c}${gt}`);
      f(cell, `SUM(${c}${gh + 1}:${c}${gt - 1})`, c === kgCol ? FMT.kg : FMT.amt, false, true);
      totalStyle(cell);
    }
    s.views = [{ state: 'frozen', xSplit: 1 }];
  }

  // ============================================================ 2 Dashboard
  {
    const s = ws.dash;
    s.getColumn(1).width = 3;
    for (const c of [2, 3, 5, 6, 8, 9]) s.getColumn(c).width = 17;
    for (const c of [4, 7]) s.getColumn(c).width = 3;
    const t1 = s.getCell('B1');
    t1.value = { formula: `IF('${SHEETS.client}'!$B$3="","Chicken Wholesale Accounts",'${SHEETS.client}'!$B$3)` } as never;
    t1.font = { name: FONT, size: 18, bold: true, color: { argb: 'FF1F4E78' } };
    s.mergeCells('B1:I1');
    const t2 = s.getCell('B2');
    t2.value = { formula: `"Dashboard · Period "&TEXT(${START},"dd/mm/yyyy")&" – "&TEXT(${END},"dd/mm/yyyy")` } as never;
    t2.font = { name: FONT, size: 10, italic: true, color: { argb: 'FF595959' } };
    s.mergeCells('B2:I2');
    const MS = `'${SHEETS.monthly}'!`;
    const tiles: [string, string, string][] = [
      ['Sales (net, Rs.)', `${MS}$D$${monTotalRow}`, FMT.amt],
      ['Expenses incl. wages (Rs.)', `${MS}$I$${monTotalRow}`, FMT.amt],
      ['Net Profit (Rs.)', `${MS}$J$${monTotalRow}`, FMT.amt],
      ['Gross Profit (Rs.)', `${MS}$H$${monTotalRow}`, FMT.amt],
      ['Chicken Sold (kg)', `${MS}$C$${monTotalRow}`, FMT.kg],
      ['Chicken Purchased (kg)', `${MS}$B$${monTotalRow}`, FMT.kg],
      ['Cash (Rs.)', `'${SHEETS.cash}'!$B$4`, FMT.amt],
      ['Bank (Rs.)', `'${SHEETS.bank}'!$B$4`, FMT.amt],
      ['Customer Outstanding (Rs.)', `'${SHEETS.debt}'!$E$${debtTotalRow}`, FMT.amt],
      ['Supplier Outstanding (Rs.)', `'${SHEETS.cred}'!$E$${credTotalRow}`, FMT.amt],
      ["Today's Sales (Rs.)", `SUMIFS(${S('K')},${S('A')},TODAY())`, FMT.amt],
      ["Today's Kg Sold", `SUMIFS(${S('E')},${S('A')},TODAY())`, FMT.kg],
    ];
    tiles.forEach(([label, formula, fmt], i) => {
      const row = 4 + Math.floor(i / 3) * 4;
      const c0 = [2, 5, 8][i % 3];
      s.mergeCells(row, c0, row, c0 + 1);
      s.mergeCells(row + 1, c0, row + 2, c0 + 1);
      const l = s.getCell(row, c0);
      l.value = label;
      l.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      l.fill = HEAD_FILL;
      l.alignment = { horizontal: 'center' };
      const v = s.getCell(row + 1, c0);
      v.value = { formula } as never;
      v.font = { name: FONT, size: 20, bold: true, color: { argb: GREEN } };
      v.fill = GREY_FILL;
      v.numFmt = fmt;
      v.alignment = { horizontal: 'center', vertical: 'middle' };
      v.border = BORDER;
    });
    const nr = 4 + 4 * 4;
    plain(s.getCell(`B${nr}`), 'Figures cover the whole accounting period. Cash and Bank are closing balances. Charts are shown on the website; this workbook holds all figures and tables.', { italic: true, size: 9, color: 'FF595959' });
    s.mergeCells(`B${nr}:I${nr}`);
  }

  // ============================================================ 1 Instructions
  {
    const s = ws.instr;
    s.getColumn(1).width = 4;
    s.getColumn(2).width = 28;
    s.getColumn(3).width = 90;
    plain(s.getCell('B1'), 'Chicken Wholesale Accounts — Instructions', { bold: true, size: 16, color: 'FF1F4E78' });
    let r = 3;
    const sect = (t: string) => {
      plain(s.getCell(`B${r}`), t, { bold: true, size: 12, color: 'FF1F4E78' });
      r++;
    };
    const line = (a: string, b: string, style?: 'input' | 'calc' | 'cross') => {
      const ca = s.getCell(`B${r}`);
      plain(ca, a, { bold: true });
      if (style === 'input') input(ca);
      if (style === 'calc') calc(ca);
      if (style === 'cross') calc(ca, undefined, true);
      if (style) ca.font = { ...ca.font, bold: true };
      const cb = s.getCell(`C${r}`);
      plain(cb, b);
      cb.alignment = { wrapText: true, vertical: 'top' };
      r++;
    };
    sect('Colour legend');
    line('Yellow / blue text', 'Input cell — type here.', 'input');
    line('Grey / black text', 'Formula — do not type here.', 'calc');
    line('Grey / green text', 'Formula pulling from another sheet — do not type here.', 'cross');
    r++;
    sect('Sheets');
    const sheets: [string, string][] = [
      ['Dashboard', 'Headline figures for the whole period.'],
      ['Client Information', 'Business details, accounting period (start / end), opening cash and bank.'],
      ['Customers / Suppliers / Employees', 'Master lists with opening balances and standard pay. Names must be unique.'],
      ['Sales', 'One row per sale: kg, actual price per kg, discount, payment and amount received.'],
      ['Customer Payments', 'Money received from customers (cash or bank).'],
      ['Purchases', 'One row per purchase: kg received, cost per kg, other cost, payment and amount paid.'],
      ['Supplier Payments', 'Money paid to suppliers (cash or bank).'],
      ['Employee Pay', 'Wages: per unit, daily, monthly or commission. Wages go here only, never on Expenses.'],
      ['Expenses', 'Other running expenses by category.'],
      ['Daily Summary', 'One row per day of the period.'],
      ['Cash Book / Bank', 'Money in and out by cash and by bank with running balance.'],
      ['Stock Summary', 'Kg per chicken type. Type opening kg and physical counts here.'],
      ['Customer Debtors', 'What each customer owes.'],
      ['Customer Monthly', 'Pick a customer to see month-by-month figures; all-customers grid below.'],
      ['Supplier Creditors', 'What is owed to each supplier.'],
      ['Monthly Summary', 'Monthly profit (gross and net) and month-end balances.'],
      ['Lists', 'Drop-down values. Edit or add items in the yellow cells.'],
    ];
    for (const [a, b] of sheets) line(a, b);
    r++;
    sect('Daily workflow');
    [
      '1. Enter purchases (supplier, kg, cost per kg, payment).',
      '2. Enter sales (customer, kg, actual price per kg, discount, payment).',
      '3. Record customer payments and supplier payments.',
      '4. Record employee pay and other expenses.',
      '5. Check: compare kg bought with kg sold (Daily Summary / Stock Summary) and the Cash Book / Bank with actual cash and the bank statement.',
      '6. Month-end: review the Monthly Summary, Customer Monthly and Dashboard.',
    ].forEach((t) => line('', t));
    r++;
    sect('Important notes');
    [
      'Each transaction is a new row on its sheet. Do not create one sheet per day — the summaries group by day and month.',
      'Percentages are whole numbers: type 5 for 5%, 1 for 1%, 0.5 for 0.5%. Do not type 5%. This applies to percentage discounts and commission.',
      'Discount Value: Amount = Rs. off the invoice; Per Kg = Rs. per kg × kg; Percentage = Gross × value ÷ 100.',
      'Amount Received / Amount Paid: leave blank for Cash or Bank when paid in full; type a lower amount for a part payment. Credit is always 0. A blank payment method is treated as credit.',
      'Commission pay = Sales amount × Commission ÷ 100.',
      "Cost of chicken sold uses the average cost method (month's purchase cost ÷ kg purchased; period average when nothing was bought). This is a management estimate — confirm it against the client's accounting method.",
      'Stock is an estimate until a physical count is entered.',
      `Reports include entries dated within the period on Client Information. Daily sheets hold ${cap.days} days and monthly sheets ${cap.months} months.`,
      'Charts are not included in this workbook; the website shows them.',
    ].forEach((t) => line('•', t));
  }

  return wb;
}

export async function buildWorkbookBuffer(ExcelJS: ExcelJSModule, opts: BuildOptions = {}): Promise<ArrayBuffer> {
  const wb = buildWorkbook(ExcelJS, opts);
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
