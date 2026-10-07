import type { Business, Lists } from './types';

// Default drop-down lists (requirements 5.4).
export const DEFAULT_CHICKEN_TYPES = ['Chicken', 'Boneless', 'Breast', 'Leg / Drumstick', 'Wings', 'Liver / Gizzard', 'Other'];
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Transport',
  'Electricity',
  'Water',
  'Ice',
  'Packaging',
  'Shop/Warehouse Rent',
  'Vehicle Expenses',
  'Repairs',
  'Telephone',
  'Other',
];
export const DEFAULT_WORK_TYPES = ['Cutting', 'Handling', 'Cleaning', 'Driver', 'Salesman', 'Helper', 'Other'];
export const DISCOUNT_TYPES = ['None', 'Amount', 'Per Kg', 'Percentage'] as const;
export const EXCEL_DISCOUNT_TYPES = ['Amount', 'Per Kg', 'Percentage'];
export const PAY_METHODS = ['Cash', 'Bank', 'Credit'] as const;
export const CASH_BANK = ['Cash', 'Bank'] as const;
export const PAY_BASES = ['Per Unit', 'Daily', 'Monthly', 'Commission'] as const;

export const MAX_PERIOD_MONTHS = 24;

export function defaultLists(): Lists {
  return {
    chickenTypes: [...DEFAULT_CHICKEN_TYPES],
    expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    workTypes: [...DEFAULT_WORK_TYPES],
  };
}

export function defaultPeriod(year = new Date().getFullYear()) {
  return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` };
}

export function newBusinessShape(input: Partial<Business> & { name: string }): Omit<Business, 'id'> {
  const period = defaultPeriod();
  return {
    name: input.name.trim(),
    owner: input.owner ?? '',
    type: input.type || 'Chicken Wholesale',
    address: input.address ?? '',
    phone: input.phone ?? '',
    email: input.email ?? '',
    preparedBy: input.preparedBy ?? '',
    periodStart: input.periodStart || period.periodStart,
    periodEnd: input.periodEnd || period.periodEnd,
    openingCash: Number(input.openingCash) || 0,
    openingBank: Number(input.openingBank) || 0,
    lists: input.lists ?? defaultLists(),
    stock: input.stock ?? {},
    members: input.members ?? [],
  };
}
