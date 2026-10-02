import { DrizzleQueryError } from 'drizzle-orm';
import { ErrorRequestHandler, Response } from 'express';
import { InvalidInputError } from '../db/cast';

const GENERIC_ERROR = 'Something went wrong';
const INVALID_REQUEST = 'Invalid request';
const INVALID_INPUT_SQLSTATES = new Set([
  '22001',
  '22003',
  '22007',
  '22008',
  '22P02',
  '23502',
  '23503',
  '23514',
]);

export const sendResponse = (res: Response, statusCode: number, payload: unknown): void => {
  res.status(statusCode).json(payload);
};

const unwrapQueryError = (error: unknown): unknown =>
  error instanceof DrizzleQueryError ? error.cause ?? new Error('Database query failed') : error;

const isInvalidInput = (error: unknown): boolean => {
  if (error instanceof InvalidInputError) return true;
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const { code } = error;
  return typeof code === 'string' && INVALID_INPUT_SQLSTATES.has(code);
};

export const sendError = (res: Response, error: unknown): void => {
  const cause = unwrapQueryError(error);
  if (isInvalidInput(cause)) {
    sendResponse(res, 400, INVALID_REQUEST);
    return;
  }
  console.error(cause);
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
  console.error(unwrapQueryError(error));
  sendResponse(res, 500, GENERIC_ERROR);
};
