import { getSessionUser } from '@/lib/server/auth';
import { handler, json } from '@/lib/server/http';

export const GET = handler(async () => {
  const user = await getSessionUser();
  return json({ user: user ? { email: user.email, name: user.name } : null });
});
