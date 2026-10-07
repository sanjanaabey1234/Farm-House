'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/client/api';
import { computeBooks, type Books } from '@/lib/calc';
import { todayISO } from '@/lib/dates';
import { newBusinessShape } from '@/lib/defaults';
import { sampleBusiness, sampleData } from '@/lib/sample';
import type { AnyRecord, BookData, Business, Kind, Role } from '@/lib/types';
import { emptyBookData, isMasterKind } from '@/lib/types';
import { cleanBusiness, cleanRecord, nameClash, periodError } from '@/lib/validate';

export interface User {
  email: string;
  name: string;
}
export interface BizSummary {
  id: string;
  name: string;
  role: Role;
  periodStart: string;
  periodEnd: string;
}
export interface Result<T = void> {
  ok: boolean;
  error?: string;
  errors?: Record<string, string>;
  value?: T;
}
export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}

interface Ctx {
  ready: boolean;
  user: User | null;
  practice: boolean;
  businesses: BizSummary[];
  business: Business | null;
  role: Role | null;
  canEdit: boolean;
  isOwner: boolean;
  data: BookData;
  books: Books | null;
  loading: boolean;
  loadError: string | null;
  lastDate: string;
  setLastDate(d: string): void;
  select(id: string): void;
  createBusiness(input: { name: string; owner?: string; periodStart?: string; periodEnd?: string }): Promise<Result<string>>;
  updateBusiness(patch: Partial<Business>): Promise<Result>;
  deleteBusiness(confirmName: string): Promise<Result>;
  saveRecord(kind: Kind, raw: Record<string, unknown>, id?: string): Promise<Result<AnyRecord>>;
  deleteRecord(kind: Kind, id: string): Promise<Result>;
  share(email: string, role: Role): Promise<Result>;
  unshare(email: string): Promise<Result>;
  loadSample(): void;
  signOut(): Promise<void>;
  toasts: Toast[];
  notify(text: string, tone?: Toast['tone']): void;
}

const BooksContext = createContext<Ctx | null>(null);

export function useBooks(): Ctx {
  const c = useContext(BooksContext);
  if (!c) throw new Error('useBooks must be used inside <BooksProvider>');
  return c;
}

const LAST_CLIENT_KEY = 'cwb:lastClient';
const POLL_MS = 15000;

function storageGet(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}
function storageSet(k: string, v: string) {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* storage blocked */
  }
}

function group(records: (AnyRecord & { deleted?: boolean })[]): BookData {
  const d = emptyBookData();
  for (const r of records) if (!r.deleted && d[r.kind]) (d[r.kind] as AnyRecord[]).push(r);
  return d;
}

function applyRecord(d: BookData, r: AnyRecord & { deleted?: boolean }): BookData {
  const list = (d[r.kind] as AnyRecord[] | undefined) ?? [];
  const rest = list.filter((x) => x.id !== r.id);
  return { ...d, [r.kind]: r.deleted ? rest : [...rest, r] };
}

function removeRecord(d: BookData, kind: Kind, id: string): BookData {
  return { ...d, [kind]: (d[kind] as AnyRecord[]).filter((x) => x.id !== id) };
}

function nextCode(list: { code: string }[], prefix: string): string {
  let max = 0;
  for (const r of list) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(r.code || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(Math.max(max, list.length) + 1).padStart(3, '0')}`;
}

let toastSeq = 1;
const localId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

export function BooksProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<BizSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [data, setData] = useState<BookData>(emptyBookData);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastDate, setLastDate] = useState(todayISO());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const practice = ready && !user;
  const sinceRef = useRef(0);
  const businessRef = useRef<Business | null>(null);
  useEffect(() => {
    businessRef.current = business;
  }, [business]);
  const loadSeq = useRef(0);
  // Practice mode keeps everything in memory only.
  const practiceStore = useRef(new Map<string, { business: Business; data: BookData }>());

  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);

  // ------------------------------------------------------------ loading

  const loadBusiness = useCallback(
    async (id: string) => {
      const seq = ++loadSeq.current;
      setLoading(true);
      setLoadError(null);
      const res = await api<{ serverTime: number; records: AnyRecord[]; business: Business; role: Role }>(`/api/businesses/${id}/records`);
      if (seq !== loadSeq.current) return;
      setLoading(false);
      if (!res.ok || !res.data) {
        setLoadError(res.error ?? 'Could not load this client.');
        return;
      }
      sinceRef.current = res.data.serverTime;
      setBusiness(res.data.business);
      setRole(res.data.role);
      setData(group(res.data.records));
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await api<{ user: User | null }>('/api/auth/me');
      if (cancelled) return;
      const u = me.ok ? (me.data?.user ?? null) : null;
      setUser(u);
      if (u) {
        const list = await api<{ businesses: BizSummary[] }>('/api/businesses');
        if (cancelled) return;
        if (!list.ok) setLoadError(list.error ?? 'Could not load your clients.');
        const items = list.data?.businesses ?? [];
        setBusinesses(items);
        const last = storageGet(LAST_CLIENT_KEY);
        const pick = items.find((b) => b.id === last) ?? items[0];
        if (pick) {
          setCurrentId(pick.id);
          await loadBusiness(pick.id);
        }
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBusiness]);

  // Live changes from other users (polling the change feed).
  useEffect(() => {
    if (!user || !currentId) return;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible' || !sinceRef.current) return;
      busy = true;
      const since = sinceRef.current - 5000; // small overlap; applying a change twice is harmless
      const res = await api<{ serverTime: number; records: (AnyRecord & { deleted?: boolean })[]; business?: Business; role: Role }>(
        `/api/businesses/${currentId}/records?since=${since}`,
      );
      busy = false;
      if (!res.ok || !res.data) {
        if (res.status === 404) {
          notify('This client is no longer shared with you.', 'error');
          setBusinesses((l) => l.filter((b) => b.id !== currentId));
          setCurrentId(null);
          setBusiness(null);
        }
        return;
      }
      const d = res.data;
      sinceRef.current = d.serverTime;
      setRole(d.role);
      if (d.business) {
        const nb = d.business;
        const old = businessRef.current;
        const periodChanged = !!old && (old.periodStart !== nb.periodStart || old.periodEnd !== nb.periodEnd);
        setBusiness(nb);
        setBusinesses((l) => l.map((b) => (b.id === nb.id ? { ...b, name: nb.name, periodStart: nb.periodStart, periodEnd: nb.periodEnd, role: d.role } : b)));
        if (periodChanged) {
          await loadBusiness(currentId);
          return;
        }
      }
      if (d.records.length) setData((old) => d.records.reduce(applyRecord, old));
    };
    const timer = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user, currentId, loadBusiness, notify]);

  // ------------------------------------------------------------ actions

  const select = useCallback(
    (id: string) => {
      setCurrentId(id);
      storageSet(LAST_CLIENT_KEY, id);
      if (user) {
        setBusiness(null);
        setData(emptyBookData());
        void loadBusiness(id);
      } else {
        const p = practiceStore.current.get(id);
        if (p) {
          setBusiness(p.business);
          setData(p.data);
          setRole('owner');
        }
      }
    },
    [user, loadBusiness],
  );

  // keep the practice store in sync with what is on screen
  useEffect(() => {
    if (!user && business) practiceStore.current.set(business.id, { business, data });
  }, [user, business, data]);

  const createBusiness: Ctx['createBusiness'] = useCallback(
    async (input) => {
      const name = input.name?.trim();
      if (!name) return { ok: false, error: 'Business name is required', errors: { name: 'Required' } };
      const shape = newBusinessShape({ ...input, name });
      const pErr = periodError(shape.periodStart, shape.periodEnd);
      if (pErr) return { ok: false, error: pErr, errors: { period: pErr } };
      if (!user) {
        const b: Business = { id: localId(), ...shape, members: [] };
        practiceStore.current.set(b.id, { business: b, data: emptyBookData() });
        setBusinesses((l) => [...l, { id: b.id, name: b.name, role: 'owner', periodStart: b.periodStart, periodEnd: b.periodEnd }]);
        setCurrentId(b.id);
        setBusiness(b);
        setData(emptyBookData());
        setRole('owner');
        return { ok: true, value: b.id };
      }
      const res = await api<{ business: Business; role: Role }>('/api/businesses', { method: 'POST', body: { name, owner: input.owner, periodStart: shape.periodStart, periodEnd: shape.periodEnd } });
      if (!res.ok || !res.data) return { ok: false, error: res.error, errors: res.errors };
      const b = res.data.business;
      const summary: BizSummary = { id: b.id, name: b.name, role: 'owner', periodStart: b.periodStart, periodEnd: b.periodEnd };
      setBusinesses((l) => [...l, summary].sort((a, c) => a.name.localeCompare(c.name)));
      setCurrentId(b.id);
      storageSet(LAST_CLIENT_KEY, b.id);
      setBusiness(b);
      setRole('owner');
      setData(emptyBookData());
      sinceRef.current = Date.now();
      return { ok: true, value: b.id };
    },
    [user],
  );

  const updateBusiness: Ctx['updateBusiness'] = useCallback(
    async (patch) => {
      if (!business) return { ok: false, error: 'No client selected' };
      if (role === 'viewer') return { ok: false, error: 'You can view these books but not change them.' };
      const { business: cleaned, errors } = cleanBusiness(patch as Record<string, unknown>, business);
      if (Object.keys(errors).length) return { ok: false, error: Object.values(errors)[0], errors };
      if (!user) {
        const merged = patch.stock ? { ...cleaned, stock: { ...business.stock, ...cleaned.stock } } : cleaned;
        setBusiness(merged);
        setBusinesses((l) => l.map((b) => (b.id === merged.id ? { ...b, name: merged.name, periodStart: merged.periodStart, periodEnd: merged.periodEnd } : b)));
        return { ok: true };
      }
      const res = await api<{ business: Business; role: Role }>(`/api/businesses/${business.id}`, { method: 'PATCH', body: patch });
      if (!res.ok || !res.data) return { ok: false, error: res.error, errors: res.errors };
      const nb = res.data.business;
      const periodChanged = nb.periodStart !== business.periodStart || nb.periodEnd !== business.periodEnd;
      setBusiness(nb);
      setBusinesses((l) => l.map((b) => (b.id === nb.id ? { ...b, name: nb.name, periodStart: nb.periodStart, periodEnd: nb.periodEnd } : b)));
      if (periodChanged) await loadBusiness(nb.id);
      return { ok: true };
    },
    [business, role, user, loadBusiness],
  );

  const deleteBusiness: Ctx['deleteBusiness'] = useCallback(
    async (confirmName) => {
      if (!business) return { ok: false, error: 'No client selected' };
      if (confirmName.trim() !== business.name.trim()) return { ok: false, error: 'Type the business name exactly to confirm.' };
      if (user) {
        const res = await api(`/api/businesses/${business.id}`, { method: 'DELETE', body: { confirmName } });
        if (!res.ok) return { ok: false, error: res.error };
      } else practiceStore.current.delete(business.id);
      const rest = businesses.filter((b) => b.id !== business.id);
      setBusinesses(rest);
      setBusiness(null);
      setData(emptyBookData());
      setCurrentId(null);
      if (rest[0]) select(rest[0].id);
      return { ok: true };
    },
    [business, businesses, user, select],
  );

  const saveRecord: Ctx['saveRecord'] = useCallback(
    async (kind, raw, id) => {
      if (!business) return { ok: false, error: 'No client selected' };
      if (role === 'viewer') return { ok: false, error: 'You can view these books but not change them.' };
      const input = { ...raw };
      if (isMasterKind(kind) && !String(input.code ?? '').trim()) {
        const prefix = kind === 'customer' ? 'C' : kind === 'supplier' ? 'S' : 'E';
        input.code = id ? (data[kind].find((r) => r.id === id)?.code ?? '') : nextCode(data[kind], prefix);
      }
      const { record, errors } = cleanRecord(kind, { ...input, id: id ?? '' }, business);
      if (record && isMasterKind(kind) && nameClash(kind, (record as { name: string }).name, id ?? '', data[kind])) {
        errors.name = 'Already in the list. Names must be unique.';
      }
      if (!record || Object.keys(errors).length) return { ok: false, error: Object.values(errors)[0], errors };
      if (!user) {
        const saved = { ...record, id: id ?? localId() } as AnyRecord;
        setData((d) => applyRecord(d, saved));
        return { ok: true, value: saved };
      }
      const res = id
        ? await api<{ record: AnyRecord }>(`/api/businesses/${business.id}/records/${id}`, { method: 'PATCH', body: input })
        : await api<{ record: AnyRecord }>(`/api/businesses/${business.id}/records`, { method: 'POST', body: { ...input, kind } });
      if (!res.ok || !res.data) return { ok: false, error: res.error, errors: res.errors };
      const saved = res.data.record;
      setData((d) => applyRecord(d, saved));
      return { ok: true, value: saved };
    },
    [business, role, user, data],
  );

  const deleteRecord: Ctx['deleteRecord'] = useCallback(
    async (kind, id) => {
      if (!business) return { ok: false, error: 'No client selected' };
      if (role === 'viewer') return { ok: false, error: 'You can view these books but not change them.' };
      if (user) {
        const res = await api(`/api/businesses/${business.id}/records/${id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) return { ok: false, error: res.error };
      }
      setData((d) => removeRecord(d, kind, id));
      return { ok: true };
    },
    [business, role, user],
  );

  const share: Ctx['share'] = useCallback(
    async (email, r) => {
      if (!business || !user) return { ok: false, error: 'Sign in to share a client.' };
      const res = await api<{ business: Business }>(`/api/businesses/${business.id}/members`, { method: 'POST', body: { email, role: r } });
      if (!res.ok || !res.data) return { ok: false, error: res.error };
      setBusiness(res.data.business);
      return { ok: true };
    },
    [business, user],
  );

  const unshare: Ctx['unshare'] = useCallback(
    async (email) => {
      if (!business || !user) return { ok: false };
      const res = await api<{ business: Business }>(`/api/businesses/${business.id}/members`, { method: 'DELETE', body: { email } });
      if (!res.ok || !res.data) return { ok: false, error: res.error };
      setBusiness(res.data.business);
      return { ok: true };
    },
    [business, user],
  );

  const loadSample = useCallback(() => {
    if (user) return;
    const b = sampleBusiness(`sample-${Date.now()}`);
    const d = sampleData();
    practiceStore.current.set(b.id, { business: b, data: d });
    setBusinesses((l) => [...l, { id: b.id, name: b.name, role: 'owner', periodStart: b.periodStart, periodEnd: b.periodEnd }]);
    setCurrentId(b.id);
    setBusiness(b);
    setData(d);
    setRole('owner');
    setLastDate('2026-10-01');
  }, [user]);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }, []);

  const books = useMemo(() => (business ? computeBooks(business, data) : null), [business, data]);

  const value: Ctx = {
    ready,
    user,
    practice,
    businesses,
    business,
    role,
    canEdit: !!business && role !== 'viewer',
    isOwner: role === 'owner',
    data,
    books,
    loading,
    loadError,
    lastDate,
    setLastDate,
    select,
    createBusiness,
    updateBusiness,
    deleteBusiness,
    saveRecord,
    deleteRecord,
    share,
    unshare,
    loadSample,
    signOut,
    toasts,
    notify,
  };

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}
