// Wendet alle drizzle/-Migrations an. Wird einmal beim Deploy ausgeführt
// (siehe server/scripts/deploy.sh) und gerne lokal in dev.

import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

const start = Date.now();
console.log('→ migrate: starte');
await migrate(db, { migrationsFolder: './drizzle' });
console.log(`✓ migrate: durch in ${Date.now() - start} ms`);
await pool.end();
process.exit(0);
