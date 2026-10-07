import 'server-only';
import { MongoClient, type Db, MongoServerError } from 'mongodb';

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
  if (/MONGODB_URI/.test(msg)) return { status: 500, message: msg };
  console.error(e);
  return { status: 503, message: 'Not saved. Check your connection and try again.' };
}
