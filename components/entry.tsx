'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBooks } from './BooksProvider';
import { CsvButton, DataTable, exportTableCSV, type Column } from './DataTable';
import { Card, ConfirmDeleteButton, Notice } from './ui';
import { fmtDate, monthKey, monthLabel } from '@/lib/dates';
import { slug } from '@/lib/client/download';
import type { AnyRecord, Kind } from '@/lib/types';

export type FormValues = Record<string, string>;

/** Form state shared by all entry pages (requirements 7.3). */
export function useEntryForm(kind: Kind, blank: (date: string) => FormValues, opts: { focusAfterSave: string; toInput?: (v: FormValues) => Record<string, unknown> }) {
  const { saveRecord, lastDate, setLastDate, notify, canEdit } = useBooks();
  const [values, setValues] = useState<FormValues>(() => blank(lastDate));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = useCallback((k: string, v: string) => {
    setValues((o) => ({ ...o, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e));
  }, []);

  const bind = (k: string) => ({
    id: `${kind}-${k}`,
    name: k,
    value: values[k] ?? '',
    'aria-invalid': errors[k] ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value),
    disabled: !canEdit,
  });

  const reset = useCallback(
    (keepDate?: string) => {
      setValues(blank(keepDate ?? lastDate));
      setErrors({});
      setFormError('');
      setEditingId(null);
    },
    [blank, lastDate],
  );

  const startEdit = useCallback((record: AnyRecord, toValues: (r: AnyRecord) => FormValues) => {
    setValues(toValues(record));
    setEditingId(record.id);
    setErrors({});
    setFormError('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => formRef.current?.querySelector<HTMLElement>('input, select')?.focus(), 50);
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    const input = opts.toInput ? opts.toInput(values) : values;
    const res = await saveRecord(kind, input, editingId ?? undefined);
    setBusy(false);
    if (!res.ok) {
      // keep the form values and show why (requirements section 10)
      setErrors(res.errors ?? {});
      setFormError(res.error ?? 'Not saved.');
      return;
    }
    notify(editingId ? 'Entry updated' : 'Saved');
    const d = values.date || lastDate;
    if (values.date) setLastDate(values.date);
    reset(d);
    setTimeout(() => document.getElementById(`${kind}-${opts.focusAfterSave}`)?.focus(), 30);
  };

  return { values, setValues, set, bind, errors, formError, editingId, busy, submit, reset, startEdit, formRef };
}

export function FormActions({ editing, busy, onCancel }: { editing: boolean; busy: boolean; onCancel: () => void }) {
  const { canEdit } = useBooks();
  if (!canEdit) return null;
  return (
    <div className="form-actions">
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : editing ? 'Update entry' : 'Save entry'}
      </button>
      {editing ? (
        <button type="button" className="btn" onClick={onCancel}>
          Cancel edit
        </button>
      ) : null}
      <span className="small muted">Fields marked * are required.</span>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return message ? <Notice tone="error">{message}</Notice> : null;
}

/** Entries table with month filter, free-text search, totals row, CSV, edit and delete (newest first). */
export function EntryList<T extends AnyRecord & { date: string }>({
  title,
  kind,
  rows,
  columns,
  searchText,
  onEdit,
  csvName,
}: {
  title: string;
  kind: Kind;
  rows: T[];
  columns: (shown: T[]) => Column<T>[];
  searchText: (r: T) => string;
  onEdit: (r: T) => void;
  csvName: string;
}) {
  const { books, canEdit, deleteRecord, notify, business } = useBooks();
  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (!month || monthKey(r.date) === month) && (!needle || searchText(r).toLowerCase().includes(needle)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rows, month, q, searchText]);
  const cols = columns(shown);

  return (
    <Card
      title={`${title} (${shown.length}${shown.length !== rows.length ? ` of ${rows.length}` : ''})`}
      actions={<CsvButton onClick={() => exportTableCSV(`${slug(business?.name ?? '')}-${csvName}${month ? `-${month}` : ''}`, cols, shown, true)} />}
    >
      <div className="toolbar">
        <select aria-label="Filter by month" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All months</option>
          {books?.months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Search…" aria-label="Search entries" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <DataTable
        columns={cols}
        rows={shown}
        rowKey={(r) => r.id}
        showTotal
        empty={rows.length ? 'No entries match the filter.' : 'No entries yet.'}
        actions={
          canEdit
            ? (r) => (
                <>
                  <button type="button" className="btn btn-sm" onClick={() => onEdit(r)}>
                    Edit
                  </button>
                  <ConfirmDeleteButton
                    onConfirm={async () => {
                      const res = await deleteRecord(kind, r.id);
                      notify(res.ok ? 'Entry deleted' : (res.error ?? 'Not deleted'), res.ok ? 'ok' : 'error');
                    }}
                  />
                </>
              )
            : undefined
        }
      />
    </Card>
  );
}

export const dateCol = <T extends { date: string }>(): Column<T> => ({ key: 'date', label: 'Date', render: (r) => fmtDate(r.date), csv: (r) => fmtDate(r.date) });

/** Name input with suggestions from a master list (new names allowed). */
export function NameInput({ listId, names, ...props }: { listId: string; names: string[] } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <input list={listId} autoComplete="off" {...props} />
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  );
}

export function Preview({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="preview" aria-live="polite">
      {items.map(([k, v]) => (
        <div key={k}>
          <span>{k}: </span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);
