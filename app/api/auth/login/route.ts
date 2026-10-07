import bcrypt from 'bcryptjs';
import { COL, getDb } from '@/lib/server/db';
import { createSession, normaliseEmail } from '@/lib/server/auth';
import { HttpError, handler, json, readJson } from '@/lib/server/http';

export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const db = await getDb();
  const user = await db.collection<{ _id: string; email: string; name: string; passwordHash: string }>(COL.users).findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Wrong email or password');
  await createSession({ id: user._id, email: user.email, name: user.name });
  return json({ user: { email: user.email, name: user.name } });
});
