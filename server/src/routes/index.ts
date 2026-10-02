import { Router } from 'express';
import ownershipRouter from './ownership.routes';
import groupRouter from './group.routes';
import setlistRouter from './setlist.routes';
import songRouter from './song.routes';

const getRoutes = (): Router => {
  const router = Router();

  router.use('/ownerships', ownershipRouter);
  router.use('/groups', groupRouter);
  router.use('/setlists', setlistRouter);
  router.use('/songs', songRouter);

  return router;
};

export { getRoutes };
