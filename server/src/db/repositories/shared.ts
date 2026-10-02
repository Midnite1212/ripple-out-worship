import { Database } from '../connect';

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type Executor = Database | Transaction;

export const presentFields = <K extends string>(
  fields: Record<K, string | null>
): Partial<Record<K, string>> => {
  const present: Partial<Record<K, string>> = {};
  for (const key in fields) {
    const value = fields[key];
    if (value !== null) present[key] = value;
  }
  return present;
};

export const groupBy = <Row, Value>(
  rows: readonly Row[],
  keyOf: (row: Row) => string,
  valueOf: (row: Row) => Value
): Map<string, Value[]> => {
  const grouped = new Map<string, Value[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const values = grouped.get(key) ?? [];
    values.push(valueOf(row));
    grouped.set(key, values);
  }
  return grouped;
};

export const unique = <T>(values: readonly T[]): T[] => Array.from(new Set(values));
