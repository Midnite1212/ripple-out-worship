import { Request, RequestHandler, Response } from 'express';
import { Group } from '../models/group.model';
import { pick } from '../utils/pick';
import { sendError, sendResponse } from '../utils/response';
import { isObjectIdString } from '../utils/validation';

const GROUP_FIELDS = ['groupName', 'setlistIds'] as const;

const createGroup: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const toCreate = pick(req.body, GROUP_FIELDS);

  if (Object.keys(toCreate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const group = await Group.create(toCreate);
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

const updateGroup: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const id: unknown = req.body?.id;
  const toUpdate = pick(req.body, GROUP_FIELDS);

  if (!isObjectIdString(id) || Object.keys(toUpdate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
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

const deleteGroup: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const id: unknown = req.body?.params?.id ?? req.body?.id;

  if (!isObjectIdString(id)) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const result = await Group.updateOne(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } }
    );

    if (result.matchedCount > 0) {
      sendResponse(res, 200, 'Group deleted');
    } else {
      sendResponse(res, 404, 'Group not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

export { createGroup, getGroup, updateGroup, deleteGroup };
