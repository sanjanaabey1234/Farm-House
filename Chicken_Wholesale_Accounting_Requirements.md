# Chicken Wholesale Accounting System — Requirements Specification

| | |
|---|---|
| **Document version** | 1.0 (complete, updated) |
| **Date** | 08 October 2026 |
| **Deliverables covered** | 1. Excel accounting workbook  2. Multi-client web app ("Chicken Wholesale Books") with full Excel export |
| **Currency / units** | Sri Lankan Rupees (Rs.), weight in kilograms (kg), dates as dd/mm/yyyy |

---

## 1. Purpose

An accountant keeps the books for one or more **chicken wholesale businesses**. These businesses buy chicken by the kg from suppliers and sell it by the kg to hotels, restaurants and shops. Each customer may get a different price and discount, and may pay in cash, by bank transfer, or on credit.

The system must let the accountant:

1. Record daily purchases, sales, payments, wages and expenses.
2. See automatically what each customer owes and what is owed to each supplier.
3. Track cash, bank and stock (kg) day by day.
4. Produce daily, customer-wise and monthly summaries, including gross and net profit.
5. Hand the client a complete, working Excel workbook at any time.

## 2. Users and roles

| Role | Who | What they can do |
|---|---|---|
| **Accountant (owner)** | The person who set up the web app | Everything: add/delete clients, enter and edit all data, export |
| **Contributor** | Client owner or staff the app is shared with as Contributor | Enter and edit data, export |
| **Viewer** | Anyone shared as Viewer / Commenter | Read-only: all pages and reports, no forms, no edit/delete buttons |
| **Excel user** | Client or accountant using the exported workbook | Type in yellow input cells; all other sheets calculate |

## 3. Scope

### In scope
- Multi-client bookkeeping for chicken wholesale (separate books per client).
- Sales by kg with per-customer actual price and three discount types.
- Cash, bank and credit handling for sales and purchases, including part payments.
- Purchases by kg with other costs (transport/handling).
- Employee pay: per unit, daily, monthly and commission.
- Other running expenses.
- Daily summary, cash book, bank book, stock (kg), debtors, creditors.
- **Customer-wise monthly summary**, for one customer and for all customers.
- Monthly summary with gross and net profit and month-end balances.
- Dashboard.
- CSV export of every table.
- **Full Excel workbook export** with live formulas.

### Out of scope (current version)
- Tax/VAT calculation, invoices printing, double-entry general ledger, multi-currency, payroll statutory deductions (EPF/ETF), bank reconciliation import.

---

## 4. Business rules and calculations

These rules are the same in the website and in the Excel workbook.

### 4.1 Sales
| Item | Rule |
|---|---|
| Gross Sales | `Kg × Price per kg` |
| Price | The **actual** price charged to that customer on that day. It is entered on every sale and never taken from a fixed price list. |
| Discount — Amount | Fixed Rs. off the invoice (e.g. Rs. 500) |
| Discount — Per Kg | `Discount value × Kg` (e.g. Rs. 10 × 30 kg = Rs. 300) |
| Discount — Percentage | `Gross Sales × Discount value ÷ 100` (e.g. 5 = 5%) |
| Discount — None | 0 |
| Net Sales | `Gross Sales − Discount` |
| Payment method | Cash, Bank or Credit |
| Amount Received | Cash/Bank: defaults to Net Sales; can be lowered for a part payment. Credit: always 0. |
| Credit Added | `Net Sales − Amount Received` (this is what the customer now owes for this sale) |

### 4.2 Percentage rule (agreed)
All percentages are typed as **whole numbers**: `5` means 5%, `1` means 1%, `0.5` means 0.5%. This applies to percentage discounts and to salesman commission. In Excel, type the plain number and not `5%`.

### 4.3 Purchases
| Item | Rule |
|---|---|
| Purchase Cost | `Kg Received × Cost per kg` |
| Total Cost | `Purchase Cost + Other Cost` |
| Amount Paid | Cash/Bank: defaults to Total Cost; can be lowered for a part payment. Credit: always 0. |
| Balance | `Total Cost − Amount Paid` (added to what is owed to the supplier) |

### 4.4 Customer and supplier payments
- A customer payment reduces that customer's balance. It goes to cash or bank.
- A supplier payment reduces what is owed to that supplier. It is paid from cash or bank.

### 4.5 Employee pay
| Pay basis | Quantity means | Calculation |
|---|---|---|
| Per Unit | Number of chickens / units (e.g. cutting) | `Quantity × Rate` |
| Daily | Number of days | `Days × Daily rate` |
| Monthly | Number of months | `Months × Monthly salary` |
| Commission | Sales amount (Rs.) | `Sales × Commission ÷ 100` |

- Total Pay = Calculated Pay + Other Pay (bonus, allowance).
- Wages are paid from Cash or Bank.
- Wages are recorded **only** in Employee Pay, never in Other Expenses, so they are not counted twice.
- Choosing an employee fills in their standard position, pay basis and rate. For daily workers, quantity defaults to 1.

### 4.6 Other expenses
Default categories: Transport, Electricity, Water, Ice, Packaging, Shop/Warehouse Rent, Vehicle Expenses, Repairs, Telephone, Other. Each expense is paid from Cash or Bank.

### 4.7 Cash book and bank book
For each day, separately for Cash and for Bank:
- **In** = sales money received by that method + customer payments by that method
- **Out** = purchases paid + supplier payments + wages + expenses, all by that method
- **Balance** = previous balance + In − Out. The first balance is the opening cash or bank balance.

### 4.8 Debtors (customers owe)
`Balance Due = Opening Balance + Credit Sales − Payments`

### 4.9 Creditors (owed to suppliers)
`Balance Due = Opening Balance + Credit Purchases (unpaid balances) − Payments`

### 4.10 Stock (kg)
- `Available = Opening Stock + Purchases (kg)`
- `Estimated Closing = Available − Sales (kg)`
- Optional **Physical Count**: `Difference = Physical − Estimated` and `Difference % = Difference ÷ Available`.
- Stock is calculated per chicken type. It is an **estimate**: processing loss, spoilage and weight differences only show when a physical count is entered.

### 4.11 Profit (monthly)
| Item | Rule |
|---|---|
| Average cost per kg | Month's total purchase cost ÷ month's kg purchased. If nothing was bought that month, the **period average** is used. |
| Cost of Chicken Sold | `Kg Sold × Average cost per kg` |
| Gross Profit | `Net Sales − Cost of Chicken Sold` |
| Expenses | Other Expenses + Employee Pay |
| Net Profit | `Gross Profit − Expenses` |

> **Assumption:** the average cost method is a management estimate. The final cost-of-sales treatment must be confirmed against the client's accounting method.

### 4.12 Customer-wise monthly summary
For a selected customer, for every month of the period:

| Column | Rule |
|---|---|
| Sales Lines | Number of sale entries for the customer in the month |
| Kg Bought | Sum of kg |
| Gross Sales, Discounts, Net Sales | Sums for the month |
| Avg Price/Kg | `Gross Sales ÷ Kg` (before discounts) |
| Paid at Sale | Amount received on that month's sales |
| Credit Sales | Credit added in the month |
| Payments Received | Customer payments in the month |
| Balance Due Month-End | `Opening + all credit sales up to month-end − all payments up to month-end` |

There is also an **all-customers grid**: one row per customer, one column of net sales per month, plus Total Kg, Total Net Sales and Balance Due.

### 4.13 Accounting period
- Each client has a Period Start and Period End (default: 1 January – 31 December).
- Reports only include entries dated within the period.
- The website rejects entries dated outside the period and tells the user to change the date or the period.
- The website allows a maximum period of **24 months**.

---

## 5. Data model

### 5.1 Client (business)
Business name *(required)*, owner name, business type (default "Chicken Wholesale"), address, telephone, email, prepared by, period start, period end, opening cash in hand, opening bank balance, drop-down lists (chicken types, expense categories, work types), stock settings per chicken type (opening kg, physical count kg).

### 5.2 Master lists (per client)
| Entity | Fields |
|---|---|
| Customer | ID, name *(required, unique)*, phone, address, opening balance, active (Yes/No) |
| Supplier | ID, name *(required, unique)*, phone, address, opening balance |
| Employee | ID, name *(required, unique)*, position/work type, pay basis, standard rate, phone, active (Yes/No) |

### 5.3 Transactions (per client)
Fields marked * are required.

| Entity | Fields |
|---|---|
| Sale | date*, invoice no., customer*, chicken type, kg*, price/kg*, discount type, discount value, payment (Cash/Bank/Credit), amount received |
| Purchase | date*, supplier*, invoice no., chicken type, kg received*, cost/kg*, other cost, payment, amount paid |
| Customer payment | date*, customer*, cash/bank, amount*, reference/notes |
| Supplier payment | date*, supplier*, cash/bank, amount*, reference/notes |
| Employee pay | date*, employee*, work type, pay basis, quantity*, rate*, other pay, cash/bank |
| Expense | date*, category, description, cash/bank, amount* |

### 5.4 Default drop-down lists (editable per client)
- **Chicken types:** Chicken, Boneless, Breast, Leg / Drumstick, Wings, Liver / Gizzard, Other
- **Discount types:** None (website only), Amount, Per Kg, Percentage
- **Payment methods:** Cash, Bank, Credit
- **Work types:** Cutting, Handling, Cleaning, Driver, Salesman, Helper, Other
- **Pay basis:** Per Unit, Daily, Monthly, Commission
- **Expense categories:** see 4.6

---

## 6. Excel workbook requirements

### 6.1 General
- Font Arial. **One sheet per transaction type.** Do not create one sheet per day; each transaction is a new row, and the summaries group by day and month.
- Colour legend:
  - Yellow fill with blue text = **input**
  - Grey fill with black text = formula
  - Grey fill with green text = formula pulling from another sheet
- Drop-downs (data validation) for customer, supplier, employee, chicken type, discount type, payment method, cash/bank, expense category, work type and pay basis.
- Header notes explain discount values, amount received, commission % and the cost-of-sales assumption.
- No formula errors (#REF!, #DIV/0!, #NAME? etc.).
- The file opens on the Dashboard and recalculates fully when opened.

### 6.2 Sheets (21)

| # | Sheet | Type | Contents |
|---|---|---|---|
| 1 | Instructions | Info | Colour legend, what each sheet is for, daily workflow, important notes |
| 2 | Dashboard | Auto | Large tiles: Sales, Expenses (incl. wages), Net Profit, Gross Profit, Chicken Sold (kg), Chicken Purchased (kg), Cash, Bank, Customer Outstanding, Supplier Outstanding, Today's Sales, Today's Kg Sold |
| 3 | Client Information | Input | Business details, period start/end, opening cash and bank |
| 4 | Customers | Input | Master list (section 5.2) |
| 5 | Suppliers | Input | Master list |
| 6 | Employees | Input | Master list |
| 7 | Sales | Input + calc | Date, Invoice, Customer, Chicken Type, Kg, Price/Kg, **Gross**, Discount Type, Discount Value, **Discount**, **Net Sales**, Payment, Amount Received, **Credit Added** |
| 8 | Customer Payments | Input | Date, Customer, Cash/Bank, Amount, Reference |
| 9 | Purchases | Input + calc | Date, Supplier, Invoice, Chicken Type, Kg, Cost/Kg, **Purchase Cost**, Other Cost, **Total Cost**, Payment, Amount Paid, **Balance** |
| 10 | Supplier Payments | Input | Date, Supplier, Cash/Bank, Amount, Reference |
| 11 | Employee Pay | Input + calc | Date, Employee, Work Type, Pay Basis, Quantity/Days/Sales, Rate/Commission %, **Calculated Pay**, Other Pay, **Total Pay**, Cash/Bank |
| 12 | Expenses | Input | Date, Category, Description, Cash/Bank, Amount |
| 13 | Daily Summary | Auto | One row per day of the period: Kg Sold, Gross, Discounts, Net, Received, Credit Sales, Kg Purchased, Purchases, Expenses + Wages; totals row |
| 14 | Cash Book | Auto | Opening balance; per day: sales received, customer payments, total in, purchases paid, supplier payments, wages, expenses, total out, balance; closing balance |
| 15 | Bank | Auto | Same as Cash Book for bank |
| 16 | Stock Summary | Auto + input | Per chicken type: opening kg *(input)*, purchased, available, sold, estimated closing, physical count *(input)*, difference, difference % |
| 17 | Customer Debtors | Auto | Per customer: opening, credit sales, payments, balance due; total |
| 18 | Customer Monthly | Auto + selector | Customer drop-down; opening balance; balance due now; month-by-month table (section 4.12); all-customers grid by month |
| 19 | Supplier Creditors | Auto | Per supplier: opening, credit purchases, payments, balance due; total |
| 20 | Monthly Summary | Auto | Per month: Kg Purchased, Kg Sold, Net Sales, Purchases, Avg Cost/Kg, Cost of Chicken Sold, Gross Profit, Expenses + Wages, Net Profit, month-end Cash, Bank, Debtors, Creditors; totals/closing row; period average cost/kg |
| 21 | Lists | Input | Editable drop-down lists |

### 6.3 Capacity
| | Blank template | Exported from website |
|---|---|---|
| Sales rows | 2,000 | larger of 2,000 or entries + 500 |
| Other entry sheets | 1,000 rows each | larger of 1,000 or entries + 300 |
| Customers | 200 | larger of 200 or customers + 50 |
| Suppliers / Employees | 100 | larger of 100 or count + 30 |
| Days (Daily, Cash, Bank) | 366 | exact number of days in the period |
| Months (Monthly, Customer Monthly) | 12 | exact number of months in the period (up to 24) |
| List items | 15 per list | at least 15, more if needed |

---

## 7. Web app requirements ("Chicken Wholesale Books")

### 7.1 Clients (multi-tenant)
- A client switcher in the top bar. Each client's data is completely separate.
- **New client:** business name *(required)*, owner, period start/end. After creation the app opens Client settings to enter opening balances.
- **Client settings:** all client information, period, opening cash and bank, and the three editable lists (one item per line).
- **Delete client:** the user types the business name to confirm. This removes the client and all its entries permanently.
- The last selected client is remembered on that device.

### 7.2 Navigation
| Group | Pages |
|---|---|
| Overview | Dashboard |
| Daily entry | Sales, Purchases, Customer payments, Supplier payments, Employee pay, Other expenses |
| Reports | Daily summary, Cash book, Bank book, Stock (kg), Customers owe, **Customer monthly**, Owed to suppliers, Monthly summary |
| Setup | Customers, Suppliers, Employees, Client settings |

The sidebar shows entry counts. On phones the sidebar opens from a **Menu** button.

### 7.3 Entry pages (common behaviour)
- An entry form above a table of entries, newest first.
- The date defaults to today, or to the last date used. Required fields are marked *.
- A **live preview** shows calculated values (Sales: Gross, Discount, Net, Credit added; Purchases: Purchase cost, Total, Balance owed; Employee pay: Calculated and Total pay).
- Customer, supplier and employee fields suggest names from the master lists. New names are allowed and appear in the reports.
- Sales and Customer payments show **"<Customer> owes Rs. X"** when a customer is chosen.
- Amount received/paid fills in automatically and is locked at 0 for Credit.
- The discount value is disabled when the discount type is None.
- Employee pay labels change with pay basis (chickens / days / months / sales Rs.).
- Validation: required fields; the date must be within the period; master names must be unique.
- **Edit** loads the row into the form. **Delete** needs a second click on "Confirm" within a few seconds.
- Filters: month and free-text search. A totals row appears under every table.
- After saving, the form clears (keeping the date) and the cursor moves to the next field for fast entry.

### 7.4 Reports
| Page | Requirement |
|---|---|
| **Dashboard** | Choose the whole period or one month. Tiles: Net sales (with kg), Gross profit, Expenses + wages, Net profit (with % of sales), Chicken bought, Cash, Bank, Customers owe, Owed to suppliers, Today's sales. Bar chart of net sales and net profit by month. Biggest customer balances. Latest 6 sales. |
| Daily summary | Every day with activity: kg sold, gross, discounts, net, received, credit, kg bought, purchases, expenses + wages, kg sold − bought; totals |
| Cash book / Bank book | Opening, total in, total out and closing tiles; daily table with running balance; a warning if the balance goes negative |
| Stock (kg) | Per chicken type, with opening kg and physical count editable in the table |
| Customers owe / Owed to suppliers | Total tile, count of open balances, table sorted by balance. Click a name to open their **account**: opening, each credit sale/purchase and payment, and running balance. |
| **Customer monthly** | Customer selector. Tiles: net sales, kg bought (with sales-line count), average price/kg, opening balance, balance due now. Month-by-month table (section 4.12) with totals. Net-sales-by-month chart for that customer. All-customers grid; clicking a name selects that customer. |
| Monthly summary | As section 6.2 sheet 20, with a note explaining the cost method |

### 7.5 Export
- **Export CSV** on every entry page and report, including the Customer monthly table and the all-customers grid. Files open in Excel and keep Sinhala/Tamil characters (UTF-8 with BOM).
- **Export full Excel** (top bar) builds the complete 21-sheet workbook from section 6 for the selected client:
  - All master data and the period's entries are filled in.
  - Customer/supplier/employee names used in entries but missing from master lists are added with opening balance 0.
  - Chicken types, expense categories and work types used in entries are added to the lists.
  - Opening stock and physical counts are copied to the Stock Summary.
  - Formulas stay live; the file name is `<Client>-accounts-<date>.xlsx`.
  - The viewer confirms each download. Errors are shown as plain messages (no connection, downloads switched off, download already waiting).

### 7.6 Practice mode
If saving is not available (for example when signed out), the app shows **"Practice mode · not saved"**. A sample client can be loaded to try the app; nothing is stored.

### 7.7 Data storage (website)
- Data is stored in the app's own database, shared by everyone the app is shared with.
- Structure:
  - `businesses/{clientId}` holds the client details.
  - `businesses/{clientId}/master/people` holds customers, suppliers and employees.
  - Each transaction type is stored in "buckets" of about 8 days per month (days 1–8, 9–16, 17–24, 25–end), each tagged with its month.
- Adding or editing one entry does not overwrite other people's entries in the same bucket.
- The app loads only the buckets inside the client's period. Changes from other users appear live.
- **Limits:** about 25,000 stored documents per app (roughly 48 per transaction type per client per year), and 256 KB per bucket (about 1,000+ entries per 8 days). The user sees a clear message if storage is full.

### 7.8 Look and usability
- Works on desktop and phone (about 400 px wide); wide tables scroll sideways inside their box.
- Light and dark themes follow the device setting.
- Amounts are shown as Rs. with thousands separators, negatives in brackets, zero as "–". Kg is shown to 2 decimals. Dates are dd/mm/yyyy.
- Keyboard focus is visible, and reduced-motion settings are respected.

---

## 8. Daily workflow (accountant)

1. Collect the client's records (handwritten book or photos).
2. Enter **purchases** (supplier, kg, cost/kg, payment).
3. Enter **sales** (customer, kg, actual price/kg, discount, payment).
4. Record **customer payments** and **supplier payments**.
5. Record **employee pay** and **other expenses**.
6. **Check:** compare kg bought with kg sold (Daily summary / Stock), and compare the Cash book and Bank book with actual cash and the bank statement.
7. **Month-end:** review the Monthly summary, Customer monthly and Dashboard, then export the full Excel workbook for the client.

---

## 9. Acceptance test (sample client)

Load or seed this data. The period is 01/01/2026 – 31/12/2026, opening cash and bank are 0, and opening Chicken stock is 100 kg.

**Opening balances:** ABC Hotel owes Rs. 25,000; XYZ Restaurant owes 0; Supplier A is owed Rs. 50,000.

**Entries:**

| Date | Entry | Detail |
|---|---|---|
| 01/10 | Sale INV001 | ABC Hotel, 50 kg × 1,050, Amount discount 500, Cash, received 52,000 |
| 01/10 | Sale INV002 | XYZ Restaurant, 30 kg × 1,080, Per Kg discount 10, Credit |
| 01/10 | Purchase P001 | Supplier A, 600 kg × 900, other cost 5,000, Cash, paid 545,000 |
| 02/10 | Customer payment | ABC Hotel, Bank, 20,000 |
| 02/10 | Supplier payment | Supplier A, Bank, 50,000 |
| 06/10 | Employee pay | Worker A 500 × 20; Worker B 350 × 20; Driver A 1 day × 3,000; Salesman A 1% of 500,000 + other 1,000 (all Cash) |
| 07/10 | Employee pay | Driver A 1 day × 3,000 (Cash) |
| 01/10, 02/10 | Expenses | Transport 5,000 (Cash); Electricity 15,000 (Bank) |

**Expected results:**

| Check | Expected |
|---|---|
| INV001 | Gross 52,500, discount 500, net 52,000, credit 0 |
| INV002 | Gross 32,400, discount 300, net 32,100, credit 32,100 |
| Purchase P001 | Total 545,000, balance 0 |
| Wages | Worker A 10,000; Worker B 7,000; Driver A 3,000 × 2; Salesman A 6,000 → **29,000** |
| October net sales / kg sold | **84,100** / **80 kg** |
| Average cost per kg | 545,000 ÷ 600 = **908.33** |
| Cost of chicken sold | 80 × 908.33 = **72,667** |
| Gross profit | **11,433** |
| Expenses + wages | 20,000 + 29,000 = **49,000** |
| Net profit | **−37,567** |
| Closing cash | 0 + 52,000 − 545,000 − 29,000 − 5,000 = **−527,000** |
| Closing bank | 0 + 20,000 − 50,000 − 15,000 = **−45,000** |
| Customers owe | ABC Hotel **5,000**; XYZ Restaurant **32,100**; total **37,100** |
| Owed to suppliers | Supplier A **0** |
| Stock (Chicken) | 100 + 600 − 80 = **620 kg** |
| Customer monthly, ABC Hotel, October | 1 line, 50 kg, gross 52,500, discount 500, net 52,000, avg price 1,050, paid at sale 52,000, credit 0, payments 20,000, month-end balance **5,000**. Jan–Sep balance is 25,000. |
| Exported Excel | Same figures as the website, with no formula errors |

The negative cash and bank in this sample are expected, because it has no opening balances.

---

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Accuracy | The website and the exported Excel must give identical figures for the same data. |
| Performance | Full Excel export for a typical client completes in a few seconds. Reports update immediately after an entry. |
| Concurrency | Several users can enter data at the same time without losing each other's entries. |
| Access | The app is private to the owner until shared. Viewers cannot change data. |
| Reliability | If a save fails, the form keeps its values and shows why ("Not saved. Check your connection…", "Storage is full…", "You can view these books but not change them."). |
| Portability | Exported Excel works in Microsoft Excel and LibreOffice. |

## 11. Known limitations and assumptions

1. **Charts are not included in the exported Excel**, because the export library cannot draw charts. All figures and tables are included, and the website shows the charts.
2. Cost of chicken sold uses the **average cost method** (section 4.11). Confirm it with the client's accounting method.
3. Stock is an estimate until a physical count is entered.
4. The standalone blank Excel template made earlier read percentages differently (values above 1 as whole numbers, below 1 as fractions). The agreed rule is now **whole numbers only** (section 4.2), and the website export follows it. Use the website export as the current workbook.
5. The web app is hosted on claude.ai and is not on the client's own domain.
6. Entries outside the client's period are not shown or exported. Start a new period, or extend it (maximum 24 months).

## 12. Possible next steps (not yet built)

- Printable customer statements and invoices (PDF).
- Supplier-wise monthly summary, matching Customer monthly.
- Import of opening data from an existing Excel file.
- A self-hosted version (e.g. Laravel + Livewire + MySQL) on the client's own server and domain.
