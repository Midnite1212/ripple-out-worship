import { Response } from 'express';
import { Ownership } from '../models/ownership.model';
import { OwnershipEntry } from '../types/ownership.types';
import { sendResponse } from './response';
import { TokenUser } from './verify-jwt';

export type CallerOwnership = {
  groupIds?: readonly OwnershipEntry[] | null;
  setlistIds?: readonly OwnershipEntry[] | null;
} | null;

type OwnedResource = {
  _id: unknown;
  createdBy?: unknown;
};

type SetlistResource = OwnedResource & {
  groupIds?: readonly unknown[] | null;
};

const FORBIDDEN_BODY = { message: 'Forbidden', error: 'Access denied' };

export const sendForbidden = (res: Response): void => {
  sendResponse(res, 403, FORBIDDEN_BODY);
};

export const findCallerOwnership = (user: TokenUser): Promise<CallerOwnership> =>
  Ownership.findOne({ userId: user.id, isDeleted: false }, 'groupIds setlistIds').exec();

export const ownedEntryIds = (entries: readonly OwnershipEntry[] | null | undefined): string[] =>
  (entries ?? []).map(({ id }) => id).filter((id): id is string => typeof id === 'string');

export const isAdmin = (user: TokenUser): boolean => user.accessType === 'admin';

const hasCreator = (resource: OwnedResource): boolean =>
  resource.createdBy !== undefined && resource.createdBy !== null;

const isCreator = (user: TokenUser, resource: OwnedResource): boolean =>
  hasCreator(resource) && String(resource.createdBy) === user.id;

const isGroupMember = (group: OwnedResource, ownership: CallerOwnership): boolean =>
  ownedEntryIds(ownership?.groupIds).includes(String(group._id));

export const canEditSetlist = (
  user: TokenUser,
  setlist: SetlistResource,
  ownership: CallerOwnership
): boolean => {
  if (isAdmin(user) || isCreator(user, setlist)) return true;
  if (ownedEntryIds(ownership?.setlistIds).includes(String(setlist._id))) return true;
  const memberGroupIds = new Set(ownedEntryIds(ownership?.groupIds));
  return (setlist.groupIds ?? []).some((groupId) => memberGroupIds.has(String(groupId)));
};

export const canDeleteSetlist = (user: TokenUser, setlist: OwnedResource): boolean =>
  isAdmin(user) || isCreator(user, setlist);

export const canEditGroup = (
  user: TokenUser,
  group: OwnedResource,
  ownership: CallerOwnership
): boolean => isAdmin(user) || isCreator(user, group) || isGroupMember(group, ownership);

export const canDeleteGroup = (
  user: TokenUser,
  group: OwnedResource,
  ownership: CallerOwnership
): boolean => {
  if (isAdmin(user)) return true;
  return hasCreator(group) ? isCreator(user, group) : isGroupMember(group, ownership);
};
