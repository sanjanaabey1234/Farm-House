import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { COL, ensureIndexes, getDb } from '@/lib/server/db';
import { createSession, isEmail, normaliseEmail } from '@/lib/server/auth';
import { HttpError, handler, json, readJson } from '@/lib/server/http';

export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const email = normaliseEmail(body.email);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name) throw new HttpError(400, 'Enter your name');
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address');
  if (password.length < 8) throw new HttpError(400, 'The password must be at least 8 characters');

  await ensureIndexes();
  const db = await getDb();
  const users = db.collection<{ _id: string; email: string; name: string; passwordHash: string; createdAt: Date }>(COL.users);
  if (await users.findOne({ email })) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
  const user = { _id: randomUUID(), email, name, passwordHash: await bcrypt.hash(password, 10), createdAt: new Date() };
  await users.insertOne(user);
  await createSession({ id: user._id, email, name });
  return json({ user: { email, name } }, 201);
});
