import { clearSession } from '@/lib/server/auth';
import { handler, json } from '@/lib/server/http';

export const POST = handler(async () => {
  await clearSession();
  return json({ ok: true });
});
