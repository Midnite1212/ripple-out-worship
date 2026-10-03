import { ErrorRequestHandler, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

const GENERIC_ERROR = 'Something went wrong';
const INVALID_REQUEST = 'Invalid request';

export const sendResponse = (res: Response, statusCode: number, payload: unknown): void => {
  res.status(statusCode).json(payload);
};

export const sendError = (res: Response, error: unknown): void => {
  if (error instanceof MongooseError.ValidationError || error instanceof MongooseError.CastError) {
    sendResponse(res, 400, INVALID_REQUEST);
    return;
  }
  console.error(error);
  sendResponse(res, 500, GENERIC_ERROR);
};

const getClientErrorStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  const { status } = error;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const clientErrorStatus = getClientErrorStatus(error);
  if (clientErrorStatus !== null) {
    sendResponse(res, clientErrorStatus, INVALID_REQUEST);
    return;
  }
  console.error(error);
  sendResponse(res, 500, GENERIC_ERROR);
};
