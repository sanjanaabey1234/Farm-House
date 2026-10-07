import 'server-only';
import type { Collection } from 'mongodb';
import { COL, getDb } from './db';
import { HttpError } from './http';
import { cleanRecord } from '../validate';
import type { AnyRecord, Business, Kind } from '../types';
import { ALL_KINDS, isMasterKind } from '../types';

export interface RecordDoc {
  _id: string;
  businessId: string;
  kind: Kind;
  date?: string;
  nameKey?: string;
  deleted: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  [field: string]: unknown;
}

const INTERNAL = new Set(['_id', 'businessId', 'nameKey', 'deleted', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt']);

export function toRecord(doc: RecordDoc): AnyRecord & { deleted?: boolean } {
  const out: Record<string, unknown> = { id: doc._id };
  for (const [k, v] of Object.entries(doc)) if (!INTERNAL.has(k)) out[k] = v;
  if (doc.deleted) out.deleted = true;
  return out as unknown as AnyRecord & { deleted?: boolean };
}

export async function recordsCollection(): Promise<Collection<RecordDoc>> {
  const db = await getDb();
  return db.collection<RecordDoc>(COL.records);
}

/** Validates input for `kind`; throws 400 with field errors. Checks name uniqueness for master lists. */
export async function validateRecord(kind: unknown, raw: Record<string, unknown>, business: Business, id: string): Promise<AnyRecord> {
  if (typeof kind !== 'string' || !ALL_KINDS.includes(kind as Kind)) throw new HttpError(400, 'Unknown entry type');
  const { record, errors } = cleanRecord(kind as Kind, { ...raw, id }, business);
  if (!record || Object.keys(errors).length) throw new HttpError(400, Object.values(errors)[0] || 'Check the form', { errors });
  if (isMasterKind(kind)) {
    const col = await recordsCollection();
    const name = (record as { name: string }).name;
    const clash = await col.findOne({ businessId: business.id, kind: kind as Kind, nameKey: name.trim().toLowerCase(), deleted: false, _id: { $ne: id } });
    if (clash) throw new HttpError(409, `"${name}" is already in the list. Names must be unique.`, { errors: { name: 'Already in the list' } });
  }
  return record;
}

export function recordFields(record: AnyRecord): Record<string, unknown> {
  const { id: _id, ...fields } = record as AnyRecord & Record<string, unknown>;
  void _id;
  const out: Record<string, unknown> = { ...fields };
  if (isMasterKind(record.kind)) out.nameKey = (record as { name: string }).name.trim().toLowerCase();
  return out;
}
