# Chicken Wholesale Books

Multi-client bookkeeping for chicken wholesale businesses, built with **Next.js 16 (App Router, TypeScript)** and **MongoDB Atlas**. It implements `Chicken_Wholesale_Accounting_Requirements.md`:

- Separate books per client, with a client switcher. Roles are **Owner**, **Contributor** and **Viewer**, and you share a client by email.
- Entry pages: Sales, Purchases, Customer payments, Supplier payments, Employee pay and Other expenses. Each has a live preview, edit, delete with confirm, month and search filters, a totals row and CSV export.
- Reports: Dashboard (with a chart), Daily summary, Cash book, Bank book, Stock (kg), Customers owe and Owed to suppliers (each with account drill-down), Customer monthly (with the all-customers grid) and Monthly summary.
- **Export full Excel**: the 21-sheet workbook with live formulas, drop-downs and the colour legend. The browser builds it with ExcelJS.
- **Practice mode** when signed out: you can load a sample client and nothing is saved.
- Live updates: other users' changes appear within about 15 seconds.

## 1. Set up MongoDB Atlas

1. Create a cluster in [MongoDB Atlas](https://cloud.mongodb.com). The free M0 tier works. For users in several regions you can use a multi-region cluster or a **Global Cluster**.
2. Under **Database Access**, create a database user.
3. Under **Network Access**, allow your server's IP. `0.0.0.0/0` also works for testing.
4. Click **Connect → Drivers** and copy the `mongodb+srv://…` connection string.

## 2. Configure

```bash
cp .env.example .env.local
```

Fill in `MONGODB_URI` and `AUTH_SECRET`. To generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Optional: `MONGODB_READ_PREFERENCE=nearest` lets a multi-region or global cluster serve reads from the nearest region.

## 3. Run

```bash
npm install
npm run db:indexes      # optional – the app also creates indexes on first use
npm run dev             # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

You can deploy to any Node host, such as Vercel, Render, Railway or a VPS. Set the same environment variables there.

## 4. First use

1. Open the app and click **Sign in → Create an account**.
2. Click **New client** in the top bar and enter the business name, owner and period. The app then opens **Client settings** so you can enter the opening cash and bank balances.
3. Enter the master lists (Customers, Suppliers, Employees) and the daily entries.
4. To share a client, go to **Client settings → Sharing** and add the person's email as Contributor or Viewer. They sign up with that email and see the client.

## Other scripts

| Command | What it does |
|---|---|
| `npm run test:acceptance` | Runs the acceptance test from section 9 of the spec (45 checks). It also writes the sample workbook to `out/`. |
| `npm run template` | Writes the blank Excel workbook (deliverable 1) to `out/Chicken-Wholesale-Accounts-Template.xlsx`. |
| `npm run typecheck` | Runs the TypeScript check. |

## How it is organised

```
lib/types.ts        data model (spec §5)
lib/calc.ts         all business rules and reports (spec §4) – used by every page
lib/excel.ts        21-sheet workbook builder with live formulas (spec §6)
lib/validate.ts     input validation shared by the forms and the API
lib/server/*        MongoDB connection, sessions (JWT cookie), access checks
app/api/*           REST API (auth, businesses, records, members)
app/(books)/*       the pages
components/*        shell, forms, tables, chart
```

### Data storage (MongoDB)

| Collection | Contents |
|---|---|
| `users` | email, name, bcrypt password hash |
| `businesses` | client details, period, opening balances, lists, stock settings, `members` [{email, role}] |
| `records` | one document per entry or master record: `{businessId, kind, date, …fields, deleted, updatedAt}` |

Each entry is a separate document. When several people enter data at the same time, nobody overwrites anyone else's work, and the "bucket" workaround from spec §7.7 is no longer needed. Deleting an entry leaves a deletion marker, so other open screens remove it too. The app loads only master records and entries inside the client's period. Name uniqueness is enforced with a unique partial index.

## Notes and assumptions

- Website figures and Excel figures come from the same rules. The exported sample workbook was checked by evaluating every formula: there were no formula errors, and all figures matched spec §9.
- Cost of chicken sold uses the **average cost method** (spec §4.11). Confirm it with the client's accounting method.
- The exported Excel has no charts, because ExcelJS cannot draw them. The website shows the charts.
- The Excel sheet does not auto-fill employee details, because a cell cannot be both an input and a formula. Choose the work type, pay basis and rate in each row.
- On a Sales or Purchases row in Excel, an empty payment method is treated as Credit.
