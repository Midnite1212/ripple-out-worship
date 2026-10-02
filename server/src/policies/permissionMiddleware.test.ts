import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import { callHandler, createRequest, createResponse } from '../testing/http';
import { createPermissionMiddleware } from './permissionMiddleware';
import { ROUTE_PERMISSIONS } from './permissions.config';

const SECRET = 'test-secret';
const USER_ID = '507f1f77bcf86cd799439011';

const tokenFor = (accessType: string): string =>
  jwt.sign({ accessType, emailAddress: 'user@example.com', id: USER_ID }, SECRET, {
    algorithm: 'HS256',
  });

const middlewareAt = (method: string, path: string, index: number): RequestHandler => {
  const handler = createPermissionMiddleware(method, path)[index];
  assert.ok(handler, `${method} ${path} has no middleware at ${index}`);
  return handler;
};

const run = async (handler: RequestHandler, headers: Record<string, string> = {}) => {
  const req = createRequest({ headers });
  const res = createResponse();
  const next = await callHandler(handler, req, res);
  return { next, req, res };
};

describe('permissionMiddleware', () => {
  const originalKey = process.env.JWT_KEY;

  before(() => {
    process.env.JWT_KEY = SECRET;
  });

  after(() => {
    if (originalKey === undefined) delete process.env.JWT_KEY;
    else process.env.JWT_KEY = originalKey;
  });

  beforeEach(() => {
    mock.method(console, 'warn', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createPermissionMiddleware', () => {
    const requireAuth = () => middlewareAt('POST', '/ownerships/create', 0);
    const optionalAuth = () => middlewareAt('GET', '/setlists/get', 0);

    it('builds the expected chain for every configured route', () => {
      const expected: Record<string, number> = {
        'GET /groups/get': 1,
        'GET /ownerships/get': 1,
        'GET /setlists/get': 1,
        'GET /songs/get': 0,
        'GET /songs/get-view': 0,
        'GET /songs/search': 0,
        'POST /groups/create': 1,
        'POST /ownerships/create': 1,
        'POST /setlists/create': 1,
        'POST /songs/create': 2,
        'PUT /groups/delete': 1,
        'PUT /groups/update': 1,
        'PUT /ownerships/delete': 1,
        'PUT /ownerships/update': 1,
        'PUT /setlists/delete': 1,
        'PUT /setlists/update': 1,
        'PUT /songs/delete': 2,
        'PUT /songs/update': 2,
      };
      assert.deepEqual(Object.keys(ROUTE_PERMISSIONS).sort(), Object.keys(expected).sort());
      for (const [routeKey, length] of Object.entries(expected)) {
        const [method, path] = routeKey.split(' ');
        const chain = createPermissionMiddleware(method ?? '', path ?? '');
        assert.equal(chain.length, length, routeKey);
        if (routeKey === 'GET /setlists/get') assert.equal(chain[0], optionalAuth());
        else if (length > 0) assert.equal(chain[0], requireAuth(), routeKey);
      }
    });

    it('upper-cases the method before looking up the route', () => {
      assert.equal(middlewareAt('get', '/setlists/get', 0), optionalAuth());
    });

    it('falls back to requireAuth and warns when a route has no config', () => {
      const warn = mock.method(console, 'warn', () => undefined);
      const chain = createPermissionMiddleware('GET', '/unknown/route');
      assert.deepEqual(chain, [requireAuth()]);
      assert.equal(warn.mock.callCount(), 1);
      assert.equal(
        warn.mock.calls[0]?.arguments[0],
        'No permission config found for route: GET /unknown/route'
      );
    });
  });

  describe('requireAuth', () => {
    const requireAuth = () => middlewareAt('POST', '/ownerships/create', 0);

    it('rejects a request with no authorization header', async () => {
      const { next, req, res } = await run(requireAuth());
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, {
        error: 'No authorization header provided',
        message: 'Unauthorized',
      });
      assert.equal(next.mock.callCount(), 0);
      assert.equal(req.user, undefined);
    });

    it('treats an empty header as missing', async () => {
      const { res } = await run(requireAuth(), { authorization: '' });
      assert.deepEqual(res.body, {
        error: 'No authorization header provided',
        message: 'Unauthorized',
      });
    });

    it('rejects malformed authorization headers', async () => {
      const token = tokenFor('admin');
      for (const header of [
        token,
        `Token ${token}`,
        `bearer ${token}`,
        'Bearer',
        'Bearer ',
        `Bearer  ${token}`,
        `Bearer ${token} extra`,
      ]) {
        const { next, res } = await run(requireAuth(), { authorization: header });
        assert.equal(res.statusCode, 401, header);
        assert.deepEqual(res.body, {
          error: 'Invalid authorization header format. Expected: Bearer <token>',
          message: 'Unauthorized',
        });
        assert.equal(next.mock.callCount(), 0);
      }
    });

    it('rejects a bearer token that does not verify', async () => {
      const { next, req, res } = await run(requireAuth(), { authorization: 'Bearer garbage' });
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, { error: 'Invalid or expired token', message: 'Unauthorized' });
      assert.equal(next.mock.callCount(), 0);
      assert.equal(req.user, undefined);
    });

    it('sets req.user and calls next for a valid token', async () => {
      const { next, req, res } = await run(requireAuth(), {
        authorization: `Bearer ${tokenFor('ministry')}`,
      });
      assert.deepEqual(req.user, {
        accessType: 'ministry',
        emailAddress: 'user@example.com',
        id: USER_ID,
      });
      assert.equal(next.mock.callCount(), 1);
      assert.deepEqual(next.mock.calls[0]?.arguments, []);
      assert.equal(res.statusCode, undefined);
    });
  });

  describe('requireAccessType', () => {
    const requireAccessType = () => middlewareAt('POST', '/songs/create', 1);

    it('allows each listed access type', async () => {
      for (const accessType of ['ministry', 't3ch', 'tc', 'admin']) {
        const req = createRequest({ user: { accessType, id: USER_ID } });
        const res = createResponse();
        const next = await callHandler(requireAccessType(), req, res);
        assert.equal(next.mock.callCount(), 1, accessType);
        assert.equal(res.statusCode, undefined);
      }
    });

    it('rejects unlisted access types with a 403 that names none of them', async () => {
      for (const accessType of ['unsigned', 'user', 'Admin', 'tech', '']) {
        const req = createRequest({ user: { accessType, id: USER_ID } });
        const res = createResponse();
        const next = await callHandler(requireAccessType(), req, res);
        assert.equal(res.statusCode, 403, accessType);
        assert.deepEqual(res.body, { error: 'Access denied', message: 'Forbidden' });
        assert.doesNotMatch(JSON.stringify(res.body), /ministry|t3ch|tc"|admin/);
        assert.equal(next.mock.callCount(), 0);
      }
    });

    it('rejects a request with no req.user', async () => {
      const { next, res } = await run(requireAccessType());
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, { error: 'No user information found', message: 'Unauthorized' });
      assert.equal(next.mock.callCount(), 0);
    });

    it('runs after requireAuth in the song write chains', async () => {
      const chain = createPermissionMiddleware('PUT', '/songs/update');
      const req = createRequest({ headers: { authorization: `Bearer ${tokenFor('unsigned')}` } });
      const res = createResponse();
      for (const handler of chain) {
        const next = await callHandler(handler, req, res);
        if (next.mock.callCount() === 0) break;
      }
      assert.equal(res.statusCode, 403);
    });
  });

  describe('optionalAuth', () => {
    const optionalAuth = () => middlewareAt('GET', '/setlists/get', 0);

    it('continues anonymously without a token', async () => {
      const { next, req, res } = await run(optionalAuth());
      assert.equal(next.mock.callCount(), 1);
      assert.equal(req.user, undefined);
      assert.equal(res.statusCode, undefined);
    });

    it('continues anonymously with a malformed header or bad token', async () => {
      for (const header of ['garbage', `bearer ${tokenFor('admin')}`, 'Bearer garbage']) {
        const { next, req, res } = await run(optionalAuth(), { authorization: header });
        assert.equal(next.mock.callCount(), 1, header);
        assert.equal(req.user, undefined);
        assert.equal(res.statusCode, undefined);
      }
    });

    it('sets req.user for a valid token', async () => {
      const { next, req } = await run(optionalAuth(), {
        authorization: `Bearer ${tokenFor('tc')}`,
      });
      assert.equal(next.mock.callCount(), 1);
      assert.deepEqual(req.user, {
        accessType: 'tc',
        emailAddress: 'user@example.com',
        id: USER_ID,
      });
    });

    it('accepts any access type, including unlisted ones', async () => {
      const { req } = await run(optionalAuth(), {
        authorization: `Bearer ${tokenFor('unsigned')}`,
      });
      assert.equal(req.user?.accessType, 'unsigned');
    });
  });
});
