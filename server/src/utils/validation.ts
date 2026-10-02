const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const isObjectIdString = (value: unknown): value is string =>
  typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
