import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createEnsureDatabase } from './connect';

describe('createEnsureDatabase', () => {
  it('connects once and shares the connection between concurrent callers', async () => {
    const connect = mock.fn(async () => undefined);
    const ensureDatabase = createEnsureDatabase(connect);

    await Promise.all([ensureDatabase(), ensureDatabase(), ensureDatabase()]);
    await ensureDatabase();

    assert.equal(connect.mock.callCount(), 1);
  });

  it('retries on the next call after a failed connect', async () => {
    const failure = new Error('unreachable');
    const connect = mock.fn(async () => undefined);
    connect.mock.mockImplementationOnce(async () => {
      throw failure;
    });
    const ensureDatabase = createEnsureDatabase(connect);

    await assert.rejects(ensureDatabase(), failure);
    await ensureDatabase();

    assert.equal(connect.mock.callCount(), 2);
  });
});
