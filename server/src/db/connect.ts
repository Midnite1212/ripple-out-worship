import { sql } from 'drizzle-orm';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let database: Database | undefined;

export const getDb = (): Database => {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  pool = new Pool({ connectionString });
  pool.on('error', (error) => console.error('Postgres: idle client error', error.message));
  database = drizzle(pool, { schema });
  return database;
};

export const createEnsureDatabase = (connect: () => Promise<void>): (() => Promise<void>) => {
  let connection: Promise<void> | undefined;

  return () => {
    connection ??= connect().catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
    return connection;
  };
};

let ensure = createEnsureDatabase(async () => {
  await getDb().execute(sql`select 1`);
  console.log('Postgres: connected');
});

export const ensureDatabase = (): Promise<void> => ensure();

export const closeDatabase = async (): Promise<void> => {
  const current = pool;
  pool = undefined;
  database = undefined;
  ensure = createEnsureDatabase(async () => {
    await getDb().execute(sql`select 1`);
    console.log('Postgres: connected');
  });
  await current?.end();
};
