import { RequestHandler, Response } from 'express';
import { Ownership } from '../models/ownership.model';
import { AuthenticatedRequest } from '../policies/permissionMiddleware';
import { pick } from '../utils/pick';
import { sendError, sendResponse } from '../utils/response';
import { isObjectIdString } from '../utils/validation';

const OWNERSHIP_FIELDS = ['setlistIds', 'groupIds'] as const;
const OWNERSHIP_LIST_PROJECTION = 'userId fullName groupIds';

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
    const ownership = await Ownership.findOneAndUpdate(
      { userId: req.user.id },
      {
        $setOnInsert: {
          userId: req.user.id,
          fullName,
          accessType: req.user.accessType,
          setlistIds: [],
          groupIds: [],
        },
      },
      { upsert: true, new: true }
    );
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
      const ownership = await Ownership.findOne({ userId, isDeleted: false }).exec();
      if (ownership) {
        sendResponse(res, 200, ownership);
      } else {
        sendResponse(res, 404, 'Ownership not found');
      }
      return;
    }

    const ownerships = await Ownership.find({ isDeleted: false })
      .select(OWNERSHIP_LIST_PROJECTION)
      .exec();
    sendResponse(res, 200, ownerships);
  } catch (error: unknown) {
    sendError(res, error);
  }
};

const updateOwnership: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const id: unknown = req.body?._id;
  const toUpdate = pick(req.body, OWNERSHIP_FIELDS);

  if (!isObjectIdString(id) || Object.keys(toUpdate).length === 0) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }

  try {
    const ownership = await Ownership.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: toUpdate },
      { new: true, runValidators: true }
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

  const userId: unknown = req.body?.params?.userId ?? req.body?.userId;
  if (!isObjectIdString(userId)) {
    sendResponse(res, 400, 'Missing required fields');
    return;
  }
  if (userId !== req.user.id) {
    sendResponse(res, 403, 'Forbidden');
    return;
  }

  try {
    const result = await Ownership.updateOne(
      { userId, isDeleted: false },
      { $set: { isDeleted: true } }
    );

    if (result.matchedCount > 0) {
      sendResponse(res, 200, 'Ownership successfully deleted');
    } else {
      sendResponse(res, 404, 'Ownership not found');
    }
  } catch (error: unknown) {
    sendError(res, error);
  }
};

export { createOwnership, getOwnership, updateOwnership, deleteOwnership };
