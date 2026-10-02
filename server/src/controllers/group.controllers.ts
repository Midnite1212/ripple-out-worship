import { Request, RequestHandler, Response } from 'express';
import { GROUP_FIELDS, groupRepository } from '../db/repositories/group.repository';
import { ownershipRepository } from '../db/repositories/ownership.repository';
import { AuthenticatedRequest } from '../policies/permissionMiddleware';
import { GroupAccess } from '../types/group.types';
import { OwnershipEntry } from '../types/ownership.types';
import {
  canDeleteGroup,
  canEditGroup,
  canEditSetlists,
  findCallerOwnership,
  sendForbidden,
} from '../utils/authorization';
import { pick } from '../utils/pick';
import { sendError, sendResponse } from '../utils/response';
import { isObjectIdString, toObjectIdList } from '../utils/validation';

const parseUserIds = (value: unknown): string[] | null => {
  if (value === undefined) return [];
  return Array.isArray(value) && value.every(isObjectIdString) ? Array.from(new Set(value)) : null;
};

const toOwnershipEntry = (group: GroupAccess): OwnershipEntry => ({
  id: group._id,
  name: group.groupName,
  createdAt: group.createdAt ? new Date(group.createdAt).toISOString() : '',
});

const createGroup: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const toCreate = pick(req.body, GROUP_FIELDS);

  if (Object.keys(toCreate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    if (toCreate.setlistIds !== undefined) {
      const setlistIds = toObjectIdList(toCreate.setlistIds);
      if (!setlistIds) {
        sendResponse(res, 400, 'Invalid request');
        return;
      }
      const ownership = setlistIds.length > 0 ? await findCallerOwnership(req.user) : null;
      if (!(await canEditSetlists(req.user, setlistIds, ownership))) {
        sendForbidden(res);
        return;
      }
    }

    const group = await groupRepository.create({ ...toCreate, createdBy: req.user.id });
    sendResponse(res, 200, group);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const getGroup: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.query;

  try {
    if (id !== undefined) {
      if (!isObjectIdString(id)) {
        sendResponse(res, 400, 'Invalid group id');
        return;
      }
      const group = await groupRepository.findLiveById(id);
      if (group) {
        sendResponse(res, 200, group);
      } else {
        sendResponse(res, 404, 'Group not found');
      }
      return;
    }

    const groups = await groupRepository.listLive();
    if (groups.length > 0) {
      sendResponse(res, 200, groups);
    } else {
      sendResponse(res, 404, 'No groups found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const updateGroup: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const id: unknown = req.body?.id;
  const toUpdate = pick(req.body, GROUP_FIELDS);

  if (!isObjectIdString(id) || Object.keys(toUpdate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const existing = await groupRepository.findLiveById(id);
    if (!existing) {
      sendResponse(res, 404, 'Group not found');
      return;
    }
    const ownership = await findCallerOwnership(req.user);
    if (!canEditGroup(req.user, existing, ownership)) {
      sendForbidden(res);
      return;
    }

    if (toUpdate.setlistIds !== undefined) {
      const setlistIds = toObjectIdList(toUpdate.setlistIds);
      if (!setlistIds) {
        sendResponse(res, 400, 'Invalid request');
        return;
      }
      const added = setlistIds.filter((setlistId) => !existing.setlistIds.includes(setlistId));
      if (!(await canEditSetlists(req.user, added, ownership))) {
        sendForbidden(res);
        return;
      }
    }

    const group = await groupRepository.updateLive(id, toUpdate);

    if (group) {
      sendResponse(res, 200, group);
    } else {
      sendResponse(res, 404, 'Group not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const updateGroupMembers: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendResponse(res, 401, 'Unauthorized');
    return;
  }

  const groupId: unknown = req.body?.groupId;
  const add = parseUserIds(req.body?.add);
  const remove = parseUserIds(req.body?.remove);

  if (!isObjectIdString(groupId) || !add || !remove || add.length + remove.length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const group = await groupRepository.findLiveAccess(groupId);
    if (!group) {
      sendResponse(res, 404, 'Group not found');
      return;
    }
    if (!canEditGroup(req.user, group, await findCallerOwnership(req.user))) {
      sendForbidden(res);
      return;
    }

    const { added, removed } = await ownershipRepository.changeGroupMembership({
      entry: toOwnershipEntry(group),
      add,
      remove,
    });

    sendResponse(res, 200, { groupId, added, removed });
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const deleteGroup: RequestHandler = async (
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
    const existing = await groupRepository.findLiveAccess(id);
    if (!existing) {
      sendResponse(res, 404, 'Group not found');
      return;
    }
    if (!canDeleteGroup(req.user, existing, await findCallerOwnership(req.user))) {
      sendForbidden(res);
      return;
    }

    if (!(await groupRepository.softDeleteCascade(id))) {
      sendResponse(res, 404, 'Group not found');
      return;
    }
    sendResponse(res, 200, 'Group deleted');
  } catch (error: unknown) {
    sendError(res, error);
  }
};

export { createGroup, getGroup, updateGroup, updateGroupMembers, deleteGroup };
