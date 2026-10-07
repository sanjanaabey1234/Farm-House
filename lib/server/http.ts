import 'server-only';
import { NextResponse } from 'next/server';
import { dbErrorResponse, getDb, COL, ensureIndexes } from './db';
import { getSessionUser, type SessionUser } from './auth';
import type { Business, Role } from '../types';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Wraps a route handler: turns HttpError / database errors into JSON responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...(e.extra ?? {}) }, e.status);
      const { status, message } = dbErrorResponse(e);
      return json({ error: message }, status);
    }
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, 'Please sign in. Without signing in the app runs in practice mode and nothing is saved.');
  return user;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Invalid request body');
  }
}

export interface BusinessDoc extends Omit<Business, 'id' | 'updatedAt'> {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toBusiness(doc: BusinessDoc): Business {
  const { _id, createdAt: _c, updatedAt, ...rest } = doc;
  void _c;
  return { id: _id, ...rest, updatedAt: updatedAt?.getTime?.() ?? 0 };
}

const RANK: Record<Role, number> = { viewer: 0, contributor: 1, owner: 2 };

/** Loads a business the user is a member of and checks their role. */
export async function loadBusiness(id: string, user: SessionUser, need: Role = 'viewer'): Promise<{ doc: BusinessDoc; role: Role }> {
  await ensureIndexes();
  const db = await getDb();
  const doc = await db.collection<BusinessDoc>(COL.businesses).findOne({ _id: id });
  const member = doc?.members?.find((m) => m.email === user.email);
  if (!doc || !member) throw new HttpError(404, 'Client not found, or it has not been shared with you.');
  if (RANK[member.role] < RANK[need]) {
    throw new HttpError(403, need === 'owner' ? 'Only the owner can do this.' : 'You can view these books but not change them.');
  }
  return { doc, role: member.role };
}
