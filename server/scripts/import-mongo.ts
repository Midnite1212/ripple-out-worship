import dotenv from 'dotenv';
import { DrizzleQueryError } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import {
  ImportRefusedError,
  TableCounts,
  TargetDecision,
  applyImport,
  countTargetRows,
  decideTarget,
} from '../src/db/import/apply';
import { COLLECTIONS, IMPORT_TABLES, MongoExport, planImport } from '../src/db/import/plan';
import { formatPlan } from '../src/db/import/report';
import * as schema from '../src/db/schema';

dotenv.config();

const USAGE =
  'Usage: yarn import:mongo --dir <export folder> [--apply] [--replace] [--database-url <url>]';

type Options = { dir: string; apply: boolean; replace: boolean; databaseUrl?: string };

const parseArgs = (args: string[]): Options => {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const equals = arg.indexOf('=');
    const name = equals === -1 ? arg : arg.slice(0, equals);
    const inline = equals === -1 ? undefined : arg.slice(equals + 1);
    if (name === '--apply' || name === '--replace') flags.add(name);
    else if (name === '--dir' || name === '--database-url') {
      const value = inline ?? args[++index];
      if (!value) throw new Error(`${name} needs a value\n${USAGE}`);
      values.set(name, value);
    } else throw new Error(`Unknown argument: ${name}\n${USAGE}`);
  }
  const dir = values.get('--dir');
  if (!dir) throw new Error(`--dir is required\n${USAGE}`);
  return {
    dir,
    apply: flags.has('--apply'),
    replace: flags.has('--replace'),
    databaseUrl: values.get('--database-url') ?? process.env.DATABASE_URL,
  };
};

const readExport = async (dir: string): Promise<MongoExport> => {
  const entries = await Promise.all(
    COLLECTIONS.map(async (collection) => {
      const file = path.join(dir, `${collection}.json`);
      const text = await readFile(file, 'utf8').catch(() => {
        throw new Error(`Cannot read ${file}`);
      });
      try {
        return [collection, JSON.parse(text)] as const;
      } catch {
        throw new Error(`${file} is not valid JSON`);
      }
    })
  );
  return Object.fromEntries(entries) as MongoExport;
};

const describeTarget = (databaseUrl: string): string => {
  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
  } catch {
    throw new Error('The database URL is not a valid connection string');
  }
};

const formatCounts = (counts: TableCounts): string =>
  IMPORT_TABLES.filter((table) => counts[table] > 0)
    .map((table) => `${table} ${counts[table]}`)
    .join(', ');

const describeDecision = (decision: TargetDecision, isApplied: boolean): string => {
  if (decision.action === 'insert') {
    return isApplied
      ? 'Inserted into empty tables.'
      : 'Target is empty: --apply inserts the rows above.';
  }
  const existing = `Target is not empty (${formatCounts(decision.existing)})`;
  if (decision.action === 'refuse') {
    return `${existing}: --apply refuses; add --replace to truncate the nine import tables first.`;
  }
  return isApplied
    ? `${existing}: truncated, then inserted.`
    : `${existing}: --apply --replace truncates the nine import tables, then inserts.`;
};

const describeError = (error: unknown): string => {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  if (!(cause instanceof Error)) return 'Import failed';
  const details = ['code', 'table', 'column', 'constraint']
    .map((key) => [key, Reflect.get(cause, key)])
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `${key}=${value}`);
  return [cause.message, ...details].join(' ');
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  console.log(options.apply ? 'Mode: APPLY' : 'Mode: DRY RUN (no writes; pass --apply to write)');
  const plan = planImport(await readExport(options.dir));
  for (const line of formatPlan(plan)) console.log(line);

  if (!options.databaseUrl) {
    if (options.apply) throw new Error('Pass --database-url or set DATABASE_URL to apply');
    console.log('Target: none checked (pass --database-url or set DATABASE_URL)');
    return;
  }
  console.log(`Target: ${describeTarget(options.databaseUrl)}`);
  const pool = new Pool({ connectionString: options.databaseUrl });
  const db = drizzle(pool, { schema });
  try {
    if (!options.apply) {
      console.log(
        describeDecision(decideTarget(await countTargetRows(db), options.replace), false)
      );
      return;
    }
    const { decision, written } = await applyImport(db, plan, { replace: options.replace });
    console.log(describeDecision(decision, true));
    console.log(`Rows now in the target: ${formatCounts(written) || 'none'}`);
  } catch (error: unknown) {
    if (!(error instanceof ImportRefusedError)) throw error;
    console.log(describeDecision({ action: 'refuse', existing: error.existing }, true));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
