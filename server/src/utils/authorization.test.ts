import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { setlistRepository } from '../db/repositories/setlist.repository';
import {
  CallerOwnership,
  canDeleteGroup,
  canDeleteSetlist,
  canEditGroup,
  canEditSetlist,
  canEditSetlists,
  ownedEntryIds,
} from './authorization';
import { TokenUser } from './verify-jwt';

const USER: TokenUser = { accessType: 'ministry', id: '507f1f77bcf86cd799439011' };
const ADMIN: TokenUser = { accessType: 'admin', id: '507f1f77bcf86cd799439019' };
const OTHER_USER_ID = '507f1f77bcf86cd799439012';
const SETLIST_ID = '507f1f77bcf86cd799439021';
const GROUP_ID = '507f1f77bcf86cd799439031';
const OTHER_GROUP_ID = '507f1f77bcf86cd799439032';

const entry = (id: string) => ({ createdAt: '2026-01-01T00:00:00.000Z', id, name: 'Entry' });
const member = (...groupIds: string[]): CallerOwnership => ({
  groupIds: groupIds.map(entry),
  setlistIds: [],
});
const owner = (...setlistIds: string[]): CallerOwnership => ({
  groupIds: [],
  setlistIds: setlistIds.map(entry),
});

const setlist = (fields: { createdBy?: string | null; groupIds?: string[] } = {}) => ({
  _id: SETLIST_ID,
  groupIds: [GROUP_ID],
  ...fields,
});
const group = (fields: { createdBy?: string | null } = {}) => ({
  _id: GROUP_ID,
  ...fields,
});

describe('authorization', () => {
  describe('ownedEntryIds', () => {
    it('returns the string ids of an entry list and tolerates a missing list', () => {
      assert.deepEqual(ownedEntryIds([entry(GROUP_ID), entry(OTHER_GROUP_ID)]), [
        GROUP_ID,
        OTHER_GROUP_ID,
      ]);
      assert.deepEqual(ownedEntryIds(undefined), []);
      assert.deepEqual(ownedEntryIds(null), []);
    });
  });

  describe('canEditSetlist', () => {
    it('allows an admin, the creator, an owner, and a member of a containing folder', () => {
      assert.equal(canEditSetlist(ADMIN, setlist({ createdBy: OTHER_USER_ID }), null), true);
      assert.equal(canEditSetlist(USER, setlist({ createdBy: USER.id }), null), true);
      assert.equal(
        canEditSetlist(USER, setlist({ createdBy: OTHER_USER_ID }), owner(SETLIST_ID)),
        true
      );
      assert.equal(
        canEditSetlist(USER, setlist({ createdBy: OTHER_USER_ID }), member(GROUP_ID)),
        true
      );
    });

    it('denies a non-member, and a non-admin on a legacy setlist with no shared access', () => {
      assert.equal(
        canEditSetlist(USER, setlist({ createdBy: OTHER_USER_ID }), member(OTHER_GROUP_ID)),
        false
      );
      assert.equal(canEditSetlist(USER, setlist({ groupIds: [] }), null), false);
      assert.equal(canEditSetlist(USER, setlist({ groupIds: undefined }), owner()), false);
    });
  });

  describe('canDeleteSetlist', () => {
    it('allows only an admin or the creator', () => {
      assert.equal(canDeleteSetlist(ADMIN, setlist()), true);
      assert.equal(canDeleteSetlist(USER, setlist({ createdBy: USER.id })), true);
      assert.equal(canDeleteSetlist(USER, setlist({ createdBy: OTHER_USER_ID })), false);
      assert.equal(canDeleteSetlist(USER, setlist({ createdBy: null })), false);
      assert.equal(canDeleteSetlist(USER, setlist()), false);
    });
  });

  describe('canEditGroup', () => {
    it('allows an admin, the creator, or a member', () => {
      assert.equal(canEditGroup(ADMIN, group({ createdBy: OTHER_USER_ID }), null), true);
      assert.equal(canEditGroup(USER, group({ createdBy: USER.id }), null), true);
      assert.equal(canEditGroup(USER, group({ createdBy: OTHER_USER_ID }), member(GROUP_ID)), true);
      assert.equal(canEditGroup(USER, group(), member(GROUP_ID)), true);
    });

    it('denies a non-member who did not create the group', () => {
      assert.equal(
        canEditGroup(USER, group({ createdBy: OTHER_USER_ID }), member(OTHER_GROUP_ID)),
        false
      );
      assert.equal(canEditGroup(USER, group(), null), false);
    });
  });

  describe('canDeleteGroup', () => {
    it('allows an admin or the creator, but not other members', () => {
      assert.equal(canDeleteGroup(ADMIN, group({ createdBy: OTHER_USER_ID }), null), true);
      assert.equal(canDeleteGroup(USER, group({ createdBy: USER.id }), null), true);
      assert.equal(
        canDeleteGroup(USER, group({ createdBy: OTHER_USER_ID }), member(GROUP_ID)),
        false
      );
    });

    it('lets any member delete a legacy group without createdBy', () => {
      assert.equal(canDeleteGroup(USER, group(), member(GROUP_ID)), true);
      assert.equal(canDeleteGroup(USER, group({ createdBy: null }), member(GROUP_ID)), true);
      assert.equal(canDeleteGroup(USER, group(), member(OTHER_GROUP_ID)), false);
      assert.equal(canDeleteGroup(USER, group(), null), false);
    });
  });

  describe('canEditSetlists', () => {
    afterEach(() => {
      mock.restoreAll();
    });

    it('skips the lookup for an empty list', async () => {
      const lookup = mock.method(setlistRepository, 'findLiveAccessByIds', async () => []);
      assert.equal(await canEditSetlists(USER, [], null), true);
      assert.equal(lookup.mock.callCount(), 0);
    });

    it('requires every distinct setlist to exist and be editable', async () => {
      const editable = { _id: SETLIST_ID, createdBy: USER.id, groupIds: [], songs: [] };
      const lookup = mock.method(setlistRepository, 'findLiveAccessByIds', async () => [editable]);
      assert.equal(await canEditSetlists(USER, [SETLIST_ID, SETLIST_ID.toUpperCase()], null), true);
      assert.deepEqual(lookup.mock.calls[0]?.arguments, [[SETLIST_ID]]);
      assert.equal(await canEditSetlists(USER, [SETLIST_ID, OTHER_GROUP_ID], null), false);
      lookup.mock.mockImplementation(async () => [{ ...editable, createdBy: OTHER_USER_ID }]);
      assert.equal(await canEditSetlists(USER, [SETLIST_ID], null), false);
      assert.equal(await canEditSetlists(USER, [SETLIST_ID], owner(SETLIST_ID)), true);
    });
  });
});
