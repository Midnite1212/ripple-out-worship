import dotenv from 'dotenv';
// Vercel's Express preset only accepts an entrypoint that imports 'express'.
import { Express } from 'express';
import * as path from 'path';
import { createApp } from './src/createApp';
import { ensureDatabase } from './src/db/connect';

dotenv.config();

const port: number = process.env.PORT ? parseInt(process.env.PORT) : 1338; // development port is 1338
const isDevelopment = process.env.NODE_ENV?.trim() === 'test';
const isLocalServer = require.main === module;

const app: Express = createApp({
  clientDir: isLocalServer && !isDevelopment ? path.join(__dirname, 'client') : undefined,
  ensureDatabase,
});

if (isLocalServer) {
  ensureDatabase()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server is running on port ${port}.`);
      });
    })
    .catch((error: unknown) => {
      console.error('Server failed to start.', error);
      process.exit(1);
    });
}

export default app;
