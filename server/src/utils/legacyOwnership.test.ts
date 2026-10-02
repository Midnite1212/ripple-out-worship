import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BackfillPlan,
  LegacyGroup,
  LegacyOwnership,
  LegacySetlist,
  planBackfill,
} from './legacyOwnership';

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f1f77bcf86cd799439012';
const SETLIST_1 = '507f1f77bcf86cd799439021';
const SETLIST_2 = '507f1f77bcf86cd799439022';
const SETLIST_3 = '507f1f77bcf86cd799439023';
const GROUP_1 = '507f1f77bcf86cd799439031';
const GROUP_2 = '507f1f77bcf86cd799439032';
const GROUP_3 = '507f1f77bcf86cd799439033';

const oid = (id: string) => ({ toString: () => id });
const entry = (id: string) => ({ createdAt: '2026-01-01T00:00:00.000Z', id, name: 'Entry' });

const setlist = (id: string, fields: Partial<LegacySetlist> = {}): LegacySetlist => ({
  _id: oid(id),
  groupIds: [],
  isDeleted: false,
  ...fields,
});

const group = (id: string, fields: Partial<LegacyGroup> = {}): LegacyGroup => ({
  _id: oid(id),
  setlistIds: [],
  isDeleted: false,
  ...fields,
});

const ownership = (
  userId: string,
  {
    groupIds = [],
    isDeleted = false,
    setlistIds = [],
  }: { groupIds?: string[]; isDeleted?: boolean; setlistIds?: string[] } = {}
): LegacyOwnership => ({
  userId,
  groupIds: groupIds.map(entry),
  setlistIds: setlistIds.map(entry),
  isDeleted,
});

const EMPTY_PLAN: BackfillPlan = {
  setlistCreatedBy: [],
  groupCreatedBy: [],
  setlistGroupAdds: [],
  groupSetlistAdds: [],
  ambiguous: { setlists: [], groups: [] },
  danglingLinks: { setlistGroupRefs: [], groupSetlistRefs: [] },
};

const plan = (input: Partial<Parameters<typeof planBackfill>[0]>) =>
  planBackfill({ setlists: [], groups: [], ownerships: [], ...input });

const applyPlan = (
  setlists: LegacySetlist[],
  groups: LegacyGroup[],
  { setlistCreatedBy, groupCreatedBy, setlistGroupAdds, groupSetlistAdds }: BackfillPlan
): { setlists: LegacySetlist[]; groups: LegacyGroup[] } => {
  const byId = <T extends { _id: unknown }>(docs: T[], id: string): T | undefined =>
    docs.find((doc) => String(doc._id) === id);
  const nextSetlists = setlists.map((doc) => ({ ...doc, groupIds: [...(doc.groupIds ?? [])] }));
  const nextGroups = groups.map((doc) => ({ ...doc, setlistIds: [...(doc.setlistIds ?? [])] }));
  for (const { setlistId, userId } of setlistCreatedBy) {
    const doc = byId(nextSetlists, setlistId);
    if (doc) doc.createdBy = oid(userId);
  }
  for (const { groupId, userId } of groupCreatedBy) {
    const doc = byId(nextGroups, groupId);
    if (doc) doc.createdBy = oid(userId);
  }
  for (const { setlistId, groupId } of setlistGroupAdds) {
    byId(nextSetlists, setlistId)?.groupIds.push(oid(groupId));
  }
  for (const { groupId, setlistId } of groupSetlistAdds) {
    byId(nextGroups, groupId)?.setlistIds.push(oid(setlistId));
  }
  return { setlists: nextSetlists, groups: nextGroups };
};

describe('planBackfill', () => {
  describe('setlist createdBy', () => {
    it('assigns the only ownership holding the setlist', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1)],
        ownerships: [ownership(USER_A, { setlistIds: [SETLIST_1] }), ownership(USER_B)],
      });
      assert.deepEqual(result.setlistCreatedBy, [{ setlistId: SETLIST_1, userId: USER_A }]);
      assert.deepEqual(result.ambiguous.setlists, []);
    });

    it('leaves setlists that already have a creator alone', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1, { createdBy: oid(USER_B) })],
        ownerships: [ownership(USER_A, { setlistIds: [SETLIST_1] })],
      });
      assert.deepEqual(result, EMPTY_PLAN);
    });

    it('reports a setlist held by several ownerships or none as ambiguous', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1), setlist(SETLIST_2)],
        ownerships: [
          ownership(USER_A, { setlistIds: [SETLIST_1] }),
          ownership(USER_B, { setlistIds: [SETLIST_1] }),
        ],
      });
      assert.deepEqual(result.setlistCreatedBy, []);
      assert.deepEqual(result.ambiguous.setlists, [SETLIST_1, SETLIST_2]);
    });

    it('counts an ownership listing the same setlist twice once', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1)],
        ownerships: [ownership(USER_A, { setlistIds: [SETLIST_1, SETLIST_1] })],
      });
      assert.deepEqual(result.setlistCreatedBy, [{ setlistId: SETLIST_1, userId: USER_A }]);
    });

    it('treats a sole holder whose userId is not an ObjectId as ambiguous', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1)],
        ownerships: [ownership('not-an-object-id', { setlistIds: [SETLIST_1] })],
      });
      assert.deepEqual(result.setlistCreatedBy, []);
      assert.deepEqual(result.ambiguous.setlists, [SETLIST_1]);
    });
  });

  describe('folder createdBy', () => {
    it('assigns the only member of the folder', () => {
      const result = plan({
        groups: [group(GROUP_1)],
        ownerships: [ownership(USER_A, { groupIds: [GROUP_1] }), ownership(USER_B)],
      });
      assert.deepEqual(result.groupCreatedBy, [{ groupId: GROUP_1, userId: USER_A }]);
      assert.deepEqual(result.ambiguous.groups, []);
    });

    it('reports a folder with several members or none as ambiguous', () => {
      const result = plan({
        groups: [group(GROUP_1), group(GROUP_2), group(GROUP_3, { createdBy: oid(USER_A) })],
        ownerships: [
          ownership(USER_A, { groupIds: [GROUP_1] }),
          ownership(USER_B, { groupIds: [GROUP_1] }),
        ],
      });
      assert.deepEqual(result.groupCreatedBy, []);
      assert.deepEqual(result.ambiguous.groups, [GROUP_1, GROUP_2]);
    });

    it('does not use setlist holdings as folder membership', () => {
      const result = plan({
        groups: [group(GROUP_1)],
        ownerships: [ownership(USER_A, { setlistIds: [GROUP_1] })],
      });
      assert.deepEqual(result.groupCreatedBy, []);
      assert.deepEqual(result.ambiguous.groups, [GROUP_1]);
    });
  });

  describe('folder and setlist links', () => {
    it('adds the folder to a setlist the folder lists', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1, { createdBy: oid(USER_A) })],
        groups: [group(GROUP_1, { createdBy: oid(USER_A), setlistIds: [oid(SETLIST_1)] })],
      });
      assert.deepEqual(result.setlistGroupAdds, [{ setlistId: SETLIST_1, groupId: GROUP_1 }]);
      assert.deepEqual(result.groupSetlistAdds, []);
    });

    it('adds the setlist to a folder the setlist lists', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1, { createdBy: oid(USER_A), groupIds: [oid(GROUP_1)] })],
        groups: [group(GROUP_1, { createdBy: oid(USER_A) })],
      });
      assert.deepEqual(result.groupSetlistAdds, [{ groupId: GROUP_1, setlistId: SETLIST_1 }]);
      assert.deepEqual(result.setlistGroupAdds, []);
    });

    it('matches string and ObjectId references alike', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1, { createdBy: USER_A, groupIds: [GROUP_1] })],
        groups: [group(GROUP_1, { createdBy: USER_A, setlistIds: [oid(SETLIST_1)] })],
      });
      assert.deepEqual(result, EMPTY_PLAN);
    });
  });

  describe('deleted and missing documents', () => {
    it('ignores soft-deleted setlists, folders, and ownerships', () => {
      const result = plan({
        setlists: [setlist(SETLIST_1, { isDeleted: true }), setlist(SETLIST_2)],
        groups: [group(GROUP_1, { isDeleted: true }), group(GROUP_2)],
        ownerships: [
          ownership(USER_A, { groupIds: [GROUP_1, GROUP_2], setlistIds: [SETLIST_1, SETLIST_2] }),
          ownership(USER_B, { groupIds: [GROUP_2], isDeleted: true, setlistIds: [SETLIST_2] }),
        ],
      });
      assert.deepEqual(result.setlistCreatedBy, [{ setlistId: SETLIST_2, userId: USER_A }]);
      assert.deepEqual(result.groupCreatedBy, [{ groupId: GROUP_2, userId: USER_A }]);
      assert.deepEqual(result.ambiguous, { setlists: [], groups: [] });
    });

    it('reports links to deleted or missing documents without syncing them', () => {
      const result = plan({
        setlists: [
          setlist(SETLIST_1, { createdBy: USER_A, groupIds: [oid(GROUP_2), oid(GROUP_3)] }),
          setlist(SETLIST_2, { createdBy: USER_A, isDeleted: true }),
        ],
        groups: [
          group(GROUP_1, { createdBy: USER_A, setlistIds: [oid(SETLIST_2), oid(SETLIST_3)] }),
          group(GROUP_2, { createdBy: USER_A, isDeleted: true }),
        ],
      });
      assert.deepEqual(result.setlistGroupAdds, []);
      assert.deepEqual(result.groupSetlistAdds, []);
      assert.deepEqual(result.danglingLinks, {
        setlistGroupRefs: [
          { setlistId: SETLIST_1, groupId: GROUP_2 },
          { setlistId: SETLIST_1, groupId: GROUP_3 },
        ],
        groupSetlistRefs: [
          { groupId: GROUP_1, setlistId: SETLIST_2 },
          { groupId: GROUP_1, setlistId: SETLIST_3 },
        ],
      });
    });
  });

  it('plans nothing new against an already backfilled dataset', () => {
    const setlists = [
      setlist(SETLIST_1),
      setlist(SETLIST_2, { groupIds: [oid(GROUP_1)] }),
      setlist(SETLIST_3),
    ];
    const groups = [group(GROUP_1), group(GROUP_2, { setlistIds: [oid(SETLIST_1)] })];
    const ownerships = [
      ownership(USER_A, { groupIds: [GROUP_1, GROUP_2], setlistIds: [SETLIST_1, SETLIST_3] }),
      ownership(USER_B, { groupIds: [GROUP_2], setlistIds: [SETLIST_2, SETLIST_3] }),
    ];

    const first = planBackfill({ setlists, groups, ownerships });
    assert.equal(first.setlistCreatedBy.length, 2);
    assert.equal(first.groupCreatedBy.length, 1);
    assert.equal(first.setlistGroupAdds.length, 1);
    assert.equal(first.groupSetlistAdds.length, 1);

    const backfilled = applyPlan(setlists, groups, first);
    const second = planBackfill({ ...backfilled, ownerships });
    assert.deepEqual(second, {
      ...EMPTY_PLAN,
      ambiguous: { setlists: [SETLIST_3], groups: [GROUP_2] },
    });
  });
});
