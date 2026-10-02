import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { InvalidInputError } from '../db/cast';
import { groupRepository } from '../db/repositories/group.repository';
import { CallerAccess, ownershipRepository } from '../db/repositories/ownership.repository';
import { setlistRepository } from '../db/repositories/setlist.repository';
import { FakeRequestInit, callHandler, createRequest, createResponse } from '../testing/http';
import { GroupAccess, GroupRecord } from '../types/group.types';
import { SetlistAccess } from '../types/setlist.types';
import { TokenUser } from '../utils/verify-jwt';
import {
  createGroup,
  deleteGroup,
  getGroup,
  updateGroup,
  updateGroupMembers,
} from './group.controllers';

const GROUP_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';
const USER: TokenUser = { accessType: 'ministry', id: '507f1f77bcf86cd799439021' };
const ADMIN: TokenUser = { accessType: 'admin', id: '507f1f77bcf86cd799439029' };
const OTHER_USER_ID = '507f1f77bcf86cd799439022';
const MEMBER_A = '507f1f77bcf86cd799439031';
const MEMBER_B = '507f1f77bcf86cd799439032';
const SETLIST_ID = '507f1f77bcf86cd799439041';
const NEW_SETLIST_ID = '507f1f77bcf86cd799439042';
const CREATED_AT = new Date('2026-01-02T03:04:05.000Z');
const FORBIDDEN = { error: 'Access denied', message: 'Forbidden' };

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest(init), res);
  return res;
};

const storedGroup = (fields: Partial<GroupAccess> = {}): GroupAccess => ({
  _id: GROUP_ID,
  createdAt: CREATED_AT,
  groupName: 'Team',
  ...fields,
});

const storedRecord = (fields: Partial<GroupRecord> = {}): GroupRecord => ({
  ...storedGroup(),
  isDeleted: false,
  setlistIds: [],
  updatedAt: CREATED_AT,
  ...fields,
});

const membership = (...groupIds: string[]): CallerAccess => ({
  groupIds: groupIds.map((id) => ({ createdAt: CREATED_AT.toISOString(), id, name: 'Team' })),
  setlistIds: [],
});

const mockGroup = (group: GroupAccess | null) =>
  mock.method(groupRepository, 'findLiveAccess', async () => group);

const mockRecord = (group: GroupRecord | null) =>
  mock.method(groupRepository, 'findLiveById', async () => group);

const mockOwnership = (ownership: CallerAccess | null) =>
  mock.method(ownershipRepository, 'findCallerAccess', async () => ownership);

const mockSetlists = (...setlists: SetlistAccess[]) =>
  mock.method(setlistRepository, 'findLiveAccessByIds', async (ids: string[]) =>
    setlists.filter(({ _id }) => ids.includes(_id))
  );

describe('group controllers', () => {
  beforeEach(() => {
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createGroup', () => {
    it('rejects a request without req.user', async () => {
      const create = mock.method(groupRepository, 'create', async () => ({}));
      const res = await call(createGroup, { body: { groupName: 'Team' } });
      assert.equal(res.statusCode, 401);
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects a body with no allowed fields', async () => {
      const create = mock.method(groupRepository, 'create', async () => ({}));
      for (const body of [undefined, {}, { createdBy: OTHER_ID, isDeleted: true }]) {
        const res = await call(createGroup, { body, user: USER });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('creates the group from the allowed fields with createdBy from req.user', async () => {
      const created = { _id: GROUP_ID, groupName: 'Team' };
      mockOwnership(null);
      mockSetlists({ _id: OTHER_ID, createdBy: USER.id, groupIds: [], songs: [] });
      const create = mock.method(groupRepository, 'create', async () => created);
      const res = await call(createGroup, {
        body: { createdBy: OTHER_ID, groupName: 'Team', isDeleted: true, setlistIds: [OTHER_ID] },
        user: USER,
      });
      assert.deepEqual(create.mock.calls[0]?.arguments, [
        { createdBy: USER.id, groupName: 'Team', setlistIds: [OTHER_ID] },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, created);
    });

    it('forbids creating a folder with a setlist the caller cannot edit', async () => {
      mockOwnership(null);
      mockSetlists({ _id: OTHER_ID, createdBy: OTHER_USER_ID, groupIds: [], songs: [] });
      const create = mock.method(groupRepository, 'create', async () => ({}));
      const res = await call(createGroup, {
        body: { groupName: 'Team', setlistIds: [OTHER_ID] },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(create.mock.callCount(), 0);
    });

    it('maps a validation error to 400', async () => {
      mock.method(groupRepository, 'create', async () => {
        throw new InvalidInputError('groupName');
      });
      const res = await call(createGroup, { body: { setlistIds: [] }, user: USER });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
    });
  });

  describe('getGroup', () => {
    it('rejects an invalid id before querying', async () => {
      const findLiveById = mockRecord(null);
      for (const id of ['bad', '', [GROUP_ID], { $ne: null }]) {
        const res = await call(getGroup, { query: { id } });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid group id');
      }
      assert.equal(findLiveById.mock.callCount(), 0);
    });

    it('returns 404 when the group is missing or deleted', async () => {
      const findLiveById = mockRecord(null);
      const res = await call(getGroup, { query: { id: GROUP_ID } });
      assert.deepEqual(findLiveById.mock.calls[0]?.arguments, [GROUP_ID]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
    });

    it('returns the group', async () => {
      const group = storedRecord();
      mockRecord(group);
      const res = await call(getGroup, { query: { id: GROUP_ID } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, group);
    });

    it('lists non-deleted groups, or 404 when there are none', async () => {
      const listLive = mock.method(
        groupRepository,
        'listLive',
        async (): Promise<GroupRecord[]> => []
      );
      const empty = await call(getGroup, {});
      assert.equal(listLive.mock.callCount(), 1);
      assert.equal(empty.statusCode, 404);
      assert.equal(empty.body, 'No groups found');

      const groups = [storedRecord()];
      listLive.mock.mockImplementation(async () => groups);
      const listed = await call(getGroup, {});
      assert.equal(listed.statusCode, 200);
      assert.equal(listed.body, groups);
    });

    it('maps an unexpected query error to a generic 500', async () => {
      mock.method(groupRepository, 'listLive', async () => {
        throw new Error('db down');
      });
      const res = await call(getGroup, {});
      assert.equal(res.statusCode, 500);
      assert.equal(res.body, 'Something went wrong');
    });
  });

  describe('updateGroup', () => {
    it('rejects a request without req.user', async () => {
      const res = await call(updateGroup, { body: { groupName: 'Team', id: GROUP_ID } });
      assert.equal(res.statusCode, 401);
    });

    it('rejects a missing or invalid id, or no allowed fields', async () => {
      const findLiveById = mockRecord(null);
      for (const body of [
        undefined,
        { groupName: 'Team' },
        { groupName: 'Team', id: 'bad' },
        { id: GROUP_ID },
        { createdBy: OTHER_ID, id: GROUP_ID },
      ]) {
        const res = await call(updateGroup, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(findLiveById.mock.callCount(), 0);
    });

    it('returns 404 when no live group matches', async () => {
      const findLiveById = mockRecord(null);
      const update = mock.method(groupRepository, 'updateLive', async () => null);
      const res = await call(updateGroup, {
        body: { groupName: 'Team', id: GROUP_ID },
        user: USER,
      });
      assert.deepEqual(findLiveById.mock.calls[0]?.arguments, [GROUP_ID]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
      assert.equal(update.mock.callCount(), 0);
    });

    it('forbids a caller who is neither the creator nor a member', async () => {
      mockRecord(storedRecord({ createdBy: OTHER_USER_ID }));
      mockOwnership(membership(OTHER_ID));
      const update = mock.method(groupRepository, 'updateLive', async () => null);
      const res = await call(updateGroup, {
        body: { groupName: 'Team', id: GROUP_ID },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(update.mock.callCount(), 0);
    });

    it('lets a member, the creator, and an admin update only allowed fields', async () => {
      const cases: [TokenUser, Partial<GroupRecord>, CallerAccess | null][] = [
        [USER, { createdBy: OTHER_USER_ID }, membership(GROUP_ID)],
        [USER, { createdBy: USER.id }, null],
        [USER, {}, membership(GROUP_ID)],
        [ADMIN, { createdBy: OTHER_USER_ID }, null],
      ];
      for (const [user, stored, ownership] of cases) {
        mockRecord(storedRecord(stored));
        mockOwnership(ownership);
        const group = storedRecord({ groupName: 'Renamed' });
        const update = mock.method(groupRepository, 'updateLive', async () => group);
        const res = await call(updateGroup, {
          body: { createdBy: OTHER_ID, groupName: 'Renamed', id: GROUP_ID },
          user,
        });
        assert.deepEqual(update.mock.calls[0]?.arguments, [GROUP_ID, { groupName: 'Renamed' }]);
        assert.equal(res.statusCode, 200, JSON.stringify(stored));
        assert.equal(res.body, group);
        mock.restoreAll();
      }
    });

    it('lets a member add a setlist the member can edit and keep or drop existing ones', async () => {
      mockRecord(storedRecord({ createdBy: OTHER_USER_ID, setlistIds: [SETLIST_ID] }));
      mockOwnership(membership(GROUP_ID));
      const lookup = mockSetlists({
        _id: NEW_SETLIST_ID,
        createdBy: USER.id,
        groupIds: [],
        songs: [],
      });
      const update = mock.method(groupRepository, 'updateLive', async () => storedRecord());
      for (const setlistIds of [[SETLIST_ID, NEW_SETLIST_ID], []]) {
        const res = await call(updateGroup, { body: { id: GROUP_ID, setlistIds }, user: USER });
        assert.equal(res.statusCode, 200, JSON.stringify(setlistIds));
      }
      assert.deepEqual(lookup.mock.calls[0]?.arguments, [[NEW_SETLIST_ID]]);
      assert.equal(lookup.mock.callCount(), 1);
      assert.equal(update.mock.callCount(), 2);
    });

    it('forbids a member from pulling in a setlist the member cannot edit, or a missing one', async () => {
      mockRecord(storedRecord({ createdBy: OTHER_USER_ID }));
      mockOwnership(membership(GROUP_ID));
      mockSetlists({ _id: NEW_SETLIST_ID, createdBy: OTHER_USER_ID, groupIds: [], songs: [] });
      const update = mock.method(groupRepository, 'updateLive', async () => null);
      for (const setlistIds of [[NEW_SETLIST_ID], [SETLIST_ID]]) {
        const res = await call(updateGroup, { body: { id: GROUP_ID, setlistIds }, user: USER });
        assert.equal(res.statusCode, 403, JSON.stringify(setlistIds));
        assert.deepEqual(res.body, FORBIDDEN);
      }
      assert.equal(update.mock.callCount(), 0);
    });

    it('rejects setlistIds that are not object ids', async () => {
      mockRecord(storedRecord({ createdBy: USER.id }));
      mockOwnership(null);
      const update = mock.method(groupRepository, 'updateLive', async () => null);
      const res = await call(updateGroup, {
        body: { id: GROUP_ID, setlistIds: ['x'] },
        user: USER,
      });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
      assert.equal(update.mock.callCount(), 0);
    });
  });

  describe('updateGroupMembers', () => {
    it('rejects a request without req.user', async () => {
      const res = await call(updateGroupMembers, { body: { add: [MEMBER_A], groupId: GROUP_ID } });
      assert.equal(res.statusCode, 401);
    });

    it('rejects an invalid groupId, invalid user ids, or an empty change', async () => {
      const findLiveAccess = mockGroup(null);
      for (const body of [
        undefined,
        { add: [MEMBER_A] },
        { add: [MEMBER_A], groupId: 'bad' },
        { groupId: GROUP_ID },
        { add: [], groupId: GROUP_ID, remove: [] },
        { add: MEMBER_A, groupId: GROUP_ID },
        { add: ['bad'], groupId: GROUP_ID },
        { groupId: GROUP_ID, remove: [{ $ne: null }] },
      ]) {
        const res = await call(updateGroupMembers, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(findLiveAccess.mock.callCount(), 0);
    });

    it('returns 404 when no live group matches', async () => {
      mockGroup(null);
      const change = mock.method(ownershipRepository, 'changeGroupMembership', async () => ({
        added: 1,
        removed: 0,
      }));
      const res = await call(updateGroupMembers, {
        body: { add: [MEMBER_A], groupId: GROUP_ID },
        user: USER,
      });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
      assert.equal(change.mock.callCount(), 0);
    });

    it('forbids a caller who is neither the creator nor a member', async () => {
      mockGroup(storedGroup({ createdBy: OTHER_USER_ID }));
      mockOwnership(membership(OTHER_ID));
      const change = mock.method(ownershipRepository, 'changeGroupMembership', async () => ({
        added: 1,
        removed: 0,
      }));
      const res = await call(updateGroupMembers, {
        body: { add: [USER.id], groupId: GROUP_ID },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(change.mock.callCount(), 0);
    });

    it('adds and removes members on their ownership records for a member', async () => {
      mockGroup(storedGroup({ createdBy: OTHER_USER_ID }));
      mockOwnership(membership(GROUP_ID));
      const change = mock.method(ownershipRepository, 'changeGroupMembership', async () => ({
        added: 1,
        removed: 1,
      }));
      const res = await call(updateGroupMembers, {
        body: { add: [MEMBER_A, MEMBER_A], groupId: GROUP_ID, remove: [MEMBER_B] },
        user: USER,
      });
      assert.deepEqual(change.mock.calls[0]?.arguments, [
        {
          add: [MEMBER_A],
          entry: { createdAt: CREATED_AT.toISOString(), id: GROUP_ID, name: 'Team' },
          remove: [MEMBER_B],
        },
      ]);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { added: 1, groupId: GROUP_ID, removed: 1 });
    });

    it('lets the creator and an admin manage members', async () => {
      for (const [user, stored] of [
        [USER, storedGroup({ createdBy: USER.id })],
        [ADMIN, storedGroup({ createdBy: OTHER_USER_ID })],
      ] as const) {
        mockGroup(stored);
        mockOwnership(null);
        const change = mock.method(ownershipRepository, 'changeGroupMembership', async () => ({
          added: 0,
          removed: 1,
        }));
        const res = await call(updateGroupMembers, {
          body: { groupId: GROUP_ID, remove: [MEMBER_B] },
          user,
        });
        assert.equal(change.mock.callCount(), 1);
        assert.deepEqual(change.mock.calls[0]?.arguments[0]?.add, []);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { added: 0, groupId: GROUP_ID, removed: 1 });
        mock.restoreAll();
      }
    });
  });

  describe('deleteGroup', () => {
    it('rejects a request without req.user', async () => {
      const res = await call(deleteGroup, { body: { id: GROUP_ID } });
      assert.equal(res.statusCode, 401);
    });

    it('rejects bodies without a valid id', async () => {
      const findLiveAccess = mockGroup(null);
      for (const body of [
        undefined,
        {},
        { params: null },
        { params: {} },
        { params: { id: 'bad' } },
        { id: 'bad', params: { id: 'bad' } },
      ]) {
        const res = await call(deleteGroup, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(findLiveAccess.mock.callCount(), 0);
    });

    it('uses whichever of params.id and id is a valid id, preferring params.id', async () => {
      const findLiveAccess = mockGroup(storedGroup({ createdBy: USER.id }));
      mockOwnership(null);
      mock.method(groupRepository, 'softDeleteCascade', async () => true);
      for (const body of [
        { id: OTHER_ID, params: { id: GROUP_ID } },
        { id: OTHER_ID },
        { id: OTHER_ID, params: { id: 'bad' } },
      ]) {
        const res = await call(deleteGroup, { body, user: USER });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'Group deleted');
      }
      assert.deepEqual(
        findLiveAccess.mock.calls.map((callArgs) => callArgs.arguments[0]),
        [GROUP_ID, OTHER_ID, OTHER_ID]
      );
    });

    it('returns 404 when no live group matches', async () => {
      mockGroup(null);
      const softDelete = mock.method(groupRepository, 'softDeleteCascade', async () => true);
      const res = await call(deleteGroup, { body: { params: { id: GROUP_ID } }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
      assert.equal(softDelete.mock.callCount(), 0);
    });

    it('forbids members who did not create the group, and non-members on legacy groups', async () => {
      const softDelete = mock.method(groupRepository, 'softDeleteCascade', async () => true);
      for (const [stored, ownership] of [
        [storedGroup({ createdBy: OTHER_USER_ID }), membership(GROUP_ID)],
        [storedGroup(), membership(OTHER_ID)],
        [storedGroup(), null],
      ] as const) {
        mockGroup(stored);
        mockOwnership(ownership);
        const res = await call(deleteGroup, { body: { id: GROUP_ID }, user: USER });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, FORBIDDEN);
      }
      assert.equal(softDelete.mock.callCount(), 0);
    });

    it('lets the creator, an admin, or a member of a legacy group delete with the cascade', async () => {
      const cases: [TokenUser, Partial<GroupAccess>, CallerAccess | null][] = [
        [USER, { createdBy: USER.id }, null],
        [ADMIN, { createdBy: OTHER_USER_ID }, null],
        [USER, {}, membership(GROUP_ID)],
      ];
      for (const [user, stored, ownership] of cases) {
        mockGroup(storedGroup(stored));
        mockOwnership(ownership);
        const softDelete = mock.method(groupRepository, 'softDeleteCascade', async () => true);
        const res = await call(deleteGroup, { body: { params: { id: GROUP_ID } }, user });
        assert.deepEqual(softDelete.mock.calls[0]?.arguments, [GROUP_ID]);
        assert.equal(res.statusCode, 200, JSON.stringify(stored));
        assert.equal(res.body, 'Group deleted');
        mock.restoreAll();
      }
    });

    it('returns 404 when the soft delete matches nothing', async () => {
      mockGroup(storedGroup({ createdBy: USER.id }));
      mockOwnership(null);
      mock.method(groupRepository, 'softDeleteCascade', async () => false);
      const res = await call(deleteGroup, { body: { id: GROUP_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
    });
  });
});
