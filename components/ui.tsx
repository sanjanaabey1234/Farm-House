'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useBooks } from './BooksProvider';

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children ? <div className="toolbar" style={{ marginBottom: 0 }}>{children}</div> : null}
    </div>
  );
}

export function Card({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title || actions ? (
        <div className="card-head">
          {title ? <h2>{title}</h2> : <span />}
          {actions ? <div className="toolbar" style={{ marginBottom: 0 }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Tile({ label, value, sub, negative }: { label: string; value: ReactNode; sub?: ReactNode; negative?: boolean }) {
  return (
    <div className={`tile${negative ? ' neg' : ''}`}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub ? <div className="tile-sub">{sub}</div> : null}
    </div>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  wide,
  children,
  htmlFor,
}: {
  label: ReactNode;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={`field${wide ? ' wide' : ''}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      {error ? <div className="field-error" role="alert">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return <div className={`notice${tone === 'info' ? '' : ` ${tone}`}`} role={tone === 'error' ? 'alert' : undefined}>{children}</div>;
}

/** Delete needs a second click on "Confirm" within a few seconds (requirements 7.3). */
export function ConfirmDeleteButton({ onConfirm, label = 'Delete', disabled }: { onConfirm: () => void | Promise<void>; label?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <button
      type="button"
      className={`btn btn-sm btn-danger${armed ? ' confirming' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          if (timer.current) clearTimeout(timer.current);
          void onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 4000);
        }
      }}
    >
      {armed ? 'Confirm' : label}
    </button>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Wraps every page: shows loading / no-client states and the viewer notice. */
export function BooksPage({ children }: { children: ReactNode }) {
  const { ready, business, loading, loadError, practice, businesses, loadSample, role } = useBooks();
  if (!ready || (loading && !business)) return <div className="empty">Loading…</div>;
  if (loadError && !business) return <Notice tone="error">{loadError}</Notice>;
  if (!business) {
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>{businesses.length ? 'Choose a client' : 'No clients yet'}</h2>
        <p className="muted">
          {businesses.length
            ? 'Pick a client from the switcher in the top bar.'
            : 'Create a client with the "New client" button in the top bar. Each client has completely separate books.'}
        </p>
        {practice ? (
          <>
            <Notice tone="warn">
              Practice mode · not saved. <a href="/login">Sign in</a> to save your books to the database.
            </Notice>
            <button className="btn btn-primary" onClick={loadSample}>
              Load sample client
            </button>
          </>
        ) : null}
      </div>
    );
  }
  return (
    <>
      {role === 'viewer' ? <Notice>You can view these books but not change them.</Notice> : null}
      {children}
    </>
  );
}

export function Toasts() {
  const { toasts } = useBooks();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === 'error' ? ' error' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
