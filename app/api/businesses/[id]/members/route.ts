import { COL, getDb } from '@/lib/server/db';
import { isEmail, normaliseEmail } from '@/lib/server/auth';
import { HttpError, handler, json, loadBusiness, readJson, requireUser, toBusiness, type BusinessDoc } from '@/lib/server/http';
import type { Member, Role } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

// Share the client with someone (by email) as Contributor or Viewer, or change their role. Owner only.
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { doc } = await loadBusiness(id, user, 'owner');
  const body = await readJson(req);
  const email = normaliseEmail(body.email);
  const role = body.role as Role;
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address');
  if (role !== 'contributor' && role !== 'viewer') throw new HttpError(400, 'Role must be Contributor or Viewer');
  if (email === user.email) throw new HttpError(400, 'You are the owner of this client');
  const members: Member[] = doc.members.filter((m) => m.email !== email);
  members.push({ email, role });
  const db = await getDb();
  const updated = await db
    .collection<BusinessDoc>(COL.businesses)
    .findOneAndUpdate({ _id: id }, { $set: { members, updatedAt: new Date() } }, { returnDocument: 'after' });
  return json({ business: toBusiness(updated!), role: 'owner' });
});

// Stop sharing with someone. Owner only.
export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { doc } = await loadBusiness(id, user, 'owner');
  const body = await readJson(req);
  const email = normaliseEmail(body.email);
  if (email === user.email) throw new HttpError(400, 'The owner cannot be removed');
  const members = doc.members.filter((m) => m.email !== email);
  const db = await getDb();
  const updated = await db
    .collection<BusinessDoc>(COL.businesses)
    .findOneAndUpdate({ _id: id }, { $set: { members, updatedAt: new Date() } }, { returnDocument: 'after' });
  return json({ business: toBusiness(updated!), role: 'owner' });
});
