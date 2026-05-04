import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL ist nicht gesetzt — siehe server/.env.example');
}

export const pool = new Pool({ connectionString: url, max: 10 });

export const db = drizzle(pool, { schema });
export type DB = typeof db;
