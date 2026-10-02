import { Client } from 'pg';

const TEST_DATABASE_LOCK = 35001;

export const lockTestDatabase = async (connectionString: string): Promise<() => Promise<void>> => {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query('select pg_advisory_lock($1)', [TEST_DATABASE_LOCK]);
  return () => client.end();
};
