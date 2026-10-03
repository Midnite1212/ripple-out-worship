import { Error as MongooseError, Types } from 'mongoose';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Group } from '../models/group.model';
import { Ownership } from '../models/ownership.model';
import { Setlist } from '../models/setlist.model';
import {
  FakeRequestInit,
  callHandler,
  createRequest,
  createResponse,
  execResult,
  rejectedExec,
} from '../testing/http';
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
const CREATED_AT = new Date('2026-01-02T03:04:05.000Z');
const FORBIDDEN = { error: 'Access denied', message: 'Forbidden' };

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest(init), res);
  return res;
};

const storedGroup = (fields: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(GROUP_ID),
  createdAt: CREATED_AT,
  groupName: 'Team',
  ...fields,
});

const membership = (...groupIds: string[]) => ({
  groupIds: groupIds.map((id) => ({ createdAt: CREATED_AT.toISOString(), id, name: 'Team' })),
  setlistIds: [],
});

const mockGroup = (group: unknown) => mock.method(Group, 'findOne', () => execResult(group));

const mockOwnership = (ownership: unknown) =>
  mock.method(Ownership, 'findOne', () => execResult(ownership));

describe('group controllers', () => {
  beforeEach(() => {
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createGroup', () => {
    it('rejects a request without req.user', async () => {
      const create = mock.method(Group, 'create', async () => ({}));
      const res = await call(createGroup, { body: { groupName: 'Team' } });
      assert.equal(res.statusCode, 401);
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects a body with no allowed fields', async () => {
      const create = mock.method(Group, 'create', async () => ({}));
      for (const body of [undefined, {}, { createdBy: OTHER_ID, isDeleted: true }]) {
        const res = await call(createGroup, { body, user: USER });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('creates the group from the allowed fields with createdBy from req.user', async () => {
      const created = { _id: GROUP_ID, groupName: 'Team' };
      const create = mock.method(Group, 'create', async () => created);
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

    it('maps a validation error to 400', async () => {
      mock.method(Group, 'create', async () => {
        throw new MongooseError.ValidationError();
      });
      const res = await call(createGroup, { body: { setlistIds: [] }, user: USER });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
    });
  });

  describe('getGroup', () => {
    it('rejects an invalid id before querying', async () => {
      const findOne = mockGroup(null);
      for (const id of ['bad', '', [GROUP_ID], { $ne: null }]) {
        const res = await call(getGroup, { query: { id } });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid group id');
      }
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('returns 404 when the group is missing or deleted', async () => {
      const findOne = mockGroup(null);
      const res = await call(getGroup, { query: { id: GROUP_ID } });
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [{ _id: GROUP_ID, isDeleted: false }]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
    });

    it('returns the group', async () => {
      const group = { _id: GROUP_ID };
      mockGroup(group);
      const res = await call(getGroup, { query: { id: GROUP_ID } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, group);
    });

    it('lists non-deleted groups, or 404 when there are none', async () => {
      const find = mock.method(Group, 'find', () => execResult([]));
      const empty = await call(getGroup, {});
      assert.deepEqual(find.mock.calls[0]?.arguments, [{ isDeleted: false }]);
      assert.equal(empty.statusCode, 404);
      assert.equal(empty.body, 'No groups found');

      const groups = [{ _id: GROUP_ID }];
      find.mock.mockImplementation(() => execResult(groups));
      const listed = await call(getGroup, {});
      assert.equal(listed.statusCode, 200);
      assert.equal(listed.body, groups);
    });

    it('maps an unexpected query error to a generic 500', async () => {
      mock.method(Group, 'find', () => rejectedExec(new Error('db down')));
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
      const findOne = mockGroup(null);
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
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('returns 404 when no live group matches', async () => {
      const findOne = mockGroup(null);
      const update = mock.method(Group, 'findOneAndUpdate', async () => ({}));
      const res = await call(updateGroup, {
        body: { groupName: 'Team', id: GROUP_ID },
        user: USER,
      });
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [
        { _id: GROUP_ID, isDeleted: false },
        'createdBy groupName createdAt',
      ]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
      assert.equal(update.mock.callCount(), 0);
    });

    it('forbids a caller who is neither the creator nor a member', async () => {
      mockGroup(storedGroup({ createdBy: OTHER_USER_ID }));
      mockOwnership(membership(OTHER_ID));
      const update = mock.method(Group, 'findOneAndUpdate', async () => ({}));
      const res = await call(updateGroup, {
        body: { groupName: 'Team', id: GROUP_ID },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(update.mock.callCount(), 0);
    });

    it('lets a member, the creator, and an admin update only allowed fields', async () => {
      const cases: [TokenUser, Record<string, unknown>, unknown][] = [
        [USER, { createdBy: OTHER_USER_ID }, membership(GROUP_ID)],
        [USER, { createdBy: new Types.ObjectId(USER.id) }, null],
        [USER, {}, membership(GROUP_ID)],
        [ADMIN, { createdBy: OTHER_USER_ID }, null],
      ];
      for (const [user, stored, ownership] of cases) {
        mockGroup(storedGroup(stored));
        mockOwnership(ownership);
        const group = { _id: GROUP_ID, groupName: 'Renamed' };
        const update = mock.method(Group, 'findOneAndUpdate', async () => group);
        const res = await call(updateGroup, {
          body: { createdBy: OTHER_ID, groupName: 'Renamed', id: GROUP_ID },
          user,
        });
        assert.deepEqual(update.mock.calls[0]?.arguments, [
          { _id: GROUP_ID, isDeleted: false },
          { $set: { groupName: 'Renamed' } },
          { new: true, runValidators: true },
        ]);
        assert.equal(res.statusCode, 200, JSON.stringify(stored));
        assert.equal(res.body, group);
        mock.restoreAll();
      }
    });

    it('maps a cast error to 400', async () => {
      mockGroup(storedGroup({ createdBy: USER.id }));
      mockOwnership(null);
      mock.method(Group, 'findOneAndUpdate', async () => {
        throw new MongooseError.CastError('ObjectId', 'x', 'setlistIds');
      });
      const res = await call(updateGroup, {
        body: { id: GROUP_ID, setlistIds: ['x'] },
        user: USER,
      });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
    });
  });

  describe('updateGroupMembers', () => {
    it('rejects a request without req.user', async () => {
      const res = await call(updateGroupMembers, { body: { add: [MEMBER_A], groupId: GROUP_ID } });
      assert.equal(res.statusCode, 401);
    });

    it('rejects an invalid groupId, invalid user ids, or an empty change', async () => {
      const findOne = mockGroup(null);
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
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('returns 404 when no live group matches', async () => {
      mockGroup(null);
      const updateMany = mock.method(Ownership, 'updateMany', async () => ({ modifiedCount: 1 }));
      const res = await call(updateGroupMembers, {
        body: { add: [MEMBER_A], groupId: GROUP_ID },
        user: USER,
      });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
      assert.equal(updateMany.mock.callCount(), 0);
    });

    it('forbids a caller who is neither the creator nor a member', async () => {
      mockGroup(storedGroup({ createdBy: OTHER_USER_ID }));
      mockOwnership(membership(OTHER_ID));
      const updateMany = mock.method(Ownership, 'updateMany', async () => ({ modifiedCount: 1 }));
      const res = await call(updateGroupMembers, {
        body: { add: [USER.id], groupId: GROUP_ID },
        user: USER,
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, FORBIDDEN);
      assert.equal(updateMany.mock.callCount(), 0);
    });

    it('adds and removes members on their ownership records for a member', async () => {
      mockGroup(storedGroup({ createdBy: OTHER_USER_ID }));
      mockOwnership(membership(GROUP_ID));
      const updateMany = mock.method(Ownership, 'updateMany', async () => ({ modifiedCount: 1 }));
      const res = await call(updateGroupMembers, {
        body: { add: [MEMBER_A, MEMBER_A], groupId: GROUP_ID, remove: [MEMBER_B] },
        user: USER,
      });
      assert.deepEqual(updateMany.mock.calls[0]?.arguments, [
        { 'groupIds.id': { $ne: GROUP_ID }, isDeleted: false, userId: { $in: [MEMBER_A] } },
        {
          $addToSet: {
            groupIds: { createdAt: CREATED_AT.toISOString(), id: GROUP_ID, name: 'Team' },
          },
        },
      ]);
      assert.deepEqual(updateMany.mock.calls[1]?.arguments, [
        { isDeleted: false, userId: { $in: [MEMBER_B] } },
        { $pull: { groupIds: { id: GROUP_ID } } },
      ]);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { added: 1, groupId: GROUP_ID, removed: 1 });
    });

    it('lets the creator and an admin manage members, skipping empty lists', async () => {
      for (const [user, stored] of [
        [USER, storedGroup({ createdBy: new Types.ObjectId(USER.id) })],
        [ADMIN, storedGroup({ createdBy: OTHER_USER_ID })],
      ] as const) {
        mockGroup(stored);
        mockOwnership(null);
        const updateMany = mock.method(Ownership, 'updateMany', async () => ({
          modifiedCount: 1,
        }));
        const res = await call(updateGroupMembers, {
          body: { groupId: GROUP_ID, remove: [MEMBER_B] },
          user,
        });
        assert.equal(updateMany.mock.callCount(), 1);
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
      const findOne = mockGroup(null);
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
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('uses whichever of params.id and id is a valid id, preferring params.id', async () => {
      const findOne = mockGroup(storedGroup({ createdBy: USER.id }));
      mockOwnership(null);
      mock.method(Group, 'updateOne', async () => ({ matchedCount: 1 }));
      mock.method(Ownership, 'updateMany', async () => ({}));
      mock.method(Setlist, 'updateMany', async () => ({}));
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
        findOne.mock.calls.map((callArgs) => callArgs.arguments[0]),
        [GROUP_ID, OTHER_ID, OTHER_ID].map((_id) => ({ _id, isDeleted: false }))
      );
    });

    it('returns 404 when no live group matches', async () => {
      mockGroup(null);
      const updateOne = mock.method(Group, 'updateOne', async () => ({ matchedCount: 1 }));
      const res = await call(deleteGroup, { body: { params: { id: GROUP_ID } }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
      assert.equal(updateOne.mock.callCount(), 0);
    });

    it('forbids members who did not create the group, and non-members on legacy groups', async () => {
      const updateOne = mock.method(Group, 'updateOne', async () => ({ matchedCount: 1 }));
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
      assert.equal(updateOne.mock.callCount(), 0);
    });

    it('lets the creator, an admin, or a member of a legacy group delete and cascades', async () => {
      const cases: [TokenUser, Record<string, unknown>, unknown][] = [
        [USER, { createdBy: new Types.ObjectId(USER.id) }, null],
        [ADMIN, { createdBy: OTHER_USER_ID }, null],
        [USER, {}, membership(GROUP_ID)],
      ];
      for (const [user, stored, ownership] of cases) {
        mockGroup(storedGroup(stored));
        mockOwnership(ownership);
        const updateOne = mock.method(Group, 'updateOne', async () => ({ matchedCount: 1 }));
        const pullOwnerships = mock.method(Ownership, 'updateMany', async () => ({}));
        const pullSetlists = mock.method(Setlist, 'updateMany', async () => ({}));
        const res = await call(deleteGroup, { body: { params: { id: GROUP_ID } }, user });
        assert.deepEqual(updateOne.mock.calls[0]?.arguments, [
          { _id: GROUP_ID, isDeleted: false },
          { $set: { isDeleted: true } },
        ]);
        assert.deepEqual(pullOwnerships.mock.calls[0]?.arguments, [
          { 'groupIds.id': GROUP_ID },
          { $pull: { groupIds: { id: GROUP_ID } } },
        ]);
        assert.deepEqual(pullSetlists.mock.calls[0]?.arguments, [
          { groupIds: GROUP_ID },
          { $pull: { groupIds: GROUP_ID } },
        ]);
        assert.equal(res.statusCode, 200, JSON.stringify(stored));
        assert.equal(res.body, 'Group deleted');
        mock.restoreAll();
      }
    });

    it('skips the cascade when the soft delete matches nothing', async () => {
      mockGroup(storedGroup({ createdBy: USER.id }));
      mockOwnership(null);
      mock.method(Group, 'updateOne', async () => ({ matchedCount: 0 }));
      const pullOwnerships = mock.method(Ownership, 'updateMany', async () => ({}));
      const res = await call(deleteGroup, { body: { id: GROUP_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(pullOwnerships.mock.callCount(), 0);
    });
  });
});
