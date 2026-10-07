'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Field, Notice } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [v, setV] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: e.target.value }));
  const isLogin = mode === 'login';

  return (
    <div className="auth-wrap">
      <form
        className="card auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const res = await api(`/api/auth/${mode}`, { method: 'POST', body: isLogin ? { email: v.email, password: v.password } : v });
          setBusy(false);
          if (!res.ok) {
            setError(res.error ?? 'Something went wrong.');
            return;
          }
          window.location.href = '/dashboard';
        }}
      >
        <div className="brand" style={{ marginBottom: 14 }}>
          <span className="brand-mark" aria-hidden>
            CW
          </span>
          <span>Chicken Wholesale Books</span>
        </div>
        <h2>{isLogin ? 'Sign in' : 'Create an account'}</h2>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {!isLogin ? (
          <Field label="Your name" required htmlFor="a-name">
            <input id="a-name" autoComplete="name" value={v.name} onChange={set('name')} required />
          </Field>
        ) : null}
        <Field label="Email" required htmlFor="a-email">
          <input id="a-email" type="email" autoComplete="email" value={v.email} onChange={set('email')} required />
        </Field>
        <Field label="Password" required htmlFor="a-pass" hint={isLogin ? undefined : 'At least 8 characters'}>
          <input id="a-pass" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={v.password} onChange={set('password')} required minLength={isLogin ? undefined : 8} />
        </Field>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
        </button>
        <p className="small muted">
          {isLogin ? (
            <>
              New here? <Link href="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          )}
          {' · '}
          <Link href="/dashboard">Try practice mode</Link> (nothing is saved)
        </p>
        <p className="small muted">
          Someone shared their books with you? Create an account with the same email address they shared with.
        </p>
      </form>
    </div>
  );
}
