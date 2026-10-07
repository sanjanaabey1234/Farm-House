// Creates the MongoDB indexes. Run once after setting MONGODB_URI: npm run db:indexes
// (The app also creates them automatically on first use.)

import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'node:fs';

// minimal .env.local loader so the script works without extra packages
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Set MONGODB_URI in .env.local first');
  const client = await new MongoClient(uri).connect();
  const db = client.db(process.env.MONGODB_DB || 'chicken_wholesale_books');
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('businesses').createIndex({ 'members.email': 1 });
  await db.collection('records').createIndex({ businessId: 1, kind: 1, date: 1 });
  await db.collection('records').createIndex({ businessId: 1, updatedAt: 1 });
  await db
    .collection('records')
    .createIndex(
      { businessId: 1, kind: 1, nameKey: 1 },
      { unique: true, partialFilterExpression: { deleted: false, nameKey: { $exists: true } }, name: 'unique_master_names' },
    );
  console.log('Indexes created on', db.databaseName);
  await client.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
