import { DrizzleQueryError } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import assert from 'node:assert/strict';
import { Mock, afterEach, beforeEach, describe, it, mock } from 'node:test';
import { InvalidInputError } from '../db/cast';
import { FakeResponse, createResponse } from '../testing/http';
import { errorHandler, sendError, sendResponse } from './response';

const asResponse = (res: FakeResponse): Response => res as unknown as Response;

const databaseError = (code: string) => Object.assign(new Error('database error'), { code });

const handle = (error: unknown, res: FakeResponse) => {
  const next = mock.fn<NextFunction>();
  errorHandler(error, {} as Request, asResponse(res), next);
  return next;
};

describe('response utils', () => {
  let consoleError: Mock<typeof console.error | (() => undefined)>;

  beforeEach(() => {
    consoleError = mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('sendResponse', () => {
    it('writes the status and JSON payload', () => {
      const res = createResponse();
      sendResponse(asResponse(res), 201, { ok: true });
      assert.equal(res.statusCode, 201);
      assert.deepEqual(res.body, { ok: true });
    });

    it('sends string payloads as JSON strings', () => {
      const res = createResponse();
      sendResponse(asResponse(res), 404, 'Song not found');
      assert.equal(res.body, 'Song not found');
    });
  });

  describe('sendError', () => {
    it('maps an InvalidInputError to 400 without logging', () => {
      const res = createResponse();
      sendError(asResponse(res), new InvalidInputError('title'));
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Invalid request');
      assert.equal(consoleError.mock.callCount(), 0);
    });

    it('maps Postgres data and constraint errors to 400 without logging, wrapped or not', () => {
      for (const code of ['22001', '22007', '22P02', '23502', '23503', '23514']) {
        for (const error of [
          databaseError(code),
          new DrizzleQueryError('select 1', ['Private Name'], databaseError(code)),
        ]) {
          const res = createResponse();
          sendError(asResponse(res), error);
          assert.equal(res.statusCode, 400, code);
          assert.equal(res.body, 'Invalid request');
        }
      }
      assert.equal(consoleError.mock.callCount(), 0);
    });

    it('logs the driver error, not the query parameters, for a failed query', () => {
      const res = createResponse();
      const cause = databaseError('23505');
      sendError(asResponse(res), new DrizzleQueryError('insert', ['Private Name'], cause));
      assert.equal(res.statusCode, 500);
      assert.equal(res.body, 'Something went wrong');
      assert.equal(consoleError.mock.calls[0]?.arguments[0], cause);
    });

    it('maps any other error to a logged generic 500', () => {
      const res = createResponse();
      const error = new Error('secret detail');
      sendError(asResponse(res), error);
      assert.equal(res.statusCode, 500);
      assert.equal(res.body, 'Something went wrong');
      assert.equal(consoleError.mock.callCount(), 1);
      assert.equal(consoleError.mock.calls[0]?.arguments[0], error);
    });

    it('treats a plain object with status 400 as a 500', () => {
      const res = createResponse();
      sendError(asResponse(res), { status: 400 });
      assert.equal(res.statusCode, 500);
    });
  });

  describe('errorHandler', () => {
    it('delegates to next when headers are already sent', () => {
      const res = createResponse(true);
      const error = new Error('late');
      const next = handle(error, res);
      assert.equal(next.mock.callCount(), 1);
      assert.equal(next.mock.calls[0]?.arguments[0], error);
      assert.equal(res.statusCode, undefined);
      assert.equal(consoleError.mock.callCount(), 0);
    });

    it('passes 4xx statuses through with a generic message', () => {
      for (const status of [400, 404, 413, 499]) {
        const res = createResponse();
        const next = handle({ message: 'detail', status }, res);
        assert.equal(res.statusCode, status);
        assert.equal(res.body, 'Invalid request');
        assert.equal(next.mock.callCount(), 0);
      }
      assert.equal(consoleError.mock.callCount(), 0);
    });

    it('maps everything else to a logged generic 500', () => {
      const errors: unknown[] = [
        { status: 500 },
        { status: 399 },
        { status: '400' },
        new Error('boom'),
        'boom',
        null,
        undefined,
      ];
      for (const error of errors) {
        const res = createResponse();
        handle(error, res);
        assert.equal(res.statusCode, 500);
        assert.equal(res.body, 'Something went wrong');
      }
      assert.equal(consoleError.mock.callCount(), errors.length);
    });
  });
});
