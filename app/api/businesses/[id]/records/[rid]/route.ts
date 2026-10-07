import { HttpError, handler, json, loadBusiness, readJson, requireUser, toBusiness } from '@/lib/server/http';
import { recordFields, recordsCollection, toRecord, validateRecord } from '@/lib/server/records';

type Ctx = { params: Promise<{ id: string; rid: string }> };

// Edit one entry (only this document is changed).
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id, rid } = await ctx.params;
  const { doc } = await loadBusiness(id, user, 'contributor');
  const col = await recordsCollection();
  const existing = await col.findOne({ _id: rid, businessId: id, deleted: false });
  if (!existing) throw new HttpError(404, 'This entry was deleted by someone else.');
  const body = await readJson(req);
  const record = await validateRecord(existing.kind, body, toBusiness(doc), rid);
  const updated = await col.findOneAndUpdate(
    { _id: rid, businessId: id },
    { $set: { ...recordFields(record), kind: existing.kind, updatedBy: user.email, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  return json({ record: toRecord(updated!) });
});

// Delete one entry. A deletion marker is kept so other open screens remove it too.
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id, rid } = await ctx.params;
  await loadBusiness(id, user, 'contributor');
  const col = await recordsCollection();
  const res = await col.updateOne(
    { _id: rid, businessId: id },
    { $set: { deleted: true, updatedBy: user.email, updatedAt: new Date() }, $unset: { nameKey: '' } },
  );
  if (!res.matchedCount) throw new HttpError(404, 'Entry not found');
  return json({ ok: true });
});
