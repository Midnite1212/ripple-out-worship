import { DrizzleQueryError } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { closeDatabase } from '../src/db/connect';
import { countExistingSongs, insertSongs, mapSongDocuments } from '../src/db/importSongs';

const { values: args } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    'database-url': { type: 'string' },
    file: { type: 'string' },
  },
});

const main = async (): Promise<void> => {
  if (!args.file) throw new Error('Usage: yarn import:songs --file <songs.json> [--apply]');
  const documents: unknown = JSON.parse(readFileSync(args.file, 'utf8'));
  if (!Array.isArray(documents)) throw new Error('Expected a mongoexport --jsonArray file');

  const { rows, skipped } = mapSongDocuments(documents);
  console.log(`read: ${documents.length}`);
  console.log(`valid: ${rows.length}`);
  console.log(`skipped: ${skipped.length}`);
  for (const { index, id } of skipped) console.log(`  #${index} ${id ?? '(no valid _id)'}`);

  const databaseUrl = args['database-url'] ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (args.apply) throw new Error('Pass --database-url or set DATABASE_URL');
    console.log(`would insert: ${rows.length} (database not checked)`);
    return;
  }
  process.env.DATABASE_URL = databaseUrl;

  if (!args.apply) {
    const present = await countExistingSongs(rows.map((row) => row.id));
    console.log(`already present: ${present}`);
    console.log(`would insert: ${rows.length - present}`);
    console.log('dry run: pass --apply to write');
    return;
  }
  const inserted = await insertSongs(rows);
  console.log(`inserted: ${inserted}`);
  console.log(`already present: ${rows.length - inserted}`);
};

main()
  .catch((error: unknown) => {
    const cause = error instanceof DrizzleQueryError ? error.cause : error;
    console.error(cause instanceof Error ? cause.message : 'Import failed');
    process.exitCode = 1;
  })
  .finally(closeDatabase);
