import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { ownershipRepository } from '../db/repositories/ownership.repository';
import { setlistRepository } from '../db/repositories/setlist.repository';
import { FakeRequestInit, callHandler, createRequest, createResponse } from '../testing/http';
import { OwnershipRecord } from '../types/ownership.types';
import { SetlistAccess } from '../types/setlist.types';
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
const STORED_AT = new Date('2026-01-01T00:00:00.000Z');

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
      const create = mock.method(ownershipRepository, 'createIfMissing', async () => ({}));
      const res = await call(createOwnership, { body: { fullName: 'Name' } });
      assert.equal(res.statusCode, 401);
      assert.equal(res.body, 'Unauthorized');
      assert.equal(create.mock.callCount(), 0);
    });

    it('rejects a missing, blank, or non-string fullName', async () => {
      const create = mock.method(ownershipRepository, 'createIfMissing', async () => ({}));
      for (const body of [undefined, {}, { fullName: '' }, { fullName: '   ' }, { fullName: 1 }]) {
        const res = await call(createOwnership, { body, user: USER });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body, 'Missing required fields');
      }
      assert.equal(create.mock.callCount(), 0);
    });

    it('creates on the caller id with identity from req.user, not the body', async () => {
      const ownership = { _id: OWNERSHIP_ID, userId: USER_ID };
      const create = mock.method(ownershipRepository, 'createIfMissing', async () => ownership);
      const res = await call(createOwnership, {
        body: { accessType: 'admin', fullName: 'Name', setlistIds: ['x'], userId: OTHER_USER_ID },
        user: USER,
      });
      assert.deepEqual(create.mock.calls[0]?.arguments, [
        { accessType: 'ministry', fullName: 'Name', userId: USER_ID },
      ]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, ownership);
    });
  });

  describe('getOwnership', () => {
    it('rejects an invalid userId before querying', async () => {
      const find = mock.method(ownershipRepository, 'findLiveByUserId', async () => null);
      for (const userId of ['bad', '', [USER_ID], { $ne: null }]) {
        const res = await call(getOwnership, { query: { userId }, user: USER });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body, 'Invalid user id');
      }
      assert.equal(find.mock.callCount(), 0);
    });

    it('returns 404 when the ownership is missing', async () => {
      const find = mock.method(ownershipRepository, 'findLiveByUserId', async () => null);
      const res = await call(getOwnership, { query: { userId: OTHER_USER_ID }, user: USER });
      assert.deepEqual(find.mock.calls[0]?.arguments, [OTHER_USER_ID]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Ownership not found');
    });

    it('returns the ownership of any user by userId', async () => {
      const ownership = { userId: OTHER_USER_ID };
      mock.method(ownershipRepository, 'findLiveByUserId', async () => ownership);
      const res = await call(getOwnership, { query: { userId: OTHER_USER_ID }, user: USER });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, ownership);
    });

    it('lists every live ownership as summaries, even when empty', async () => {
      const list = mock.method(ownershipRepository, 'listLiveSummaries', async () => []);
      const res = await call(getOwnership, { user: USER });
      assert.equal(list.mock.callCount(), 1);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, []);
    });
  });

  describe('updateOwnership', () => {
    const SETLIST_ID = '507f1f77bcf86cd799439021';
    const NEW_SETLIST_ID = '507f1f77bcf86cd799439022';
    const GROUP_ID = '507f1f77bcf86cd799439031';
    const setlistEntry = (id: string) => ({ createdAt: '2026-01-01', id, name: 'Sunday' });
    const stored = (fields: Partial<OwnershipRecord> = {}): OwnershipRecord => ({
      _id: OWNERSHIP_ID,
      accessType: 'ministry',
      createdAt: STORED_AT,
      fullName: 'Name',
      groupIds: [],
      isDeleted: false,
      setlistIds: [setlistEntry(SETLIST_ID)],
      updatedAt: STORED_AT,
      userId: USER_ID,
      ...fields,
    });
    const mockStored = (ownership: OwnershipRecord | null) =>
      mock.method(ownershipRepository, 'findLiveById', async () => ownership);
    const mockSetlists = (setlists: SetlistAccess[]) =>
      mock.method(setlistRepository, 'findLiveAccessByIds', async () => setlists);

    it('rejects a request without req.user', async () => {
      const res = await call(updateOwnership, { body: { _id: OWNERSHIP_ID, setlistIds: [] } });
      assert.equal(res.statusCode, 401);
    });

    it('rejects a missing or invalid _id, or no allowed fields, including groupIds alone', async () => {
      const find = mockStored(null);
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
      assert.equal(find.mock.callCount(), 0);
    });

    it('rejects setlistIds that are not a list of entries with valid ids', async () => {
      const find = mockStored(null);
      for (const setlistIds of [null, 'x', [null], [{ id: 'bad' }], [{ name: 'Sunday' }]]) {
        const res = await call(updateOwnership, {
          body: { _id: OWNERSHIP_ID, setlistIds },
          user: USER,
        });
        assert.equal(res.statusCode, 400, JSON.stringify(setlistIds));
        assert.equal(res.body, 'Invalid setlist ids');
      }
      assert.equal(find.mock.callCount(), 0);
    });

    it('returns 404 when no live ownership matches', async () => {
      const find = mockStored(null);
      const res = await call(updateOwnership, {
        body: { _id: OWNERSHIP_ID, setlistIds: [] },
        user: USER,
      });
      assert.deepEqual(find.mock.calls[0]?.arguments, [OWNERSHIP_ID]);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Ownership not found');
    });

    it('forbids updating the ownership of another user, even for an admin', async () => {
      mockStored(stored({ userId: OTHER_USER_ID }));
      const replace = mock.method(ownershipRepository, 'replaceSetlistEntries', async () => null);
      for (const user of [USER, { accessType: 'admin', id: '507f1f77bcf86cd799439019' }]) {
        const res = await call(updateOwnership, {
          body: { _id: OWNERSHIP_ID, setlistIds: [] },
          user,
        });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { error: 'Access denied', message: 'Forbidden' });
      }
      assert.equal(replace.mock.callCount(), 0);
    });

    it('updates only setlistIds on the caller record, ignoring groupIds', async () => {
      mockStored(stored());
      const setlistFind = mockSetlists([]);
      const ownership = stored({ setlistIds: [] });
      const replace = mock.method(
        ownershipRepository,
        'replaceSetlistEntries',
        async () => ownership
      );
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
      assert.deepEqual(replace.mock.calls[0]?.arguments, [OWNERSHIP_ID, USER_ID, []]);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, ownership);
    });

    it('allows adding a setlist the caller created or reaches through a folder', async () => {
      for (const setlist of [
        { _id: NEW_SETLIST_ID, createdBy: USER_ID, groupIds: [], songs: [] },
        { _id: NEW_SETLIST_ID, createdBy: OTHER_USER_ID, groupIds: [GROUP_ID], songs: [] },
      ]) {
        mockStored(stored({ groupIds: [{ createdAt: '', id: GROUP_ID, name: 'Team' }] }));
        const setlistFind = mockSetlists([setlist]);
        const replace = mock.method(ownershipRepository, 'replaceSetlistEntries', async () =>
          stored()
        );
        const setlistIds = [setlistEntry(SETLIST_ID), setlistEntry(NEW_SETLIST_ID)];
        const res = await call(updateOwnership, {
          body: { _id: OWNERSHIP_ID, setlistIds },
          user: USER,
        });
        assert.deepEqual(setlistFind.mock.calls[0]?.arguments, [[NEW_SETLIST_ID]]);
        assert.deepEqual(replace.mock.calls[0]?.arguments[2], setlistIds);
        assert.equal(res.statusCode, 200);
        mock.restoreAll();
      }
    });

    it('forbids adding a setlist the caller cannot edit, or one that does not exist', async () => {
      for (const found of [
        [{ _id: NEW_SETLIST_ID, createdBy: OTHER_USER_ID, groupIds: [], songs: [] }],
        [],
      ]) {
        mockStored(stored());
        mockSetlists(found);
        const replace = mock.method(ownershipRepository, 'replaceSetlistEntries', async () => null);
        const res = await call(updateOwnership, {
          body: { _id: OWNERSHIP_ID, setlistIds: [setlistEntry(NEW_SETLIST_ID)] },
          user: USER,
        });
        assert.equal(res.statusCode, 403, JSON.stringify(found));
        assert.equal(replace.mock.callCount(), 0);
        mock.restoreAll();
      }
    });

    it('returns 404 when the ownership disappears before the write', async () => {
      mockStored(stored());
      mock.method(ownershipRepository, 'replaceSetlistEntries', async () => null);
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
      const softDelete = mock.method(ownershipRepository, 'softDeleteByUserId', async () => true);
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
      assert.equal(softDelete.mock.callCount(), 0);
    });

    it('forbids deleting the ownership of another user', async () => {
      const softDelete = mock.method(ownershipRepository, 'softDeleteByUserId', async () => true);
      for (const body of [
        { params: { userId: OTHER_USER_ID } },
        { userId: OTHER_USER_ID },
        { params: { userId: OTHER_USER_ID }, userId: USER_ID },
      ]) {
        const res = await call(deleteOwnership, { body, user: USER });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { error: 'Access denied', message: 'Forbidden' });
      }
      assert.equal(softDelete.mock.callCount(), 0);
    });

    it('soft-deletes the ownership of the caller, falling back to a valid userId', async () => {
      const softDelete = mock.method(ownershipRepository, 'softDeleteByUserId', async () => true);
      for (const body of [
        { params: { userId: USER_ID } },
        { params: { userId: 'bad' }, userId: USER_ID },
      ]) {
        const res = await call(deleteOwnership, { body, user: USER });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'Ownership successfully deleted');
      }
      for (const callArgs of softDelete.mock.calls) {
        assert.deepEqual(callArgs.arguments, [USER_ID]);
      }
    });

    it('returns 404 when no live ownership matches', async () => {
      mock.method(ownershipRepository, 'softDeleteByUserId', async () => false);
      const res = await call(deleteOwnership, { body: { userId: USER_ID }, user: USER });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Ownership not found');
    });
  });
});
