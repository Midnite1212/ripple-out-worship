import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Mock, mock } from 'node:test';
import { TokenUser } from '../utils/verify-jwt';

export type FakeResponse = {
  body: unknown;
  headersSent: boolean;
  statusCode: number | undefined;
  json: (body: unknown) => FakeResponse;
  status: (code: number) => FakeResponse;
};

export type FakeRequestInit = {
  body?: unknown;
  headers?: Record<string, string>;
  host?: string;
  protocol?: string;
  query?: Record<string, unknown>;
  user?: TokenUser;
};

export const createResponse = (headersSent = false): FakeResponse => {
  const res: FakeResponse = {
    body: undefined,
    headersSent,
    statusCode: undefined,
    json: (body) => {
      res.body = body;
      return res;
    },
    status: (code) => {
      res.statusCode = code;
      return res;
    },
  };
  return res;
};

export const createRequest = (init: FakeRequestInit = {}): Request & { user?: TokenUser } => {
  const req = {
    body: init.body,
    get: (name: string) => (name.toLowerCase() === 'host' ? init.host : undefined),
    headers: init.headers ?? {},
    protocol: init.protocol ?? 'http',
    query: init.query ?? {},
    user: init.user,
  };
  return req as unknown as Request & { user?: TokenUser };
};

export const callHandler = async (
  handler: RequestHandler,
  req: Request,
  res: FakeResponse
): Promise<Mock<NextFunction>> => {
  const next = mock.fn<NextFunction>();
  await handler(req, res as unknown as Response, next);
  return next;
};
