import { Router } from 'express';
import groupRouter from './group.routes';
import ownershipRouter from './ownership.routes';
import setlistRouter from './setlist.routes';
import songRouter from './song.routes';

const getRoutes = (): Router => {
  const router = Router();

  router.use(ownershipRouter, groupRouter, setlistRouter, songRouter);

  return router;
};

export { getRoutes };
