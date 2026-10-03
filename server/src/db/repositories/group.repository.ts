import { SQL, and, asc, eq, inArray } from 'drizzle-orm';
import { GroupAccess, GroupRecord } from '../../types/group.types';
import { InvalidInputError, castObjectIdArray, castRequiredString, has } from '../cast';
import { getDb } from '../connect';
import { generateObjectId, toObjectId } from '../objectId';
import { groupSetlists, groups, ownershipGroups, ownerships, setlists } from '../schema';
import { Executor, Transaction, groupBy, presentFields, unique } from './shared';

export const GROUP_FIELDS = ['groupName', 'setlistIds'] as const;

export type GroupField = (typeof GROUP_FIELDS)[number];
export type GroupFields = Partial<Record<GroupField, unknown>>;
export type GroupCreate = GroupFields & { createdBy: string };

type GroupRow = typeof groups.$inferSelect;
type GroupValues = { groupName?: string; setlistIds?: string[] };

const toGroupValues = (fields: GroupFields): GroupValues => {
  const values: GroupValues = {};
  if (has(fields, 'groupName'))
    values.groupName = castRequiredString('groupName', fields.groupName);
  if (has(fields, 'setlistIds')) {
    values.setlistIds = unique(castObjectIdArray('setlistIds', fields.setlistIds));
  }
  return values;
};

const isLiveGroup = (id: string): SQL | undefined =>
  and(eq(groups.id, toObjectId(id)), eq(groups.isDeleted, false));

const toGroupAccess = (row: GroupRow): GroupAccess => ({
  _id: row.id,
  ...presentFields({ createdBy: row.createdBy }),
  groupName: row.groupName,
  createdAt: row.createdAt,
});

const assembleRecords = async (executor: Executor, rows: GroupRow[]): Promise<GroupRecord[]> => {
  const ids = rows.map(({ id }) => id);
  const links =
    ids.length > 0
      ? await executor
          .select({ groupId: groupSetlists.groupId, setlistId: groupSetlists.setlistId })
          .from(groupSetlists)
          .where(inArray(groupSetlists.groupId, ids))
          .orderBy(
            asc(groupSetlists.groupId),
            asc(groupSetlists.position),
            asc(groupSetlists.setlistId)
          )
      : [];
  const setlistIdsByGroup = groupBy(
    links,
    (link) => link.groupId,
    (link) => link.setlistId
  );
  return rows.map((row) => ({
    _id: row.id,
    groupName: row.groupName,
    setlistIds: setlistIdsByGroup.get(row.id) ?? [],
    ...presentFields({ createdBy: row.createdBy, lastUpdatedBy: row.lastUpdatedBy }),
    isDeleted: row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

const replaceSetlists = async (tx: Transaction, groupId: string, setlistIds: string[]) => {
  await tx.delete(groupSetlists).where(eq(groupSetlists.groupId, groupId));
  if (setlistIds.length === 0) return;
  await tx
    .insert(groupSetlists)
    .values(setlistIds.map((setlistId, position) => ({ groupId, setlistId, position })));
};

export const groupRepository = {
  async create({ createdBy, ...fields }: GroupCreate): Promise<GroupRecord> {
    const { groupName, setlistIds } = toGroupValues(fields);
    if (groupName === undefined) throw new InvalidInputError('groupName');
    const now = new Date();
    return getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(groups)
        .values({
          id: generateObjectId(now),
          groupName,
          createdBy: toObjectId(createdBy),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (setlistIds) await replaceSetlists(tx, row.id, setlistIds);
      const [record] = await assembleRecords(tx, [row]);
      return record;
    });
  },

  async findLiveById(id: string): Promise<GroupRecord | null> {
    const db = getDb();
    const rows = await db.select().from(groups).where(isLiveGroup(id));
    const [record] = await assembleRecords(db, rows);
    return record ?? null;
  },

  async listLive(): Promise<GroupRecord[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(groups)
      .where(eq(groups.isDeleted, false))
      .orderBy(asc(groups.id));
    return assembleRecords(db, rows);
  },

  async findLiveAccess(id: string): Promise<GroupAccess | null> {
    const [row] = await getDb().select().from(groups).where(isLiveGroup(id));
    return row ? toGroupAccess(row) : null;
  },

  async findLiveAccessByIds(ids: string[]): Promise<GroupAccess[]> {
    if (ids.length === 0) return [];
    const rows = await getDb()
      .select()
      .from(groups)
      .where(and(inArray(groups.id, unique(ids.map(toObjectId))), eq(groups.isDeleted, false)));
    return rows.map(toGroupAccess);
  },

  async updateLive(id: string, fields: GroupFields): Promise<GroupRecord | null> {
    const { groupName, setlistIds } = toGroupValues(fields);
    return getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(groups)
        .set({ ...(groupName === undefined ? {} : { groupName }), updatedAt: new Date() })
        .where(isLiveGroup(id))
        .returning();
      if (!row) return null;
      if (setlistIds) await replaceSetlists(tx, row.id, setlistIds);
      const [record] = await assembleRecords(tx, [row]);
      return record;
    });
  },

  async softDeleteCascade(id: string): Promise<boolean> {
    return getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(groups)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(isLiveGroup(id))
        .returning({ id: groups.id });
      if (!row) return false;
      const now = new Date();
      await tx
        .update(ownerships)
        .set({ updatedAt: now })
        .where(
          inArray(
            ownerships.id,
            tx
              .select({ id: ownershipGroups.ownershipId })
              .from(ownershipGroups)
              .where(eq(ownershipGroups.groupId, row.id))
          )
        );
      await tx.delete(ownershipGroups).where(eq(ownershipGroups.groupId, row.id));
      await tx
        .update(setlists)
        .set({ updatedAt: now })
        .where(
          inArray(
            setlists.id,
            tx
              .select({ id: groupSetlists.setlistId })
              .from(groupSetlists)
              .where(eq(groupSetlists.groupId, row.id))
          )
        );
      await tx.delete(groupSetlists).where(eq(groupSetlists.groupId, row.id));
      return true;
    });
  },
};
