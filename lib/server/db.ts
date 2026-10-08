import 'server-only';
import { MongoClient, type Db, MongoParseError, MongoServerError, MongoServerSelectionError } from 'mongodb';

// One MongoClient per server process (reused across hot reloads in dev).
const g = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

function client(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env.local and add your MongoDB Atlas connection string.');
  if (!g._mongoClient) {
    g._mongoClient = new MongoClient(uri, {
      appName: 'chicken-wholesale-books',
      maxPoolSize: 10,
      retryWrites: true,
      // Fail fast (well inside serverless time limits) so the user sees why, instead of a platform timeout page.
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      // Read from the nearest member of the (global) cluster; writes always go to the primary.
      readPreference: (process.env.MONGODB_READ_PREFERENCE as 'nearest' | undefined) || 'primary',
    }).connect();
    g._mongoClient.catch(() => {
      g._mongoClient = undefined;
    });
  }
  return g._mongoClient;
}

export async function getDb(): Promise<Db> {
  const c = await client();
  return c.db(process.env.MONGODB_DB || 'chicken_wholesale_books');
}

export const COL = {
  users: 'users',
  businesses: 'businesses',
  records: 'records',
} as const;

let indexesReady: Promise<void> | null = null;

/** Creates the indexes once per process (idempotent). */
export function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = await getDb();
      await db.collection(COL.users).createIndex({ email: 1 }, { unique: true });
      await db.collection(COL.businesses).createIndex({ 'members.email': 1 });
      const rec = db.collection(COL.records);
      await rec.createIndex({ businessId: 1, kind: 1, date: 1 });
      await rec.createIndex({ businessId: 1, updatedAt: 1 });
      await rec.createIndex(
        { businessId: 1, kind: 1, nameKey: 1 },
        { unique: true, partialFilterExpression: { deleted: false, nameKey: { $exists: true } }, name: 'unique_master_names' },
      );
    })().catch((e) => {
      indexesReady = null;
      throw e;
    });
  }
  return indexesReady;
}

/** Maps database errors to a plain message and HTTP status (requirements section 10, reliability). */
export function dbErrorResponse(e: unknown): { status: number; message: string } {
  if (e instanceof MongoServerError) {
    if (e.code === 11000) return { status: 409, message: 'That name is already used. Names must be unique.' };
    if (e.code === 8000 || /space quota|storage/i.test(e.message)) return { status: 507, message: 'Storage is full. Delete old entries or upgrade the database plan.' };
  }
  const msg = e instanceof Error ? e.message : String(e);
  console.error(e);
  // Server set-up problems: say exactly what to fix (these show on the first deploy, e.g. on Vercel).
  if (/MONGODB_URI|AUTH_SECRET/.test(msg)) return { status: 500, message: `Server setup: ${msg}` };
  if (/bad auth|authentication failed/i.test(msg) || (e instanceof MongoServerError && e.code === 18)) {
    return { status: 500, message: 'Server setup: the database rejected the username or password in MONGODB_URI.' };
  }
  if (e instanceof MongoParseError || /Invalid scheme|URI must include hostname/i.test(msg)) {
    return { status: 500, message: 'Server setup: MONGODB_URI is not a valid connection string. Special characters in the password must be URL-encoded.' };
  }
  if (e instanceof MongoServerSelectionError || /querySrv|ENOTFOUND|ECONNREFUSED|timed out|Server selection/i.test(msg)) {
    return { status: 503, message: 'Cannot reach the database. In MongoDB Atlas → Network Access, allow this server\'s IP (for Vercel: 0.0.0.0/0).' };
  }
  return { status: 503, message: 'Not saved. Check your connection and try again.' };
}
