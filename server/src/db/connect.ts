import { connectToDB } from '../mongoose';

export const createEnsureDatabase = (connect: () => Promise<void>): (() => Promise<void>) => {
  let connection: Promise<void> | undefined;

  return () => {
    connection ??= connect().catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
    return connection;
  };
};

export const ensureDatabase: () => Promise<void> = createEnsureDatabase(connectToDB);
