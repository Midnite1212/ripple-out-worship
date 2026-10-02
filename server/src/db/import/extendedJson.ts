export class ExtendedJsonError extends Error {
  constructor(wrapper: string) {
    super(`Malformed Extended JSON ${wrapper} value`);
    this.name = 'ExtendedJsonError';
  }
}

type Wrapper = (value: unknown) => unknown;

const toNumber = (wrapper: string, value: unknown): number => {
  if (typeof value !== 'string' && typeof value !== 'number') throw new ExtendedJsonError(wrapper);
  const number = Number(value);
  if (Number.isNaN(number) && value !== 'NaN') throw new ExtendedJsonError(wrapper);
  return number;
};

const toDate = (value: unknown): Date => {
  const time =
    typeof value === 'object' && value !== null && '$numberLong' in value
      ? toNumber('$date', value.$numberLong)
      : value;
  if (typeof time !== 'string' && typeof time !== 'number') throw new ExtendedJsonError('$date');
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) throw new ExtendedJsonError('$date');
  return date;
};

const WRAPPERS: Record<string, Wrapper> = {
  $oid: (value) => {
    if (typeof value !== 'string') throw new ExtendedJsonError('$oid');
    return value.toLowerCase();
  },
  $date: toDate,
  $numberInt: (value) => toNumber('$numberInt', value),
  $numberLong: (value) => toNumber('$numberLong', value),
  $numberDouble: (value) => toNumber('$numberDouble', value),
  $numberDecimal: (value) => toNumber('$numberDecimal', value),
};

export const fromExtendedJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(fromExtendedJson);
  if (typeof value !== 'object' || value === null) return value;
  const keys = Object.keys(value);
  if (keys.length === 1 && Object.prototype.hasOwnProperty.call(WRAPPERS, keys[0])) {
    return WRAPPERS[keys[0]](Reflect.get(value, keys[0]));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, fromExtendedJson(entry)])
  );
};
