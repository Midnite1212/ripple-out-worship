import { randomBytes } from 'node:crypto';

const PROCESS_RANDOM = randomBytes(5).toString('hex');
const COUNTER_LIMIT = 0x1000000;
let counter = randomBytes(3).readUIntBE(0, 3);

const toHex = (value: number, length: number): string => value.toString(16).padStart(length, '0');

export const generateObjectId = (now: Date = new Date()): string => {
  counter = (counter + 1) % COUNTER_LIMIT;
  const seconds = Math.floor(now.getTime() / 1000) % 0x100000000;
  return `${toHex(seconds, 8)}${PROCESS_RANDOM}${toHex(counter, 6)}`;
};

export const toObjectId = (id: string): string => id.toLowerCase();
