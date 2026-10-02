export const pick = <K extends string>(
  source: unknown,
  keys: readonly K[]
): Partial<Record<K, unknown>> => {
  const picked: Partial<Record<K, unknown>> = {};
  if (typeof source !== 'object' || source === null) return picked;

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value: unknown = Reflect.get(source, key);
    if (value !== undefined) picked[key] = value;
  }

  return picked;
};
