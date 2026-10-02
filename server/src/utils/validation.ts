const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const isObjectIdString = (value: unknown): value is string =>
  typeof value === 'string' && OBJECT_ID_PATTERN.test(value);

export const toObjectIdList = (value: unknown): string[] | null => {
  if (value === undefined || value === null) return [];
  const items: unknown[] = Array.isArray(value) ? value : [value];
  if (!items.every(isObjectIdString)) return null;
  return Array.from(new Set(items.map((id) => id.toLowerCase())));
};
