import cors from 'cors';
import express, { Express } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as path from 'path';
import { getRoutes } from './routes';
import { errorHandler, sendResponse } from './utils/response';

export type AppOptions = {
  clientDir?: string;
  ensureDatabase?: () => Promise<void>;
};

export const createApp = ({ clientDir, ensureDatabase }: AppOptions = {}): Express => {
  const app = express();

  app.use(
    cors({
      origin: [process.env.MAIN_URL as string],
      methods: ['GET', 'POST', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
      credentials: true,
    })
  );

  app.use(
    createProxyMiddleware('/external-api', {
      target: process.env.MAIN_URL,
      changeOrigin: true,
      secure: true,
      pathRewrite: {
        '^/external-api': '/api',
      },
      logLevel: 'warn',
    })
  );

  if (ensureDatabase) {
    app.use('/api', (_req, _res, next) => {
      ensureDatabase().then(() => next(), next);
    });
  }

  app.use(express.json());
  app.use(getRoutes());
  app.use('/api', (_req, res) => sendResponse(res, 404, 'Not found'));

  if (clientDir) {
    app.use(express.static(clientDir));
    app.use(express.static(path.join(clientDir, 'images')));
    app.use(express.static(path.join(clientDir, 'static')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
};
