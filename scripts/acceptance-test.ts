// Acceptance test (requirements section 9). Run: npm run test:acceptance
// Checks the website calculations against the expected results and writes the sample workbook to ./out.

import ExcelJS from 'exceljs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { computeBooks, dashboardFigures } from '../lib/calc';
import { buildWorkbookBuffer, exportFileName, SHEETS } from '../lib/excel';
import { sampleBusiness, sampleData } from '../lib/sample';

let failed = 0;
function check(label: string, actual: number, expected: number, tolerance = 0.5) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} expected ${expected.toLocaleString('en-US')}  got ${Number(actual.toFixed(2)).toLocaleString('en-US')}`);
}

const business = sampleBusiness();
const data = sampleData();
const books = computeBooks(business, data);

const inv1 = books.saleCalcs.get('x1')!;
const inv2 = books.saleCalcs.get('x2')!;
check('INV001 gross', inv1.gross, 52500);
check('INV001 discount', inv1.discount, 500);
check('INV001 net', inv1.net, 52000);
check('INV001 credit', inv1.credit, 0);
check('INV002 gross', inv2.gross, 32400);
check('INV002 discount', inv2.discount, 300);
check('INV002 net', inv2.net, 32100);
check('INV002 credit', inv2.credit, 32100);
const p1 = books.purchaseCalcs.get('p1')!;
check('P001 total', p1.total, 545000);
check('P001 balance', p1.balance, 0);
const wage = (id: string) => books.wageCalcs.get(id)!.total;
check('Wages Worker A', wage('w1'), 10000);
check('Wages Worker B', wage('w2'), 7000);
check('Wages Driver A (x2)', wage('w3') + wage('w5'), 6000);
check('Wages Salesman A', wage('w4'), 6000);
check('Wages total', [...books.wageCalcs.values()].reduce((s, w) => s + w.total, 0), 29000);

const oct = books.monthly.find((m) => m.month === '2026-10')!;
check('October net sales', oct.netSales, 84100);
check('October kg sold', oct.kgSold, 80);
check('Average cost per kg', oct.avgCost, 908.33, 0.01);
check('Cost of chicken sold', oct.cogs, 72667);
check('Gross profit', oct.grossProfit, 11433);
check('Expenses + wages', oct.expenses, 49000);
check('Net profit', oct.netProfit, -37567);
check('Closing cash', books.cash.closing, -527000);
check('Closing bank', books.bank.closing, -45000);
const owe = (n: string) => books.debtors.find((d) => d.name === n)!.balance;
check('ABC Hotel owes', owe('ABC Hotel'), 5000);
check('XYZ Restaurant owes', owe('XYZ Restaurant'), 32100);
check('Customers owe total', books.debtors.reduce((s, d) => s + d.balance, 0), 37100);
check('Supplier A owed', books.creditors.find((d) => d.name === 'Supplier A')!.balance, 0);
check('Stock Chicken closing kg', books.stock.find((s) => s.type === 'Chicken')!.closing, 620);

const cm = books.customerMonthly('ABC Hotel');
const cmOct = cm.rows.find((r) => r.month === '2026-10')!;
check('ABC Oct sales lines', cmOct.lines, 1, 0);
check('ABC Oct kg', cmOct.kg, 50);
check('ABC Oct gross', cmOct.gross, 52500);
check('ABC Oct discount', cmOct.discount, 500);
check('ABC Oct net', cmOct.net, 52000);
check('ABC Oct avg price', cmOct.avgPrice, 1050, 0.01);
check('ABC Oct paid at sale', cmOct.paidAtSale, 52000);
check('ABC Oct credit', cmOct.credit, 0);
check('ABC Oct payments', cmOct.payments, 20000);
check('ABC Oct month-end balance', cmOct.balance, 5000);
for (const m of ['2026-01', '2026-05', '2026-09']) check(`ABC ${m} balance`, cm.rows.find((r) => r.month === m)!.balance, 25000);

const dash = dashboardFigures(books, null, '2026-10-01');
check('Dashboard net sales', dash.netSales, 84100);
check("Dashboard today's sales (01/10)", dash.todaySales, 84100);

(async () => {
  const buf = await buildWorkbookBuffer(ExcelJS, { business, data });
  mkdirSync('out', { recursive: true });
  const file = `out/${exportFileName(business, '2026-10-08')}`;
  writeFileSync(file, Buffer.from(buf));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const names = wb.worksheets.map((w) => w.name);
  const expectedNames = Object.values(SHEETS);
  const sheetsOk = names.length === 21 && expectedNames.every((n, i) => names[i] === n);
  if (!sheetsOk) failed++;
  console.log(`${sheetsOk ? 'PASS' : 'FAIL'}  Workbook has the 21 sheets in order          (${file})`);
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll acceptance checks passed');
  process.exit(failed ? 1 : 0);
})();
