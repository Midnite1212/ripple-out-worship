import { Request, RequestHandler, Response } from 'express';
import { Group } from '../models/group.model';
import { Ownership } from '../models/ownership.model';
import { Setlist } from '../models/setlist.model';
import { AuthenticatedRequest } from '../policies/permissionMiddleware';
import { GroupDocument } from '../types/group.types';
import { OwnershipEntry } from '../types/ownership.types';
import {
  canDeleteGroup,
  canEditGroup,
  findCallerOwnership,
  sendForbidden,
} from '../utils/authorization';
import { pick } from '../utils/pick';
import { sendError, sendResponse } from '../utils/response';
import { isObjectIdString } from '../utils/validation';

const GROUP_FIELDS = ['groupName', 'setlistIds'] as const;
const GROUP_ACCESS_PROJECTION = 'createdBy groupName createdAt';

const parseUserIds = (value: unknown): string[] | null => {
  if (value === undefined) return [];
  return Array.isArray(value) && value.every(isObjectIdString) ? Array.from(new Set(value)) : null;
};

const toOwnershipEntry = (group: GroupDocument): OwnershipEntry => ({
  id: String(group._id),
  name: group.groupName,
  createdAt: group.createdAt ? new Date(group.createdAt).toISOString() : '',
});

const findLiveGroup = (id: string) =>
  Group.findOne<GroupDocument>({ _id: id, isDeleted: false }, GROUP_ACCESS_PROJECTION).exec();

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
    const group = await Group.create({ ...toCreate, createdBy: req.user.id });
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
      const group = await Group.findOne({ _id: id, isDeleted: false }).exec();
      if (group) {
        sendResponse(res, 200, group);
      } else {
        sendResponse(res, 404, 'Group not found');
      }
      return;
    }

    const groups = await Group.find({ isDeleted: false }).exec();
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
    const existing = await findLiveGroup(id);
    if (!existing) {
      sendResponse(res, 404, 'Group not found');
      return;
    }
    if (!canEditGroup(req.user, existing, await findCallerOwnership(req.user))) {
      sendForbidden(res);
      return;
    }

    const group = await Group.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: toUpdate },
      { new: true, runValidators: true }
    );

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
    const group = await findLiveGroup(groupId);
    if (!group) {
      sendResponse(res, 404, 'Group not found');
      return;
    }
    if (!canEditGroup(req.user, group, await findCallerOwnership(req.user))) {
      sendForbidden(res);
      return;
    }

    const added =
      add.length > 0
        ? await Ownership.updateMany(
            { userId: { $in: add }, isDeleted: false, 'groupIds.id': { $ne: groupId } },
            { $addToSet: { groupIds: toOwnershipEntry(group) } }
          )
        : null;
    const removed =
      remove.length > 0
        ? await Ownership.updateMany(
            { userId: { $in: remove }, isDeleted: false },
            { $pull: { groupIds: { id: groupId } } }
          )
        : null;

    sendResponse(res, 200, {
      groupId,
      added: added?.modifiedCount ?? 0,
      removed: removed?.modifiedCount ?? 0,
    });
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
    const existing = await findLiveGroup(id);
    if (!existing) {
      sendResponse(res, 404, 'Group not found');
      return;
    }
    if (!canDeleteGroup(req.user, existing, await findCallerOwnership(req.user))) {
      sendForbidden(res);
      return;
    }

    const result = await Group.updateOne(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } }
    );

    if (result.matchedCount === 0) {
      sendResponse(res, 404, 'Group not found');
      return;
    }

    await Promise.all([
      Ownership.updateMany({ 'groupIds.id': id }, { $pull: { groupIds: { id } } }),
      Setlist.updateMany({ groupIds: id }, { $pull: { groupIds: id } }),
    ]);
    sendResponse(res, 200, 'Group deleted');
  } catch (error: unknown) {
    sendError(res, error);
  }
};

export { createGroup, getGroup, updateGroup, updateGroupMembers, deleteGroup };
