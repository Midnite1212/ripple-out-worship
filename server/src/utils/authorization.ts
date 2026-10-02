import { Response } from 'express';
import { ownershipRepository } from '../db/repositories/ownership.repository';
import { setlistRepository } from '../db/repositories/setlist.repository';
import { StoredOwnershipEntry } from '../types/ownership.types';
import { sendResponse } from './response';
import { TokenUser } from './verify-jwt';

export type CallerOwnership = {
  groupIds?: readonly StoredOwnershipEntry[] | null;
  setlistIds?: readonly StoredOwnershipEntry[] | null;
} | null;

type OwnedResource = {
  _id: string;
  createdBy?: string | null;
};

type SetlistResource = OwnedResource & {
  groupIds?: readonly string[] | null;
};

const FORBIDDEN_BODY = { message: 'Forbidden', error: 'Access denied' };

export const sendForbidden = (res: Response): void => {
  sendResponse(res, 403, FORBIDDEN_BODY);
};

export const findCallerOwnership = (user: TokenUser): Promise<CallerOwnership> =>
  ownershipRepository.findCallerAccess(user.id);

export const ownedEntryIds = (
  entries: readonly StoredOwnershipEntry[] | null | undefined
): string[] =>
  (entries ?? []).map(({ id }) => id).filter((id): id is string => typeof id === 'string');

export const isAdmin = (user: TokenUser): boolean => user.accessType === 'admin';

const hasCreator = (resource: OwnedResource): boolean =>
  resource.createdBy !== undefined && resource.createdBy !== null;

const isCreator = (user: TokenUser, resource: OwnedResource): boolean =>
  hasCreator(resource) && resource.createdBy === user.id;

const isGroupMember = (group: OwnedResource, ownership: CallerOwnership): boolean =>
  ownedEntryIds(ownership?.groupIds).includes(group._id);

export const canEditSetlist = (
  user: TokenUser,
  setlist: SetlistResource,
  ownership: CallerOwnership
): boolean => {
  if (isAdmin(user) || isCreator(user, setlist)) return true;
  if (ownedEntryIds(ownership?.setlistIds).includes(setlist._id)) return true;
  const memberGroupIds = new Set(ownedEntryIds(ownership?.groupIds));
  return (setlist.groupIds ?? []).some((groupId) => memberGroupIds.has(groupId));
};

export const canEditSetlists = async (
  user: TokenUser,
  setlistIds: readonly string[],
  ownership: CallerOwnership
): Promise<boolean> => {
  const uniqueIds = Array.from(new Set(setlistIds.map((id) => id.toLowerCase())));
  if (uniqueIds.length === 0) return true;
  const setlists = await setlistRepository.findLiveAccessByIds(uniqueIds);
  return (
    setlists.length === uniqueIds.length &&
    setlists.every((setlist) => canEditSetlist(user, setlist, ownership))
  );
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
