'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useBooks } from './BooksProvider';
import { Field, Modal, Notice, Toasts } from './ui';
import { defaultPeriod } from '@/lib/defaults';
import { downloadBlob } from '@/lib/client/download';
import type { BookData } from '@/lib/types';

type CountKey = keyof BookData;

const NAV: { group: string; items: { href: string; label: string; count?: CountKey }[] }[] = [
  { group: 'Overview', items: [{ href: '/dashboard', label: 'Dashboard' }] },
  {
    group: 'Daily entry',
    items: [
      { href: '/sales', label: 'Sales', count: 'sale' },
      { href: '/purchases', label: 'Purchases', count: 'purchase' },
      { href: '/customer-payments', label: 'Customer payments', count: 'cpay' },
      { href: '/supplier-payments', label: 'Supplier payments', count: 'spay' },
      { href: '/employee-pay', label: 'Employee pay', count: 'wage' },
      { href: '/expenses', label: 'Other expenses', count: 'expense' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { href: '/daily-summary', label: 'Daily summary' },
      { href: '/cash-book', label: 'Cash book' },
      { href: '/bank-book', label: 'Bank book' },
      { href: '/stock', label: 'Stock (kg)' },
      { href: '/customers-owe', label: 'Customers owe' },
      { href: '/customer-monthly', label: 'Customer monthly' },
      { href: '/owed-to-suppliers', label: 'Owed to suppliers' },
      { href: '/monthly-summary', label: 'Monthly summary' },
    ],
  },
  {
    group: 'Setup',
    items: [
      { href: '/customers', label: 'Customers', count: 'customer' },
      { href: '/suppliers', label: 'Suppliers', count: 'supplier' },
      { href: '/employees', label: 'Employees', count: 'employee' },
      { href: '/settings', label: 'Client settings' },
    ],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const { ready, user, practice, businesses, business, books, select, signOut } = useBooks();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <header className="topbar">
        <button className="btn btn-sm menu-btn" aria-expanded={menuOpen} aria-controls="sidebar" onClick={() => setMenuOpen((o) => !o)}>
          Menu
        </button>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark" aria-hidden>
            CW
          </span>
          <span className="brand-name">Chicken Wholesale Books</span>
        </Link>
        <div className="client-switch">
          {businesses.length ? (
            <select aria-label="Client" value={business?.id ?? ''} onChange={(e) => select(e.target.value)}>
              {!business ? <option value="">Choose a client…</option> : null}
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.role !== 'owner' ? ` (${b.role})` : ''}
                </option>
              ))}
            </select>
          ) : null}
          {ready ? (
            <button className="btn btn-sm" onClick={() => setNewOpen(true)}>
              New client
            </button>
          ) : null}
        </div>
        <div className="topbar-spacer" />
        {practice ? <span className="practice-badge">Practice mode · not saved</span> : null}
        {business ? (
          <button className="btn btn-sm btn-primary" onClick={() => setExportOpen(true)}>
            Export full Excel
          </button>
        ) : null}
        {ready ? (
          user ? (
            <button className="btn btn-sm hide-sm" onClick={() => void signOut()} title={user.email}>
              Sign out
            </button>
          ) : (
            <Link className="btn btn-sm" href="/login">
              Sign in
            </Link>
          )
        ) : null}
      </header>
      <div className="layout">
        <nav id="sidebar" className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Main">
          {NAV.map((g) => (
            <div className="nav-group" key={g.group}>
              <h3>{g.group}</h3>
              {g.items.map((it) => {
                const count = it.count && books ? books.data[it.count].length : null;
                return (
                  <Link key={it.href} href={it.href} className={`nav-link${pathname === it.href ? ' active' : ''}`} aria-current={pathname === it.href ? 'page' : undefined}>
                    <span>{it.label}</span>
                    {count !== null ? <span className="nav-count">{count}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
          {user ? (
            <div className="nav-group">
              <h3>Signed in</h3>
              <div className="small muted" style={{ padding: '0 10px', wordBreak: 'break-all' }}>
                {user.email}
              </div>
              <button className="btn btn-sm" style={{ margin: '8px 10px' }} onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          ) : null}
        </nav>
        <div className={`sidebar-backdrop${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
        <main className="main" id="main">
          {children}
        </main>
      </div>
      {newOpen ? <NewClientModal onClose={() => setNewOpen(false)} /> : null}
      {exportOpen ? <ExportModal onClose={() => setExportOpen(false)} /> : null}
      <Toasts />
    </>
  );
}

function NewClientModal({ onClose }: { onClose: () => void }) {
  const { createBusiness, notify } = useBooks();
  const router = useRouter();
  const p = defaultPeriod();
  const [v, setV] = useState({ name: '', owner: '', periodStart: p.periodStart, periodEnd: p.periodEnd });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: e.target.value }));

  return (
    <Modal title="New client" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await createBusiness(v);
          setBusy(false);
          if (!res.ok) {
            setErrors(res.errors ?? {});
            setError(res.error ?? 'Could not create the client.');
            return;
          }
          notify(`${v.name} created. Enter the opening balances.`);
          onClose();
          router.push('/settings');
        }}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="form-grid">
          <Field label="Business name" required error={errors.name} wide htmlFor="nc-name">
            <input id="nc-name" value={v.name} onChange={set('name')} required />
          </Field>
          <Field label="Owner name" wide htmlFor="nc-owner">
            <input id="nc-owner" value={v.owner} onChange={set('owner')} />
          </Field>
          <Field label="Period start" htmlFor="nc-ps" error={errors.period}>
            <input id="nc-ps" type="date" value={v.periodStart} onChange={set('periodStart')} required />
          </Field>
          <Field label="Period end" htmlFor="nc-pe" hint="Up to 24 months">
            <input id="nc-pe" type="date" value={v.periodEnd} onChange={set('periodEnd')} required />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create client'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ExportModal({ onClose }: { onClose: () => void }) {
  const { business, data } = useBooks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    void import('@/lib/excel').then((m) => setFileName(m.exportFileName(business)));
  }, [business]);

  if (!business) return null;
  return (
    <Modal title="Export full Excel workbook" onClose={onClose}>
      <p className="mt0">
        Builds the complete 21-sheet workbook for <b>{business.name}</b> with all master data and the period&apos;s entries. Formulas stay live, so the client can keep typing in the yellow cells.
      </p>
      <ul className="small muted">
        <li>Names used in entries but missing from the master lists are added with opening balance 0.</li>
        <li>Chicken types, expense categories and work types used in entries are added to the lists.</li>
        <li>Opening stock and physical counts are copied to the Stock Summary.</li>
        <li>Charts are not included in the workbook; the website shows them.</li>
      </ul>
      {fileName ? (
        <p>
          File: <b>{fileName}</b>
        </p>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {done ? <Notice>{done}</Notice> : null}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Close
        </button>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            setDone('');
            try {
              const [mod, excel] = await Promise.all([import('exceljs'), import('@/lib/excel')]);
              const ExcelJS = ((mod as unknown as { default?: unknown }).default ?? mod) as Parameters<typeof excel.buildWorkbookBuffer>[0];
              const buf = await excel.buildWorkbookBuffer(ExcelJS, { business, data });
              downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), excel.exportFileName(business));
              setDone('Download started. Check your downloads folder.');
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              setError(
                /fetch|network|load chunk|Loading chunk/i.test(msg)
                  ? 'No connection. The Excel builder could not be loaded — check your connection and try again.'
                  : `The workbook could not be built: ${msg}`,
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Building…' : 'Download workbook'}
        </button>
      </div>
    </Modal>
  );
}
