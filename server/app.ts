import express from 'express';
import { connectToDB } from './src/mongoose';
import { getRoutes } from './src/routes';
import * as path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { errorHandler } from './src/utils/response';

dotenv.config();

const app = express();
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 1338; // development port is 1338
const isDevelopment = process.env.NODE_ENV?.trim() === 'test';

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
app.use(express.json());
app.use(getRoutes());
if (!isDevelopment) {
  app.use(express.static(path.join(__dirname, '/client/')));
  app.use(express.static(path.join(__dirname, '/client/images')));
  app.use(express.static(path.join(__dirname, '/client/static')));
  app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname + '/client/index.html'));
  });
}
app.use(errorHandler);

// Starts the server after connecting to the database
connectToDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}.`);
    });
  })
  .catch((error: unknown) => {
    console.error('Server failed to start.', error);
    process.exit(1);
  });
