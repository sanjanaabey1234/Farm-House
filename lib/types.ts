// Shared data model (requirements section 5).

export type Role = 'owner' | 'contributor' | 'viewer';
export type PayMethod = 'Cash' | 'Bank' | 'Credit';
export type CashBank = 'Cash' | 'Bank';
export type DiscountType = 'None' | 'Amount' | 'Per Kg' | 'Percentage';
export type PayBasis = 'Per Unit' | 'Daily' | 'Monthly' | 'Commission';

export interface Member {
  email: string;
  role: Role;
}

export interface StockSetting {
  opening: number;
  physical: number | null;
}

export interface Lists {
  chickenTypes: string[];
  expenseCategories: string[];
  workTypes: string[];
}

export interface Business {
  id: string;
  name: string;
  owner: string;
  type: string;
  address: string;
  phone: string;
  email: string;
  preparedBy: string;
  periodStart: string; // yyyy-mm-dd
  periodEnd: string; // yyyy-mm-dd
  openingCash: number;
  openingBank: number;
  lists: Lists;
  stock: Record<string, StockSetting>;
  members: Member[];
  updatedAt?: number;
}

export interface Customer {
  id: string;
  kind: 'customer';
  code: string;
  name: string;
  phone: string;
  address: string;
  opening: number;
  active: boolean;
}

export interface Supplier {
  id: string;
  kind: 'supplier';
  code: string;
  name: string;
  phone: string;
  address: string;
  opening: number;
}

export interface Employee {
  id: string;
  kind: 'employee';
  code: string;
  name: string;
  position: string;
  basis: PayBasis;
  rate: number;
  phone: string;
  active: boolean;
}

export interface Sale {
  id: string;
  kind: 'sale';
  date: string;
  invoice: string;
  customer: string;
  chickenType: string;
  kg: number;
  price: number;
  discType: DiscountType;
  discValue: number;
  payment: PayMethod;
  received: number;
}

export interface Purchase {
  id: string;
  kind: 'purchase';
  date: string;
  supplier: string;
  invoice: string;
  chickenType: string;
  kg: number;
  cost: number;
  otherCost: number;
  payment: PayMethod;
  paid: number;
}

export interface CustomerPayment {
  id: string;
  kind: 'cpay';
  date: string;
  customer: string;
  method: CashBank;
  amount: number;
  ref: string;
}

export interface SupplierPayment {
  id: string;
  kind: 'spay';
  date: string;
  supplier: string;
  method: CashBank;
  amount: number;
  ref: string;
}

export interface Wage {
  id: string;
  kind: 'wage';
  date: string;
  employee: string;
  workType: string;
  basis: PayBasis;
  qty: number;
  rate: number;
  otherPay: number;
  method: CashBank;
}

export interface Expense {
  id: string;
  kind: 'expense';
  date: string;
  category: string;
  description: string;
  method: CashBank;
  amount: number;
}

export type MasterRecord = Customer | Supplier | Employee;
export type TxRecord = Sale | Purchase | CustomerPayment | SupplierPayment | Wage | Expense;
export type AnyRecord = MasterRecord | TxRecord;
export type Kind = AnyRecord['kind'];

export const MASTER_KINDS = ['customer', 'supplier', 'employee'] as const;
export const TX_KINDS = ['sale', 'purchase', 'cpay', 'spay', 'wage', 'expense'] as const;
export const ALL_KINDS: Kind[] = [...MASTER_KINDS, ...TX_KINDS];

export type RecordOf<K extends Kind> = Extract<AnyRecord, { kind: K }>;

/** Every record of one client, grouped by kind. */
export interface BookData {
  customer: Customer[];
  supplier: Supplier[];
  employee: Employee[];
  sale: Sale[];
  purchase: Purchase[];
  cpay: CustomerPayment[];
  spay: SupplierPayment[];
  wage: Wage[];
  expense: Expense[];
}

export function emptyBookData(): BookData {
  return { customer: [], supplier: [], employee: [], sale: [], purchase: [], cpay: [], spay: [], wage: [], expense: [] };
}

export function isTxKind(k: string): k is TxRecord['kind'] {
  return (TX_KINDS as readonly string[]).includes(k);
}
export function isMasterKind(k: string): k is MasterRecord['kind'] {
  return (MASTER_KINDS as readonly string[]).includes(k);
}
