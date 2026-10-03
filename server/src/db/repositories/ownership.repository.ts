import { SQL, and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  OwnershipEntry,
  OwnershipRecord,
  OwnershipSummary,
  StoredOwnershipEntry,
} from '../../types/ownership.types';
import { InvalidInputError, castOptionalString } from '../cast';
import { getDb } from '../connect';
import { generateObjectId, toObjectId } from '../objectId';
import { ownershipGroups, ownershipSetlists, ownerships } from '../schema';
import { Executor, groupBy, presentFields } from './shared';

export type CallerAccess = {
  groupIds: StoredOwnershipEntry[];
  setlistIds: StoredOwnershipEntry[];
};

export type OwnershipCreate = Pick<OwnershipRecord, 'userId' | 'fullName' | 'accessType'>;

export type GroupMembershipChange = {
  entry: OwnershipEntry;
  add: string[];
  remove: string[];
};

type OwnershipRow = typeof ownerships.$inferSelect;
type EntryRow = {
  ownershipId: string;
  entryId: string | null;
  entryName: string | null;
  entryCreatedAt: string | null;
};
type EntryValues = Omit<EntryRow, 'ownershipId'>;

const toStoredEntry = (row: EntryRow): StoredOwnershipEntry =>
  presentFields({ id: row.entryId, name: row.entryName, createdAt: row.entryCreatedAt });

const loadEntries = async (executor: Executor, ownershipIds: string[]) => {
  if (ownershipIds.length === 0) {
    return { groupIds: new Map<string, StoredOwnershipEntry[]>(), setlistIds: new Map() };
  }
  const [groupRows, setlistRows] = await Promise.all([
    executor
      .select({
        ownershipId: ownershipGroups.ownershipId,
        entryId: ownershipGroups.groupId,
        entryName: ownershipGroups.entryName,
        entryCreatedAt: ownershipGroups.entryCreatedAt,
      })
      .from(ownershipGroups)
      .where(inArray(ownershipGroups.ownershipId, ownershipIds))
      .orderBy(asc(ownershipGroups.ownershipId), asc(ownershipGroups.position)),
    executor
      .select({
        ownershipId: ownershipSetlists.ownershipId,
        entryId: ownershipSetlists.setlistId,
        entryName: ownershipSetlists.entryName,
        entryCreatedAt: ownershipSetlists.entryCreatedAt,
      })
      .from(ownershipSetlists)
      .where(inArray(ownershipSetlists.ownershipId, ownershipIds))
      .orderBy(asc(ownershipSetlists.ownershipId), asc(ownershipSetlists.position)),
  ]);
  return {
    groupIds: groupBy(groupRows, (row) => row.ownershipId, toStoredEntry),
    setlistIds: groupBy(setlistRows, (row) => row.ownershipId, toStoredEntry),
  };
};

const assembleRecords = async (
  executor: Executor,
  rows: OwnershipRow[]
): Promise<OwnershipRecord[]> => {
  const entries = await loadEntries(
    executor,
    rows.map(({ id }) => id)
  );
  return rows.map((row) => ({
    _id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    accessType: row.accessType,
    groupIds: entries.groupIds.get(row.id) ?? [],
    setlistIds: entries.setlistIds.get(row.id) ?? [],
    isDeleted: row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

const findOne = async (condition: SQL | undefined): Promise<OwnershipRecord | null> => {
  const db = getDb();
  const rows = await db.select().from(ownerships).where(condition);
  const [record] = await assembleRecords(db, rows);
  return record ?? null;
};

const castEntries = (value: unknown): EntryValues[] => {
  if (!Array.isArray(value)) throw new InvalidInputError('setlistIds');
  return value.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new InvalidInputError('setlistIds');
    }
    return {
      entryId: castOptionalString('setlistIds.id', Reflect.get(entry, 'id')),
      entryName: castOptionalString('setlistIds.name', Reflect.get(entry, 'name')),
      entryCreatedAt: castOptionalString('setlistIds.createdAt', Reflect.get(entry, 'createdAt')),
    };
  });
};

const isLiveUser = (userIds: string[]): SQL | undefined =>
  and(inArray(ownerships.userId, userIds), eq(ownerships.isDeleted, false));

export const ownershipRepository = {
  async findCallerAccess(userId: string): Promise<CallerAccess | null> {
    const record = await findOne(
      and(eq(ownerships.userId, userId), eq(ownerships.isDeleted, false))
    );
    return record ? { groupIds: record.groupIds, setlistIds: record.setlistIds } : null;
  },

  async createIfMissing({
    userId,
    fullName,
    accessType,
  }: OwnershipCreate): Promise<OwnershipRecord> {
    const now = new Date();
    const db = getDb();
    const rows = await db
      .insert(ownerships)
      .values({
        id: generateObjectId(now),
        userId,
        fullName,
        accessType,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({ target: ownerships.userId, set: { updatedAt: now } })
      .returning();
    const [record] = await assembleRecords(db, rows);
    return record;
  },

  findLiveByUserId(userId: string): Promise<OwnershipRecord | null> {
    return findOne(and(eq(ownerships.userId, userId), eq(ownerships.isDeleted, false)));
  },

  findLiveById(id: string): Promise<OwnershipRecord | null> {
    return findOne(and(eq(ownerships.id, toObjectId(id)), eq(ownerships.isDeleted, false)));
  },

  async listLiveSummaries(): Promise<OwnershipSummary[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(ownerships)
      .where(eq(ownerships.isDeleted, false))
      .orderBy(asc(ownerships.id));
    const records = await assembleRecords(db, rows);
    return records.map(({ _id, userId, fullName, groupIds }) => ({
      _id,
      userId,
      fullName,
      groupIds,
    }));
  },

  async replaceSetlistEntries(
    id: string,
    userId: string,
    entries: unknown
  ): Promise<OwnershipRecord | null> {
    const values = castEntries(entries);
    return getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(ownerships)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(ownerships.id, toObjectId(id)),
            eq(ownerships.userId, userId),
            eq(ownerships.isDeleted, false)
          )
        )
        .returning();
      if (!row) return null;
      await tx.delete(ownershipSetlists).where(eq(ownershipSetlists.ownershipId, row.id));
      if (values.length > 0) {
        await tx.insert(ownershipSetlists).values(
          values.map(({ entryId, entryName, entryCreatedAt }, position) => ({
            ownershipId: row.id,
            position,
            setlistId: entryId,
            entryName,
            entryCreatedAt,
          }))
        );
      }
      const [record] = await assembleRecords(tx, [row]);
      return record;
    });
  },

  async softDeleteByUserId(userId: string): Promise<boolean> {
    const rows = await getDb()
      .update(ownerships)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(isLiveUser([userId]))
      .returning({ id: ownerships.id });
    return rows.length > 0;
  },

  async changeGroupMembership({
    entry,
    add,
    remove,
  }: GroupMembershipChange): Promise<{ added: number; removed: number }> {
    return getDb().transaction(async (tx) => {
      const now = new Date();
      const candidates =
        add.length > 0
          ? await tx
              .select({ id: ownerships.id })
              .from(ownerships)
              .where(isLiveUser(add))
              .orderBy(asc(ownerships.id))
              .for('update')
          : [];
      const joining: string[] = [];
      for (const { id } of candidates) {
        const [membership] = await tx
          .select({ ownershipId: ownershipGroups.ownershipId })
          .from(ownershipGroups)
          .where(and(eq(ownershipGroups.ownershipId, id), eq(ownershipGroups.groupId, entry.id)))
          .limit(1);
        if (membership) continue;
        await tx.insert(ownershipGroups).values({
          ownershipId: id,
          position: sql`(select coalesce(max(${ownershipGroups.position}), -1) + 1 from ${ownershipGroups} where ${ownershipGroups.ownershipId} = ${id})`,
          groupId: entry.id,
          entryName: entry.name,
          entryCreatedAt: entry.createdAt,
        });
        joining.push(id);
      }
      if (joining.length > 0) {
        await tx.update(ownerships).set({ updatedAt: now }).where(inArray(ownerships.id, joining));
      }
      const leaving =
        remove.length > 0
          ? await tx
              .update(ownerships)
              .set({ updatedAt: now })
              .where(isLiveUser(remove))
              .returning({ id: ownerships.id })
          : [];
      if (leaving.length > 0) {
        await tx.delete(ownershipGroups).where(
          and(
            inArray(
              ownershipGroups.ownershipId,
              leaving.map(({ id }) => id)
            ),
            eq(ownershipGroups.groupId, entry.id)
          )
        );
      }
      return { added: joining.length, removed: leaving.length };
    });
  },
};
