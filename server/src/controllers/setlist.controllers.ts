import { RequestHandler, Response } from 'express';
import { generateObjectId } from '../db/objectId';
import { groupRepository } from '../db/repositories/group.repository';
import {
  SETLIST_FIELDS,
  SetlistReach,
  setlistRepository,
} from '../db/repositories/setlist.repository';
import { MUSIC_KEYS } from '../db/schema';
import { AuthenticatedRequest } from '../policies/permissionMiddleware';
import {
  CallerOwnership,
  canDeleteSetlist,
  canEditGroup,
  canEditSetlist,
  findCallerOwnership,
  isAdmin,
  ownedEntryIds,
  sendForbidden,
} from '../utils/authorization';
import { pick } from '../utils/pick';
import { sendError, sendResponse } from '../utils/response';
import { isObjectIdString, toObjectIdList } from '../utils/validation';
import { TokenUser } from '../utils/verify-jwt';

type SongKeyInput = {
  songId: string;
  key: string;
};

const isMusicKey = (value: unknown): value is string =>
  MUSIC_KEYS.some((musicKey) => musicKey === value);

const parseSongKey = (entry: unknown): SongKeyInput | null => {
  if (typeof entry !== 'object' || entry === null) return null;
  const songId: unknown = Reflect.get(entry, 'songId');
  const key: unknown = Reflect.get(entry, 'key');
  return isObjectIdString(songId) && isMusicKey(key) ? { songId, key } : null;
};

export const parseSongKeys = (value: unknown): SongKeyInput[] | null => {
  if (!Array.isArray(value)) return null;
  const songKeys: SongKeyInput[] = [];
  for (const entry of value) {
    const songKey = parseSongKey(entry);
    if (!songKey) return null;
    songKeys.push(songKey);
  }
  return songKeys;
};

const toSongIdList = (songIds: unknown): string[] | null => {
  if (typeof songIds === 'string') return [songIds];
  return Array.isArray(songIds) ? songIds.map(String) : null;
};

export const keepSetlistSongKeys = (songKeys: SongKeyInput[], songIds: unknown): SongKeyInput[] => {
  const setlistSongIds = new Set(toSongIdList(songIds));
  const keyBySongId = new Map<string, string>();
  for (const { songId, key } of songKeys) {
    if (!setlistSongIds.has(songId)) continue;
    keyBySongId.delete(songId);
    keyBySongId.set(songId, key);
  }
  return Array.from(keyBySongId, ([songId, key]) => ({ songId, key }));
};

const findReach = async (user: TokenUser): Promise<SetlistReach> => {
  if (isAdmin(user)) return { all: true };
  const ownership = await findCallerOwnership(user);
  return {
    setlistIds: ownedEntryIds(ownership?.setlistIds).filter(isObjectIdString),
    groupIds: ownedEntryIds(ownership?.groupIds).filter(isObjectIdString),
    ...(isObjectIdString(user.id) ? { createdBy: user.id } : {}),
  };
};

export const resolveGroupLinks = async (
  user: TokenUser,
  ownership: CallerOwnership,
  requested: string[],
  current: readonly string[]
): Promise<string[] | null> => {
  const added = requested.filter((groupId) => !current.includes(groupId));
  const removed = current.filter((groupId) => !requested.includes(groupId));
  if (added.length + removed.length === 0) return requested;
  const groups = await groupRepository.findLiveAccessByIds([...added, ...removed]);
  const editable = new Set(
    groups.filter((group) => canEditGroup(user, group, ownership)).map(({ _id }) => _id)
  );
  if (!added.every((groupId) => editable.has(groupId))) return null;
  const liveGroupIds = new Set(groups.map(({ _id }) => _id));
  const kept = removed.filter((groupId) => liveGroupIds.has(groupId) && !editable.has(groupId));
  return [...requested, ...kept];
};

const createSetlist: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const toCreate = pick(req.body, SETLIST_FIELDS);
  if (Object.keys(toCreate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  if (toCreate.songKeys !== undefined) {
    const songKeys = parseSongKeys(toCreate.songKeys);
    if (!songKeys || toSongIdList(toCreate.songs) === null) {
      sendResponse(res, 400, 'Invalid song keys');
      return;
    }
    toCreate.songKeys = keepSetlistSongKeys(songKeys, toCreate.songs);
  }

  const _id = generateObjectId();
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  try {
    if (toCreate.groupIds !== undefined) {
      const groupIds = toObjectIdList(toCreate.groupIds);
      if (!groupIds) {
        sendResponse(res, 400, 'Invalid request');
        return;
      }
      const ownership = groupIds.length > 0 ? await findCallerOwnership(req.user) : null;
      const linked = await resolveGroupLinks(req.user, ownership, groupIds, []);
      if (!linked) {
        sendForbidden(res);
        return;
      }
      toCreate.groupIds = linked;
    }

    const setlist = await setlistRepository.create({
      ...toCreate,
      _id,
      createdBy: req.user.id,
      publicLink: `${baseUrl}/setlist/view/${_id}`,
    });
    sendResponse(res, 200, setlist);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const getSetlist: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.query;
  const view = req.user ? 'full' : 'public';

  try {
    if (Array.isArray(id)) {
      if (!id.every(isObjectIdString)) {
        sendResponse(res, 400, 'Invalid setlist id');
        return;
      }
      const setlists = await setlistRepository.findLiveByIds(id, view);
      if (setlists.length > 0) {
        sendResponse(res, 200, setlists);
      } else {
        sendResponse(res, 404, 'No setlists found with the provided IDs');
      }
      return;
    }

    if (id !== undefined) {
      if (!isObjectIdString(id)) {
        sendResponse(res, 400, 'Invalid setlist id');
        return;
      }
      const setlist = await setlistRepository.findLiveById(id, view);
      if (setlist) {
        sendResponse(res, 200, setlist);
      } else {
        sendResponse(res, 404, 'Setlist not found');
      }
      return;
    }

    if (!req.user) {
      sendResponse(res, 401, 'Unauthorized');
      return;
    }
    const setlists = await setlistRepository.listLiveReachable(await findReach(req.user));
    sendResponse(res, 200, setlists);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const updateSetlist: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const id: unknown = req.body?.id;
  const toUpdate = pick(req.body, SETLIST_FIELDS);

  if (!isObjectIdString(id) || Object.keys(toUpdate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  const songKeys = toUpdate.songKeys === undefined ? undefined : parseSongKeys(toUpdate.songKeys);
  if (songKeys === null) {
    sendResponse(res, 400, 'Invalid song keys');
    return;
  }

  try {
    const existing = await setlistRepository.findLiveAccess(id);
    if (!existing) {
      sendResponse(res, 404, 'Setlist not found');
      return;
    }
    const ownership = await findCallerOwnership(req.user);
    if (!canEditSetlist(req.user, existing, ownership)) {
      sendForbidden(res);
      return;
    }

    if (songKeys) {
      toUpdate.songKeys = keepSetlistSongKeys(songKeys, toUpdate.songs ?? existing.songs);
    }

    if (toUpdate.groupIds !== undefined) {
      const groupIds = toObjectIdList(toUpdate.groupIds);
      if (!groupIds) {
        sendResponse(res, 400, 'Invalid request');
        return;
      }
      const linked = await resolveGroupLinks(req.user, ownership, groupIds, existing.groupIds);
      if (!linked) {
        sendForbidden(res);
        return;
      }
      toUpdate.groupIds = linked;
    }

    const setlist = await setlistRepository.updateLive(id, toUpdate);

    if (setlist) {
      sendResponse(res, 200, setlist);
    } else {
      sendResponse(res, 404, 'Setlist not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const deleteSetlist: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const id: unknown = [req.body?.params?.id, req.body?.id].find(isObjectIdString);

  if (!isObjectIdString(id)) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const existing = await setlistRepository.findLiveAccess(id);
    if (!existing) {
      sendResponse(res, 404, 'Setlist not found');
      return;
    }
    if (!canDeleteSetlist(req.user, existing)) {
      sendForbidden(res);
      return;
    }

    if (await setlistRepository.softDelete(id)) {
      sendResponse(res, 200, 'Setlist deleted');
    } else {
      sendResponse(res, 404, 'Setlist not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

export { createSetlist, getSetlist, updateSetlist, deleteSetlist };
