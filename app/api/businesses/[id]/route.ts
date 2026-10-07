import { COL, getDb } from '@/lib/server/db';
import { HttpError, handler, json, loadBusiness, readJson, requireUser, toBusiness, type BusinessDoc } from '@/lib/server/http';
import { cleanBusiness } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { doc, role } = await loadBusiness(id, user);
  return json({ business: toBusiness(doc), role });
});

// Update client settings, period, opening balances, lists or stock settings (contributors and owner).
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { doc, role } = await loadBusiness(id, user, 'contributor');
  const body = await readJson(req);
  delete body.members; // sharing goes through /members (owner only)
  delete body.id;
  const { business, errors } = cleanBusiness(body, toBusiness(doc));
  if (Object.keys(errors).length) throw new HttpError(400, Object.values(errors)[0], { errors });

  const allowed = ['name', 'owner', 'type', 'address', 'phone', 'email', 'preparedBy', 'periodStart', 'periodEnd', 'openingCash', 'openingBank', 'lists'] as const;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (k in body) set[k] = business[k];
  // Stock settings are set per chicken type so two people editing different rows do not overwrite each other.
  if (body.stock && typeof body.stock === 'object') for (const [t, v] of Object.entries(business.stock)) set[`stock.${t.replace(/[.$]/g, '_')}`] = v;

  const db = await getDb();
  const updated = await db
    .collection<BusinessDoc>(COL.businesses)
    .findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' });
  if (!updated) throw new HttpError(404, 'Client not found');
  return json({ business: toBusiness(updated), role });
});

// Delete the client and all its entries permanently (owner only; the business name must be typed to confirm).
export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { doc } = await loadBusiness(id, user, 'owner');
  const body = await readJson(req);
  if (typeof body.confirmName !== 'string' || body.confirmName.trim() !== doc.name.trim()) {
    throw new HttpError(400, 'Type the business name exactly to confirm.');
  }
  const db = await getDb();
  await db.collection(COL.records).deleteMany({ businessId: id });
  await db.collection<BusinessDoc>(COL.businesses).deleteOne({ _id: id });
  return json({ ok: true });
});
