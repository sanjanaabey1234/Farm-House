import { randomUUID } from 'node:crypto';
import { COL, ensureIndexes, getDb } from '@/lib/server/db';
import { HttpError, handler, json, readJson, requireUser, toBusiness, type BusinessDoc } from '@/lib/server/http';
import { newBusinessShape } from '@/lib/defaults';
import { periodError } from '@/lib/validate';

// List the clients shared with the signed-in user.
export const GET = handler(async () => {
  const user = await requireUser();
  await ensureIndexes();
  const db = await getDb();
  const docs = await db
    .collection<BusinessDoc>(COL.businesses)
    .find({ 'members.email': user.email }, { projection: { name: 1, periodStart: 1, periodEnd: 1, members: 1 } })
    .sort({ name: 1 })
    .toArray();
  return json({
    businesses: docs.map((d) => ({
      id: d._id,
      name: d.name,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
      role: d.members.find((m) => m.email === user.email)?.role ?? 'viewer',
    })),
  });
});

// Create a new client; the creator becomes its owner.
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
  if (!name) throw new HttpError(400, 'Business name is required', { errors: { name: 'Required' } });
  const shape = newBusinessShape({
    name,
    owner: typeof body.owner === 'string' ? body.owner.trim().slice(0, 200) : '',
    periodStart: typeof body.periodStart === 'string' ? body.periodStart : undefined,
    periodEnd: typeof body.periodEnd === 'string' ? body.periodEnd : undefined,
    members: [{ email: user.email, role: 'owner' }],
  });
  const pErr = periodError(shape.periodStart, shape.periodEnd);
  if (pErr) throw new HttpError(400, pErr, { errors: { period: pErr } });
  const now = new Date();
  const doc: BusinessDoc = { _id: randomUUID(), ...shape, createdAt: now, updatedAt: now };
  const db = await getDb();
  await db.collection<BusinessDoc>(COL.businesses).insertOne(doc);
  return json({ business: toBusiness(doc), role: 'owner' }, 201);
});
