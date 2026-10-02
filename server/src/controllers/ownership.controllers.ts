import { RequestHandler, Response } from 'express';
import { ownershipRepository } from '../db/repositories/ownership.repository';
import { AuthenticatedRequest } from '../policies/permissionMiddleware';
import { canEditSetlists, ownedEntryIds, sendForbidden } from '../utils/authorization';
import { pick } from '../utils/pick';
import { sendError, sendResponse } from '../utils/response';
import { isObjectIdString } from '../utils/validation';

const OWNERSHIP_FIELDS = ['setlistIds'] as const;

const parseEntryIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const ids: unknown[] = value.map((entry: unknown) =>
    typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'id') : undefined
  );
  return ids.every(isObjectIdString) ? ids : null;
};

const createOwnership: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const fullName: unknown = req.body?.fullName;
  if (typeof fullName !== 'string' || fullName.trim() === '') {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const ownership = await ownershipRepository.createIfMissing({
      userId: req.user.id,
      fullName,
      accessType: req.user.accessType,
    });
    sendResponse(res, 200, ownership);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const getOwnership: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { userId } = req.query;

  try {
    if (userId !== undefined) {
      if (!isObjectIdString(userId)) {
        sendResponse(res, 400, 'Invalid user id');
        return;
      }
      const ownership = await ownershipRepository.findLiveByUserId(userId);
      if (ownership) {
        sendResponse(res, 200, ownership);
      } else {
        sendResponse(res, 404, 'Ownership not found');
      }
      return;
    }

    const ownerships = await ownershipRepository.listLiveSummaries();
    sendResponse(res, 200, ownerships);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const updateOwnership: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const id: unknown = req.body?._id;
  const toUpdate = pick(req.body, OWNERSHIP_FIELDS);

  if (!isObjectIdString(id) || Object.keys(toUpdate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  const setlistIds = parseEntryIds(toUpdate.setlistIds);
  if (!setlistIds) {
    sendResponse(res, 400, 'Invalid setlist ids');
    return;
  }

  try {
    const existing = await ownershipRepository.findLiveById(id);
    if (!existing) {
      sendResponse(res, 404, 'Ownership not found');
      return;
    }
    if (existing.userId !== req.user.id) {
      sendForbidden(res);
      return;
    }

    const storedSetlistIds = new Set(ownedEntryIds(existing.setlistIds));
    const addedSetlistIds = setlistIds.filter((setlistId) => !storedSetlistIds.has(setlistId));
    if (
      addedSetlistIds.length > 0 &&
      !(await canEditSetlists(req.user, addedSetlistIds, existing))
    ) {
      sendForbidden(res);
      return;
    }

    const ownership = await ownershipRepository.replaceSetlistEntries(
      id,
      req.user.id,
      toUpdate.setlistIds
    );

    if (ownership) {
      sendResponse(res, 200, ownership);
    } else {
      sendResponse(res, 404, 'Ownership not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const deleteOwnership: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const userId: unknown = [req.body?.params?.userId, req.body?.userId].find(isObjectIdString);
  if (!isObjectIdString(userId)) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }
  if (userId !== req.user.id) {
    sendForbidden(res);
    return;
  }

  try {
    if (await ownershipRepository.softDeleteByUserId(userId)) {
      sendResponse(res, 200, 'Ownership successfully deleted');
    } else {
      sendResponse(res, 404, 'Ownership not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

export { createOwnership, getOwnership, updateOwnership, deleteOwnership };
