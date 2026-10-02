import {
  createOwnership,
  deleteOwnership,
  getOwnership,
  updateOwnership,
} from '../controllers/ownership.controllers';
import { createPermissionRouter } from '../policies';

const router = createPermissionRouter();

router.post('/api/ownerships/create', createOwnership);
router.get('/api/ownerships/get', getOwnership);
router.put('/api/ownerships/update', updateOwnership);
router.put('/api/ownerships/delete', deleteOwnership);

export default router.getRouter();
