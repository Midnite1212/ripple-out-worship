import { Types } from 'mongoose';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CallerOwnership,
  canDeleteGroup,
  canDeleteSetlist,
  canEditGroup,
  canEditSetlist,
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

const setlist = (fields: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(SETLIST_ID),
  groupIds: [new Types.ObjectId(GROUP_ID)],
  ...fields,
});
const group = (fields: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(GROUP_ID),
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
      assert.equal(
        canEditSetlist(USER, setlist({ createdBy: new Types.ObjectId(USER.id) }), null),
        true
      );
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
      assert.equal(
        canEditGroup(USER, group({ createdBy: new Types.ObjectId(USER.id) }), null),
        true
      );
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
});
