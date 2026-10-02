import { Express } from 'express';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from './createApp';

const listen = (app: Express): Promise<Server> =>
  new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });

describe('createApp', () => {
  const originalMainUrl = process.env.MAIN_URL;
  let server: Server | undefined;

  const request = (path: string, init?: RequestInit) => {
    const { port } = server?.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${port}${path}`, init);
  };

  beforeEach(() => {
    process.env.MAIN_URL = 'https://main.example';
    mock.method(console, 'error', () => undefined);
  });

  afterEach(async () => {
    mock.restoreAll();
    if (originalMainUrl === undefined) delete process.env.MAIN_URL;
    else process.env.MAIN_URL = originalMainUrl;
    const closing = server;
    server = undefined;
    if (closing) await new Promise((resolve) => closing.close(resolve));
  });

  it('answers unknown /api paths with a JSON 404', async () => {
    server = await listen(createApp());

    const res = await request('/api/does-not-exist');

    assert.equal(res.status, 404);
    assert.equal(await res.json(), 'Not found');
  });

  it('answers malformed JSON bodies with a 400', async () => {
    server = await listen(createApp());

    const res = await request('/api/songs/create', {
      body: '{"title":',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    assert.equal(res.status, 400);
    assert.equal(await res.json(), 'Invalid request');
  });

  it('waits for the database before handling /api requests', async () => {
    const ensureDatabase = mock.fn(async () => undefined);
    server = await listen(createApp({ ensureDatabase }));

    const res = await request('/api/setlists/get');

    assert.equal(res.status, 401);
    assert.equal(ensureDatabase.mock.callCount(), 1);
  });

  it('returns a JSON 500 when the database is unavailable', async () => {
    const ensureDatabase = mock.fn(async () => {
      throw new Error('unreachable');
    });
    server = await listen(createApp({ ensureDatabase }));

    const res = await request('/api/setlists/get');

    assert.equal(res.status, 500);
    assert.equal(await res.json(), 'Something went wrong');
  });
});
