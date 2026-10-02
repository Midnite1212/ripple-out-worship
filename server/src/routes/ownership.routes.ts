import {
  createOwnership,
  deleteOwnership,
  getOwnership,
  updateOwnership,
} from '../controllers/ownership.controllers';
import { createPermissionRouter } from '../policies';

const router = createPermissionRouter();

router.post('/ownerships/create', createOwnership);
router.get('/ownerships/get', getOwnership);
router.put('/ownerships/update', updateOwnership);
router.put('/ownerships/delete', deleteOwnership);

export default router.getRouter();
