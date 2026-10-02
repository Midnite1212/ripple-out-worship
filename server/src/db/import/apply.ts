import { count, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { Database } from '../connect';
import { Executor, Transaction } from '../repositories/shared';
import {
  groupSetlists,
  groups,
  ownershipGroups,
  ownershipSetlists,
  ownerships,
  setlistSongKeys,
  setlistSongs,
  setlists,
  songs,
} from '../schema';
import { IMPORT_TABLES, ImportPlan, ImportTable } from './plan';

export type TableCounts = Record<ImportTable, number>;

export type TargetDecision =
  | { action: 'insert' }
  | { action: 'replace'; existing: TableCounts }
  | { action: 'refuse'; existing: TableCounts };

export class ImportRefusedError extends Error {
  constructor(readonly existing: TableCounts) {
    super('Target tables are not empty; pass --replace to truncate them before importing');
    this.name = 'ImportRefusedError';
  }
}

const TABLES = {
  songs,
  setlists,
  groups,
  ownerships,
  setlist_songs: setlistSongs,
  setlist_song_keys: setlistSongKeys,
  group_setlists: groupSetlists,
  ownership_setlists: ownershipSetlists,
  ownership_groups: ownershipGroups,
} satisfies Record<ImportTable, PgTable>;

const CHUNK_SIZE = 500;
const TABLE_LIST = sql.raw(IMPORT_TABLES.join(', '));

export const plannedCounts = (plan: ImportPlan): TableCounts =>
  Object.fromEntries(IMPORT_TABLES.map((table) => [table, plan.rows[table].length])) as TableCounts;

export const decideTarget = (existing: TableCounts, replace: boolean): TargetDecision => {
  const isEmpty = IMPORT_TABLES.every((table) => existing[table] === 0);
  if (isEmpty) return { action: 'insert' };
  return replace ? { action: 'replace', existing } : { action: 'refuse', existing };
};

export const countTargetRows = async (executor: Executor): Promise<TableCounts> => {
  const counts: Partial<TableCounts> = {};
  for (const table of IMPORT_TABLES) {
    const [{ value }] = await executor.select({ value: count() }).from(TABLES[table]);
    counts[table] = value;
  }
  return counts as TableCounts;
};

const insertChunks = async <T extends PgTable>(
  tx: Transaction,
  table: T,
  rows: T['$inferInsert'][]
): Promise<void> => {
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    await tx.insert(table).values(rows.slice(start, start + CHUNK_SIZE));
  }
};

const insertRows = async (tx: Transaction, { rows }: ImportPlan): Promise<void> => {
  await insertChunks(tx, songs, rows.songs);
  await insertChunks(tx, setlists, rows.setlists);
  await insertChunks(tx, groups, rows.groups);
  await insertChunks(tx, ownerships, rows.ownerships);
  await insertChunks(tx, setlistSongs, rows.setlist_songs);
  await insertChunks(tx, setlistSongKeys, rows.setlist_song_keys);
  await insertChunks(tx, groupSetlists, rows.group_setlists);
  await insertChunks(tx, ownershipSetlists, rows.ownership_setlists);
  await insertChunks(tx, ownershipGroups, rows.ownership_groups);
};

export const applyImport = async (
  db: Database,
  plan: ImportPlan,
  { replace }: { replace: boolean }
): Promise<{ decision: TargetDecision; written: TableCounts }> =>
  db.transaction(async (tx) => {
    await tx.execute(sql`lock table ${TABLE_LIST} in exclusive mode`);
    const decision = decideTarget(await countTargetRows(tx), replace);
    if (decision.action === 'refuse') throw new ImportRefusedError(decision.existing);
    if (decision.action === 'replace') await tx.execute(sql`truncate table ${TABLE_LIST}`);
    await insertRows(tx, plan);
    const written = await countTargetRows(tx);
    const expected = plannedCounts(plan);
    const mismatched = IMPORT_TABLES.filter((table) => written[table] !== expected[table]);
    if (mismatched.length > 0) {
      throw new Error(`Row count check failed for ${mismatched.join(', ')}; rolled back`);
    }
    return { decision, written };
  });
