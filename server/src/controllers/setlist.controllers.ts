import { RequestHandler, Response } from 'express';
import { Types } from 'mongoose';
import { MUSIC_KEYS, Setlist } from '../models/setlist.model';
import { AuthenticatedRequest } from '../policies/permissionMiddleware';
import { pick } from '../utils/pick';
import { sendError, sendResponse } from '../utils/response';
import { isObjectIdString } from '../utils/validation';

const SETLIST_FIELDS = ['name', 'date', 'songs', 'songKeys', 'groupIds'] as const;
const PUBLIC_SETLIST_PROJECTION = '-createdBy -lastUpdatedBy -groupIds';
const PUBLIC_SONG_PROJECTION = '-createdBy -lastUpdatedBy';

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

export const keepSetlistSongKeys = (songKeys: SongKeyInput[], songIds: unknown): SongKeyInput[] => {
  const setlistSongIds = new Set(Array.isArray(songIds) ? songIds.map(String) : []);
  const keyBySongId = new Map<string, string>();
  for (const { songId, key } of songKeys) {
    if (setlistSongIds.has(songId)) keyBySongId.set(songId, key);
  }
  return Array.from(keyBySongId, ([songId, key]) => ({ songId, key }));
};

const getReadOptions = (isAnonymous: boolean) =>
  isAnonymous
    ? {
        projection: PUBLIC_SETLIST_PROJECTION,
        populate: { path: 'songs', select: PUBLIC_SONG_PROJECTION },
      }
    : { projection: {}, populate: { path: 'songs' } };

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
    if (!songKeys) {
      sendResponse(res, 400, 'Invalid song keys');
      return;
    }
    toCreate.songKeys = keepSetlistSongKeys(songKeys, toCreate.songs);
  }

  const _id = new Types.ObjectId();
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  try {
    const setlist = await Setlist.create({
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
  const isAnonymous = !req.user;
  const { projection, populate } = getReadOptions(isAnonymous);

  try {
    if (Array.isArray(id)) {
      if (!id.every(isObjectIdString)) {
        sendResponse(res, 400, 'Invalid setlist id');
        return;
      }
      const setlists = await Setlist.find({ _id: { $in: id }, isDeleted: false }, projection)
        .populate(populate)
        .exec();
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
      const setlist = await Setlist.findOne({ _id: id, isDeleted: false }, projection)
        .populate(populate)
        .exec();
      if (setlist) {
        sendResponse(res, 200, setlist);
      } else {
        sendResponse(res, 404, 'Setlist not found');
      }
      return;
    }

    if (isAnonymous) {
      sendResponse(res, 401, 'Unauthorized');
      return;
    }
    const setlists = await Setlist.find({ isDeleted: false }).populate('songs').exec();
    sendResponse(res, 200, setlists);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const updateSetlist: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
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
    if (songKeys) {
      let songIds: unknown = toUpdate.songs;
      if (songIds === undefined) {
        const existing = await Setlist.findOne({ _id: id, isDeleted: false }, 'songs').exec();
        if (!existing) {
          sendResponse(res, 404, 'Setlist not found');
          return;
        }
        songIds = existing.songs;
      }
      toUpdate.songKeys = keepSetlistSongKeys(songKeys, songIds);
    }

    const setlist = await Setlist.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: toUpdate },
      { new: true, runValidators: true }
    );

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
  const id: unknown = req.body?.params?.id ?? req.body?.id;

  if (!isObjectIdString(id)) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const result = await Setlist.updateOne(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } }
    );

    if (result.matchedCount > 0) {
      sendResponse(res, 200, 'Setlist deleted');
    } else {
      sendResponse(res, 404, 'Setlist not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

export { createSetlist, getSetlist, updateSetlist, deleteSetlist };
