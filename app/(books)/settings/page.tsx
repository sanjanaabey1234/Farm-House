'use client';

import { useEffect, useState } from 'react';
import { useBooks } from '@/components/BooksProvider';
import { BooksPage, Card, ConfirmDeleteButton, Field, Notice, PageHead } from '@/components/ui';
import { MAX_PERIOD_MONTHS } from '@/lib/defaults';
import type { Business, Role } from '@/lib/types';

export default function SettingsPage() {
  return (
    <BooksPage>
      <Inner />
    </BooksPage>
  );
}

type Form = Record<'name' | 'owner' | 'type' | 'address' | 'phone' | 'email' | 'preparedBy' | 'periodStart' | 'periodEnd' | 'openingCash' | 'openingBank' | 'chickenTypes' | 'expenseCategories' | 'workTypes', string>;

const toForm = (b: Business): Form => ({
  name: b.name,
  owner: b.owner,
  type: b.type,
  address: b.address,
  phone: b.phone,
  email: b.email,
  preparedBy: b.preparedBy,
  periodStart: b.periodStart,
  periodEnd: b.periodEnd,
  openingCash: b.openingCash ? String(b.openingCash) : '',
  openingBank: b.openingBank ? String(b.openingBank) : '',
  chickenTypes: b.lists.chickenTypes.join('\n'),
  expenseCategories: b.lists.expenseCategories.join('\n'),
  workTypes: b.lists.workTypes.join('\n'),
});

function Inner() {
  const { business, canEdit, updateBusiness, notify } = useBooks();
  const [v, setV] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const businessId = business?.id;

  useEffect(() => {
    if (business) setV(toForm(business));
    // reload the form only when switching client
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  if (!business || !v) return null;
  const bind = (k: keyof Form) => ({
    id: `set-${k}`,
    value: v[k],
    disabled: !canEdit,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }),
  });
  const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  return (
    <>
      <PageHead title="Client settings" sub="Business details, accounting period, opening balances and drop-down lists." />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await updateBusiness({
            name: v.name,
            owner: v.owner,
            type: v.type,
            address: v.address,
            phone: v.phone,
            email: v.email,
            preparedBy: v.preparedBy,
            periodStart: v.periodStart,
            periodEnd: v.periodEnd,
            openingCash: Number(v.openingCash.replace(/,/g, '')) || 0,
            openingBank: Number(v.openingBank.replace(/,/g, '')) || 0,
            lists: { chickenTypes: lines(v.chickenTypes), expenseCategories: lines(v.expenseCategories), workTypes: lines(v.workTypes) },
          });
          setBusy(false);
          setErrors(res.errors ?? {});
          setError(res.ok ? '' : (res.error ?? 'Not saved.'));
          if (res.ok) notify('Client settings saved');
        }}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Card title="Business">
          <div className="form-grid">
            <Field label="Business name" required error={errors.name} wide htmlFor="set-name">
              <input {...bind('name')} />
            </Field>
            <Field label="Owner name" htmlFor="set-owner">
              <input {...bind('owner')} />
            </Field>
            <Field label="Business type" htmlFor="set-type">
              <input {...bind('type')} />
            </Field>
            <Field label="Address" wide htmlFor="set-address">
              <input {...bind('address')} />
            </Field>
            <Field label="Telephone" htmlFor="set-phone">
              <input {...bind('phone')} />
            </Field>
            <Field label="Email" htmlFor="set-email">
              <input type="email" {...bind('email')} />
            </Field>
            <Field label="Prepared by" htmlFor="set-preparedBy">
              <input {...bind('preparedBy')} />
            </Field>
          </div>
        </Card>
        <Card title="Period and opening balances">
          <div className="form-grid">
            <Field label="Period start" required error={errors.period} htmlFor="set-periodStart">
              <input type="date" {...bind('periodStart')} />
            </Field>
            <Field label="Period end" required hint={`At most ${MAX_PERIOD_MONTHS} months`} htmlFor="set-periodEnd">
              <input type="date" {...bind('periodEnd')} />
            </Field>
            <Field label="Opening cash in hand (Rs.)" htmlFor="set-openingCash">
              <input inputMode="decimal" {...bind('openingCash')} />
            </Field>
            <Field label="Opening bank balance (Rs.)" htmlFor="set-openingBank">
              <input inputMode="decimal" {...bind('openingBank')} />
            </Field>
          </div>
          <p className="small muted">Reports only include entries dated within the period. Entries outside it stay stored and come back if you extend the period.</p>
        </Card>
        <Card title="Drop-down lists (one item per line)">
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Field label="Chicken types" htmlFor="set-chickenTypes">
              <textarea rows={9} {...bind('chickenTypes')} />
            </Field>
            <Field label="Expense categories" htmlFor="set-expenseCategories">
              <textarea rows={9} {...bind('expenseCategories')} />
            </Field>
            <Field label="Work types" htmlFor="set-workTypes">
              <textarea rows={9} {...bind('workTypes')} />
            </Field>
          </div>
        </Card>
        {canEdit ? (
          <div className="form-actions" style={{ marginBottom: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
            <button type="button" className="btn" onClick={() => setV(toForm(business))}>
              Undo changes
            </button>
          </div>
        ) : null}
      </form>
      <Sharing />
      <DeleteClient />
    </>
  );
}

function Sharing() {
  const { business, isOwner, practice, share, unshare, notify, user } = useBooks();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('contributor');
  const [error, setError] = useState('');
  if (!business) return null;
  if (practice) {
    return (
      <Card title="Sharing">
        <p className="muted mt0">Sign in to save these books and share them with the client owner or staff.</p>
      </Card>
    );
  }
  return (
    <Card title="Sharing">
      <p className="small muted mt0">
        Contributors can enter, edit and export. Viewers can read every page and report but cannot change anything. People sign in with the email you share with.
      </p>
      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              {isOwner ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {business.members.map((m) => (
              <tr key={m.email}>
                <td>
                  {m.email}
                  {m.email === user?.email ? ' (you)' : ''}
                </td>
                <td>{m.role === 'owner' ? 'Owner' : m.role === 'contributor' ? 'Contributor' : 'Viewer'}</td>
                {isOwner ? (
                  <td className="actions">
                    {m.role !== 'owner' ? (
                      <ConfirmDeleteButton
                        label="Remove"
                        onConfirm={async () => {
                          const res = await unshare(m.email);
                          notify(res.ok ? `${m.email} removed` : (res.error ?? 'Not removed'), res.ok ? 'ok' : 'error');
                        }}
                      />
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isOwner ? (
        <form
          className="toolbar"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await share(email.trim(), role);
            setError(res.ok ? '' : (res.error ?? 'Not shared'));
            if (res.ok) {
              notify(`Shared with ${email.trim()}`);
              setEmail('');
            }
          }}
        >
          <input type="email" placeholder="name@example.com" aria-label="Email to share with" value={email} onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: 280 }} required />
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="contributor">Contributor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button className="btn" type="submit">
            Share
          </button>
          {error ? <span className="field-error">{error}</span> : null}
        </form>
      ) : (
        <p className="small muted">Only the owner can change sharing.</p>
      )}
    </Card>
  );
}

function DeleteClient() {
  const { business, isOwner, deleteBusiness, notify } = useBooks();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  if (!business || !isOwner) return null;
  return (
    <Card title="Delete client">
      <p className="mt0">
        This removes <b>{business.name}</b> and all its entries permanently. Type the business name to confirm.
      </p>
      <div className="toolbar">
        <input aria-label="Type the business name to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={business.name} style={{ maxWidth: 320 }} />
        <button
          type="button"
          className="btn btn-danger"
          disabled={confirm.trim() !== business.name.trim()}
          onClick={async () => {
            const name = business.name;
            const res = await deleteBusiness(confirm);
            if (!res.ok) setError(res.error ?? 'Not deleted');
            else notify(`${name} deleted`);
          }}
        >
          Delete client permanently
        </button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Card>
  );
}
