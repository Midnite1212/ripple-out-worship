import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Ownership } from '../models/ownership.model';
import { Setlist } from '../models/setlist.model';
import {
  FakeRequestInit,
  callHandler,
  createRequest,
  createResponse,
  execResult,
} from '../testing/http';
import { TokenUser } from '../utils/verify-jwt';
import {
  createOwnership,
  deleteOwnership,
  getOwnership,
  updateOwnership,
} from './ownership.controllers';

const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_USER_ID = '507f1f77bcf86cd799439012';
const OWNERSHIP_ID = '507f1f77bcf86cd799439013';
const USER: TokenUser = { accessType: 'ministry', id: USER_ID };

const call = async (handler: Parameters<typeof callHandler>[0], init: FakeRequestInit) => {
  const res = createResponse();
  await callHandler(handler, createRequest(init), res);
  return res;
};

describe('ownership controllers', () => {
  beforeEach(() => {
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createOwnership', () => {
    it('rejects a request without req.user', async () => {
      const update = mock.method(Ownership, 'findOneAndUpdate', async () => ({}));
      const res = await call(createOwnership, { body: { fullName: 'Name' } });
      assert.equal(res.statusCode, 401);
      assert.equal(res.body, 'Unauthorized');
      assert.equal(update.mock.callCount(), 0);
    });

    it('rejects a missing, blank, or non-string fullName', async () => {
      const update = mock.method(Ownership, 'findOneAndUpdate', async () => ({}));
      for (const body of [undefined, {}, { fullName: '' }, { fullName: '   ' }, { fullName: 1 }]) {
        const res = await call(createOwnership, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(update.mock.callCount(), 0);
    });

    it('upserts on the caller id with identity from req.user, not the body', async () => {
      const ownership = { _id: OWNERSHIP_ID, userId: USER_ID };
      const update = mock.method(Ownership, 'findOneAndUpdate', async () => ownership);
      const res = await call(createOwnership, {
        body: { accessType: 'admin', fullName: 'Name', setlistIds: ['x'], userId: OTHER_USER_ID },
        user: USER,
      });
      assert.deepEqual(update.mock.calls[0]?.arguments, [
        { userId: USER_ID },
        {
          $setOnInsert: {
            accessType: 'ministry',
            fullName: 'Name',
            groupIds: [],
            setlistIds: [],
            userId: USER_ID,
          },
        },
        { new: true, upsert: true },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, ownership);
    });
  });

  describe('getOwnership', () => {
    it('rejects an invalid userId before querying', async () => {
      const findOne = mock.method(Ownership, 'findOne', () => execResult(null));
      for (const userId of ['bad', '', [USER_ID], { $ne: null }]) {
        const res = await call(getOwnership, { query: { userId }, user: USER });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid user id');
      }
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('returns 404 when the ownership is missing', async () => {
      const findOne = mock.method(Ownership, 'findOne', () => execResult(null));
      const res = await call(getOwnership, { query: { userId: OTHER_USER_ID }, user: USER });
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [
        { isDeleted: false, userId: OTHER_USER_ID },
      ]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Ownership not found');
    });

    it('returns the ownership of any user by userId', async () => {
      const ownership = { userId: OTHER_USER_ID };
      mock.method(Ownership, 'findOne', () => execResult(ownership));
      const res = await call(getOwnership, { query: { userId: OTHER_USER_ID }, user: USER });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, ownership);
    });

    it('lists every live ownership with a limited projection, even when empty', async () => {
      const select = mock.fn(() => execResult([]));
      const find = mock.method(Ownership, 'find', () => ({ select }));
      const res = await call(getOwnership, { user: USER });
      assert.deepEqual(find.mock.calls[0]?.arguments, [{ isDeleted: false }]);
      assert.deepEqual(select.mock.calls[0]?.arguments, ['userId fullName groupIds']);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });
  });

  describe('updateOwnership', () => {
    const SETLIST_ID = '507f1f77bcf86cd799439021';
    const NEW_SETLIST_ID = '507f1f77bcf86cd799439022';
    const GROUP_ID = '507f1f77bcf86cd799439031';
    const setlistEntry = (id: string) => ({ createdAt: '2026-01-01', id, name: 'Sunday' });
    const stored = (fields: Record<string, unknown> = {}) => ({
      _id: OWNERSHIP_ID,
      groupIds: [],
      setlistIds: [setlistEntry(SETLIST_ID)],
      userId: USER_ID,
      ...fields,
    });

    it('rejects a request without req.user', async () => {
      const res = await call(updateOwnership, { body: { _id: OWNERSHIP_ID, setlistIds: [] } });
      assert.equal(res.statusCode, 401);
    });

    it('rejects a missing or invalid _id, or no allowed fields, including groupIds alone', async () => {
      const findOne = mock.method(Ownership, 'findOne', () => execResult(null));
      for (const body of [
        undefined,
        { setlistIds: [] },
        { _id: 'bad', setlistIds: [] },
        { id: OWNERSHIP_ID, setlistIds: [] },
        { _id: OWNERSHIP_ID },
        { _id: OWNERSHIP_ID, groupIds: [] },
        { _id: OWNERSHIP_ID, fullName: 'Name', userId: USER_ID },
      ]) {
        const res = await call(updateOwnership, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('rejects setlistIds that are not a list of entries with valid ids', async () => {
      const findOne = mock.method(Ownership, 'findOne', () => execResult(null));
      for (const setlistIds of [null, 'x', [null], [{ id: 'bad' }], [{ name: 'Sunday' }]]) {
        const res = await call(updateOwnership, {
          body: { _id: OWNERSHIP_ID, setlistIds },
          user: USER,
        });
        assert.equal(res.statusCode, 400, JSON.stringify(setlistIds));
        assert.equal(res.body, 'Invalid setlist ids');
      }
      assert.equal(findOne.mock.callCount(), 0);
    });

    it('returns 404 when no live ownership matches', async () => {
      const findOne = mock.method(Ownership, 'findOne', () => execResult(null));
      const res = await call(updateOwnership, {
        body: { _id: OWNERSHIP_ID, setlistIds: [] },
        user: USER,
      });
      assert.deepEqual(findOne.mock.calls[0]?.arguments, [
        { _id: OWNERSHIP_ID, isDeleted: false },
        'userId groupIds setlistIds',
      ]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Ownership not found');
    });

    it('forbids updating the ownership of another user, even for an admin', async () => {
      mock.method(Ownership, 'findOne', () => execResult(stored({ userId: OTHER_USER_ID })));
      const update = mock.method(Ownership, 'findOneAndUpdate', async () => ({}));
      for (const user of [USER, { accessType: 'admin', id: '507f1f77bcf86cd799439019' }]) {
        const res = await call(updateOwnership, {
          body: { _id: OWNERSHIP_ID, setlistIds: [] },
          user,
        });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { error: 'Access denied', message: 'Forbidden' });
      }
      assert.equal(update.mock.callCount(), 0);
    });

    it('updates only setlistIds on the caller record, ignoring groupIds', async () => {
      mock.method(Ownership, 'findOne', () => execResult(stored()));
      const setlistFind = mock.method(Setlist, 'find', () => execResult([]));
      const ownership = { _id: OWNERSHIP_ID, userId: USER_ID };
      const update = mock.method(Ownership, 'findOneAndUpdate', async () => ownership);
      const res = await call(updateOwnership, {
        body: {
          _id: OWNERSHIP_ID,
          accessType: 'admin',
          groupIds: [{ id: GROUP_ID }],
          setlistIds: [],
          userId: OTHER_USER_ID,
        },
        user: USER,
      });
      assert.equal(setlistFind.mock.callCount(), 0);
      assert.deepEqual(update.mock.calls[0]?.arguments, [
        { _id: OWNERSHIP_ID, isDeleted: false, userId: USER_ID },
        { $set: { setlistIds: [] } },
        { new: true, runValidators: true },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, ownership);
    });

    it('allows adding a setlist the caller created or reaches through a folder', async () => {
      for (const setlist of [
        { _id: NEW_SETLIST_ID, createdBy: USER_ID, groupIds: [] },
        { _id: NEW_SETLIST_ID, createdBy: OTHER_USER_ID, groupIds: [GROUP_ID] },
      ]) {
        mock.method(Ownership, 'findOne', () =>
          execResult(stored({ groupIds: [{ createdAt: '', id: GROUP_ID, name: 'Team' }] }))
        );
        const setlistFind = mock.method(Setlist, 'find', () => execResult([setlist]));
        const update = mock.method(Ownership, 'findOneAndUpdate', async () => ({}));
        const setlistIds = [setlistEntry(SETLIST_ID), setlistEntry(NEW_SETLIST_ID)];
        const res = await call(updateOwnership, {
          body: { _id: OWNERSHIP_ID, setlistIds },
          user: USER,
        });
        assert.deepEqual(setlistFind.mock.calls[0]?.arguments, [
          { _id: { $in: [NEW_SETLIST_ID] }, isDeleted: false },
          'createdBy groupIds',
        ]);
        assert.deepEqual(update.mock.calls[0]?.arguments[1], { $set: { setlistIds } });
        assert.equal(res.statusCode, 200);
        mock.restoreAll();
      }
    });

    it('forbids adding a setlist the caller cannot edit, or one that does not exist', async () => {
      for (const found of [[{ _id: NEW_SETLIST_ID, createdBy: OTHER_USER_ID, groupIds: [] }], []]) {
        mock.method(Ownership, 'findOne', () => execResult(stored()));
        mock.method(Setlist, 'find', () => execResult(found));
        const update = mock.method(Ownership, 'findOneAndUpdate', async () => ({}));
        const res = await call(updateOwnership, {
          body: { _id: OWNERSHIP_ID, setlistIds: [setlistEntry(NEW_SETLIST_ID)] },
          user: USER,
        });
        assert.equal(res.statusCode, 403, JSON.stringify(found));
        assert.equal(update.mock.callCount(), 0);
        mock.restoreAll();
      }
    });

    it('returns 404 when the ownership disappears before the write', async () => {
      mock.method(Ownership, 'findOne', () => execResult(stored()));
      mock.method(Ownership, 'findOneAndUpdate', async () => null);
      const res = await call(updateOwnership, {
        body: { _id: OWNERSHIP_ID, setlistIds: [] },
        user: USER,
      });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Ownership not found');
    });
  });

  describe('deleteOwnership', () => {
    it('rejects a request without req.user', async () => {
      const res = await call(deleteOwnership, { body: { userId: USER_ID } });
      assert.equal(res.statusCode, 401);
      assert.equal(res.body, 'Unauthorized');
    });

    it('rejects bodies without a valid userId', async () => {
      const updateOne = mock.method(Ownership, 'updateOne', async () => ({ matchedCount: 1 }));
      for (const body of [
        undefined,
        {},
        { params: null },
        { params: { userId: 'bad' } },
        { params: { userId: 'bad' }, userId: 'bad' },
      ]) {
        const res = await call(deleteOwnership, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(updateOne.mock.callCount(), 0);
    });

    it('forbids deleting the ownership of another user', async () => {
      const updateOne = mock.method(Ownership, 'updateOne', async () => ({ matchedCount: 1 }));
      for (const body of [
        { params: { userId: OTHER_USER_ID } },
        { userId: OTHER_USER_ID },
        { params: { userId: OTHER_USER_ID }, userId: USER_ID },
      ]) {
        const res = await call(deleteOwnership, { body, user: USER });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { error: 'Access denied', message: 'Forbidden' });
      }
      assert.equal(updateOne.mock.callCount(), 0);
    });

    it('soft-deletes the ownership of the caller, falling back to a valid userId', async () => {
      const updateOne = mock.method(Ownership, 'updateOne', async () => ({ matchedCount: 1 }));
      for (const body of [
        { params: { userId: USER_ID } },
        { params: { userId: 'bad' }, userId: USER_ID },
      ]) {
        const res = await call(deleteOwnership, { body, user: USER });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'Ownership successfully deleted');
      }
      for (const callArgs of updateOne.mock.calls) {
        assert.deepEqual(callArgs.arguments, [
          { isDeleted: false, userId: USER_ID },
          { $set: { isDeleted: true } },
        ]);
      }
    });

    it('returns 404 when no live ownership matches', async () => {
      mock.method(Ownership, 'updateOne', async () => ({ matchedCount: 0 }));
      const res = await call(deleteOwnership, { body: { userId: USER_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Ownership not found');
    });
  });
});
