// The acceptance-test sample client (requirements section 9). Used by "Load sample client" in practice mode and by the tests.

import { defaultLists } from './defaults';
import type { BookData, Business } from './types';

export function sampleBusiness(id = 'sample'): Business {
  return {
    id,
    name: 'Sample Chicken Traders',
    owner: 'Sample Owner',
    type: 'Chicken Wholesale',
    address: 'Colombo',
    phone: '',
    email: '',
    preparedBy: 'Accountant',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    openingCash: 0,
    openingBank: 0,
    lists: defaultLists(),
    stock: { Chicken: { opening: 100, physical: null } },
    members: [],
  };
}

export function sampleData(): BookData {
  return {
    customer: [
      { id: 'c1', kind: 'customer', code: 'C001', name: 'ABC Hotel', phone: '', address: '', opening: 25000, active: true },
      { id: 'c2', kind: 'customer', code: 'C002', name: 'XYZ Restaurant', phone: '', address: '', opening: 0, active: true },
    ],
    supplier: [{ id: 's1', kind: 'supplier', code: 'S001', name: 'Supplier A', phone: '', address: '', opening: 50000 }],
    employee: [
      { id: 'e1', kind: 'employee', code: 'E001', name: 'Worker A', position: 'Cutting', basis: 'Per Unit', rate: 20, phone: '', active: true },
      { id: 'e2', kind: 'employee', code: 'E002', name: 'Worker B', position: 'Cutting', basis: 'Per Unit', rate: 20, phone: '', active: true },
      { id: 'e3', kind: 'employee', code: 'E003', name: 'Driver A', position: 'Driver', basis: 'Daily', rate: 3000, phone: '', active: true },
      { id: 'e4', kind: 'employee', code: 'E004', name: 'Salesman A', position: 'Salesman', basis: 'Commission', rate: 1, phone: '', active: true },
    ],
    sale: [
      { id: 'x1', kind: 'sale', date: '2026-10-01', invoice: 'INV001', customer: 'ABC Hotel', chickenType: 'Chicken', kg: 50, price: 1050, discType: 'Amount', discValue: 500, payment: 'Cash', received: 52000 },
      { id: 'x2', kind: 'sale', date: '2026-10-01', invoice: 'INV002', customer: 'XYZ Restaurant', chickenType: 'Chicken', kg: 30, price: 1080, discType: 'Per Kg', discValue: 10, payment: 'Credit', received: 0 },
    ],
    purchase: [
      { id: 'p1', kind: 'purchase', date: '2026-10-01', supplier: 'Supplier A', invoice: 'P001', chickenType: 'Chicken', kg: 600, cost: 900, otherCost: 5000, payment: 'Cash', paid: 545000 },
    ],
    cpay: [{ id: 'cp1', kind: 'cpay', date: '2026-10-02', customer: 'ABC Hotel', method: 'Bank', amount: 20000, ref: '' }],
    spay: [{ id: 'sp1', kind: 'spay', date: '2026-10-02', supplier: 'Supplier A', method: 'Bank', amount: 50000, ref: '' }],
    wage: [
      { id: 'w1', kind: 'wage', date: '2026-10-06', employee: 'Worker A', workType: 'Cutting', basis: 'Per Unit', qty: 500, rate: 20, otherPay: 0, method: 'Cash' },
      { id: 'w2', kind: 'wage', date: '2026-10-06', employee: 'Worker B', workType: 'Cutting', basis: 'Per Unit', qty: 350, rate: 20, otherPay: 0, method: 'Cash' },
      { id: 'w3', kind: 'wage', date: '2026-10-06', employee: 'Driver A', workType: 'Driver', basis: 'Daily', qty: 1, rate: 3000, otherPay: 0, method: 'Cash' },
      { id: 'w4', kind: 'wage', date: '2026-10-06', employee: 'Salesman A', workType: 'Salesman', basis: 'Commission', qty: 500000, rate: 1, otherPay: 1000, method: 'Cash' },
      { id: 'w5', kind: 'wage', date: '2026-10-07', employee: 'Driver A', workType: 'Driver', basis: 'Daily', qty: 1, rate: 3000, otherPay: 0, method: 'Cash' },
    ],
    expense: [
      { id: 'ex1', kind: 'expense', date: '2026-10-01', category: 'Transport', description: '', method: 'Cash', amount: 5000 },
      { id: 'ex2', kind: 'expense', date: '2026-10-02', category: 'Electricity', description: '', method: 'Bank', amount: 15000 },
    ],
  };
}
