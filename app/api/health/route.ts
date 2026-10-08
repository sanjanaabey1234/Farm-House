import { dbErrorResponse, getDb } from '@/lib/server/db';
import { json } from '@/lib/server/http';

// Set-up check for a new deployment: open /api/health. Shows what is missing without revealing any secret.
export async function GET() {
  const secret = process.env.AUTH_SECRET ?? '';
  const uri = process.env.MONGODB_URI ?? '';
  const checks: Record<string, string> = {
    MONGODB_URI: uri ? 'set' : 'MISSING',
    // which cluster this server talks to (host only — never the password), to compare with .env.local
    cluster: uri ? (/@([^/?]+)/.exec(uri)?.[1] ?? /^mongodb(?:\+srv)?:\/\/([^/?]+)/.exec(uri)?.[1] ?? 'unreadable') : '—',
    MONGODB_DB: process.env.MONGODB_DB || 'chicken_wholesale_books (default)',
    AUTH_SECRET: !secret ? 'MISSING' : secret.length < 32 ? 'TOO SHORT (needs 32+ characters)' : 'set',
    database: 'not checked',
  };
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      checks.database = `connected (${db.databaseName})`;
    } catch (e) {
      checks.database = dbErrorResponse(e).message;
    }
  }
  const ok = checks.MONGODB_URI === 'set' && checks.AUTH_SECRET === 'set' && checks.database.startsWith('connected');
  return json({ ok, ...checks }, ok ? 200 : 500);
}
