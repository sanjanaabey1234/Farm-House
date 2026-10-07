import { randomUUID } from 'node:crypto';
import { handler, json, loadBusiness, readJson, requireUser, toBusiness } from '@/lib/server/http';
import { recordFields, recordsCollection, toRecord, validateRecord, type RecordDoc } from '@/lib/server/records';
import { MASTER_KINDS } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Without `since`: every master record plus the transactions inside the client's period.
 * With `since` (ms): everything changed after that time, including deletions, so other users' entries appear live.
 */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { doc, role } = await loadBusiness(id, user);
  const business = toBusiness(doc);
  const serverTime = Date.now();
  const col = await recordsCollection();
  const since = Number(new URL(req.url).searchParams.get('since'));

  if (since > 0) {
    const docs = await col.find({ businessId: id, updatedAt: { $gt: new Date(since) } }).limit(5000).toArray();
    return json({
      serverTime,
      records: docs.map(toRecord),
      business: (business.updatedAt ?? 0) > since ? business : undefined,
      role,
    });
  }

  const docs = await col
    .find({
      businessId: id,
      deleted: false,
      $or: [{ kind: { $in: [...MASTER_KINDS] } }, { date: { $gte: business.periodStart, $lte: business.periodEnd } }],
    })
    .toArray();
  return json({ serverTime, records: docs.map(toRecord), business, role });
});

// Add one entry. Each entry is its own document, so people entering at the same time never overwrite each other.
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { doc } = await loadBusiness(id, user, 'contributor');
  const body = await readJson(req);
  const recId = randomUUID();
  const record = await validateRecord(body.kind, body, toBusiness(doc), recId);
  const now = new Date();
  const rec: RecordDoc = {
    _id: recId,
    businessId: id,
    ...recordFields(record),
    kind: record.kind,
    deleted: false,
    createdBy: user.email,
    updatedBy: user.email,
    createdAt: now,
    updatedAt: now,
  };
  const col = await recordsCollection();
  await col.insertOne(rec);
  return json({ record: toRecord(rec) }, 201);
});
