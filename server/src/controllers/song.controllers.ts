import { Request, RequestHandler, Response } from 'express';
import { SONG_FIELDS, songRepository } from '../db/repositories/song.repository';
import { pick } from '../utils/pick';
import { sendError, sendResponse } from '../utils/response';
import { isObjectIdString } from '../utils/validation';

const MAX_SEARCH_LENGTH = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const isSearchString = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_SEARCH_LENGTH;

const toSearchArray = (value: unknown): string[] | null => {
  if (value === undefined || value === '') return [];
  if (isSearchString(value)) return [value];
  if (Array.isArray(value) && value.every(isSearchString)) return value;
  return null;
};

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string') return fallback;
  const parsed = Math.floor(Number(value));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const createSong: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const toCreate = pick(req.body, SONG_FIELDS);

  if (Object.keys(toCreate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const song = await songRepository.create(toCreate);
    sendResponse(res, 200, song);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const getSong: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.query;

  try {
    if (id !== undefined) {
      if (!isObjectIdString(id)) {
        sendResponse(res, 400, 'Invalid song id');
        return;
      }
      const song = await songRepository.findLiveById(id);
      if (song) {
        sendResponse(res, 200, song);
      } else {
        sendResponse(res, 404, 'Song not found');
      }
      return;
    }

    const songs = await songRepository.listLive();
    sendResponse(res, 200, songs);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const searchSongs: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { keyword, code, tempo, themes, sortBy, page, limit } = req.query;

  const tempoArray = toSearchArray(tempo);
  const themesArray = toSearchArray(themes);
  if (
    (keyword !== undefined && !isSearchString(keyword)) ||
    (code !== undefined && !isSearchString(code)) ||
    tempoArray === null ||
    themesArray === null
  ) {
    sendResponse(res, 400, 'Invalid search parameters');
    return;
  }

  const parsedPage = toPositiveInteger(page, DEFAULT_PAGE);
  const parsedLimit = Math.min(MAX_LIMIT, toPositiveInteger(limit, DEFAULT_LIMIT));

  try {
    const { songs, totalCount } = await songRepository.search({
      keyword: isSearchString(keyword) ? keyword : '',
      code: isSearchString(code) ? code : '',
      tempo: tempoArray,
      themes: themesArray,
      sortBy: sortBy === 'code' ? 'code' : 'title',
      offset: (parsedPage - 1) * parsedLimit,
      limit: parsedLimit,
    });
    sendResponse(res, 200, {
      data: songs,
      totalCount,
      currentPage: parsedPage,
      totalPages: Math.ceil(totalCount / parsedLimit),
    });
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const getSongView: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const songs = await songRepository.listLiveView();
    sendResponse(res, 200, songs);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const updateSong: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const id: unknown = req.body?.id;
  const toUpdate = pick(req.body, SONG_FIELDS);

  if (!isObjectIdString(id) || Object.keys(toUpdate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const song = await songRepository.updateLive(id, toUpdate);

    if (song) {
      sendResponse(res, 200, song);
    } else {
      sendResponse(res, 404, 'Song not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const deleteSong: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const id: unknown = [req.body?.params?.id, req.body?.id].find(isObjectIdString);

  if (!isObjectIdString(id)) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    if (await songRepository.softDelete(id)) {
      sendResponse(res, 200, 'Song successfully deleted');
    } else {
      sendResponse(res, 404, 'Song not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

export { createSong, getSong, getSongView, updateSong, deleteSong, searchSongs };
