import { Error as MongooseError } from 'mongoose';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Group } from '../models/group.model';
import {
  FakeRequestInit,
  callHandler,
  createRequest,
  createResponse,
  execResult,
  rejectedExec,
} from '../testing/http';
import { createGroup, deleteGroup, getGroup, updateGroup } from './group.controllers';

const GROUP_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest(init), res);
  return res;
};

describe('group controllers', () => {
  beforeEach(() => {
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createGroup', () => {
    it('rejects a body with no allowed fields', async () => {
      const create = mock.method(Group, 'create', async () => ({}));
      for (const body of [undefined, {}, { createdBy: OTHER_ID, isDeleted: true }]) {
        const res = await call(createGroup, { body });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('creates the group from the allowed fields only', async () => {
      const created = { _id: GROUP_ID, groupName: 'Team' };
      const create = mock.method(Group, 'create', async () => created);
      const res = await call(createGroup, {
        body: { createdBy: OTHER_ID, groupName: 'Team', isDeleted: true, setlistIds: [OTHER_ID] },
      });
      assert.deepEqual(create.mock.calls[0]?.arguments, [
        { groupName: 'Team', setlistIds: [OTHER_ID] },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, created);
    });

    it('maps a validation error to 400', async () => {
      mock.method(Group, 'create', async () => {
        throw new MongooseError.ValidationError();
      });
      const res = await call(createGroup, { body: { setlistIds: [] } });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
    });
  });

  describe('getGroup', () => {
    it('rejects an invalid id before querying', async () => {
      const findOne = mock.method(Group, 'findOne', () => execResult(null));
      for (const id of ['bad', '', [GROUP_ID], { $ne: null }]) {
        const res = await call(getGroup, { query: { id } });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid group id');
      }
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('returns 404 when the group is missing or deleted', async () => {
      const findOne = mock.method(Group, 'findOne', () => execResult(null));
      const res = await call(getGroup, { query: { id: GROUP_ID } });
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [{ _id: GROUP_ID, isDeleted: false }]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
    });

    it('returns the group', async () => {
      const group = { _id: GROUP_ID };
      mock.method(Group, 'findOne', () => execResult(group));
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
    it('rejects a missing or invalid id, or no allowed fields', async () => {
      const update = mock.method(Group, 'findOneAndUpdate', async () => null);
      for (const body of [
        undefined,
        { groupName: 'Team' },
        { groupName: 'Team', id: 'bad' },
        { id: GROUP_ID },
        { createdBy: OTHER_ID, id: GROUP_ID },
      ]) {
        const res = await call(updateGroup, { body });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(update.mock.callCount(), 0);
    });

    it('returns 404 when no live group matches', async () => {
      const update = mock.method(Group, 'findOneAndUpdate', async () => null);
      const res = await call(updateGroup, {
        body: { createdBy: OTHER_ID, groupName: 'Team', id: GROUP_ID },
      });
      assert.deepEqual(update.mock.calls[0]?.arguments, [
        { _id: GROUP_ID, isDeleted: false },
        { $set: { groupName: 'Team' } },
        { new: true, runValidators: true },
      ]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
    });

    it('returns the updated group', async () => {
      const group = { _id: GROUP_ID, groupName: 'Team' };
      mock.method(Group, 'findOneAndUpdate', async () => group);
      const res = await call(updateGroup, { body: { groupName: 'Team', id: GROUP_ID } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, group);
    });

    it('maps a cast error to 400', async () => {
      mock.method(Group, 'findOneAndUpdate', async () => {
        throw new MongooseError.CastError('ObjectId', 'x', 'setlistIds');
      });
      const res = await call(updateGroup, { body: { id: GROUP_ID, setlistIds: ['x'] } });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
    });
  });

  describe('deleteGroup', () => {
    it('rejects bodies without a valid id', async () => {
      const updateOne = mock.method(Group, 'updateOne', async () => ({ matchedCount: 1 }));
      for (const body of [
        undefined,
        {},
        { params: null },
        { params: {} },
        { params: { id: 'bad' } },
        { id: GROUP_ID, params: { id: 'bad' } },
      ]) {
        const res = await call(deleteGroup, { body });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(updateOne.mock.callCount(), 0);
    });

    it('soft-deletes by params.id, falling back to id', async () => {
      const updateOne = mock.method(Group, 'updateOne', async () => ({ matchedCount: 1 }));
      const byParams = await call(deleteGroup, {
        body: { id: OTHER_ID, params: { id: GROUP_ID } },
      });
      const byId = await call(deleteGroup, { body: { id: OTHER_ID } });
      assert.deepEqual(updateOne.mock.calls[0]?.arguments, [
        { _id: GROUP_ID, isDeleted: false },
        { $set: { isDeleted: true } },
      ]);
      assert.deepEqual(updateOne.mock.calls[1]?.arguments[0], { _id: OTHER_ID, isDeleted: false });
      for (const res of [byParams, byId]) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'Group deleted');
      }
    });

    it('returns 404 when no live group matches', async () => {
      mock.method(Group, 'updateOne', async () => ({ matchedCount: 0 }));
      const res = await call(deleteGroup, { body: { params: { id: GROUP_ID } } });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Group not found');
    });
  });
});
