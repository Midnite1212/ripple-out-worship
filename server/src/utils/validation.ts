import { isValidObjectId } from 'mongoose';

export const isObjectIdString = (value: unknown): value is string =>
  typeof value === 'string' && isValidObjectId(value);
