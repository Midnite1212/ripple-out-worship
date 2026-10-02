import {
  createSetlist,
  deleteSetlist,
  getSetlist,
  updateSetlist,
} from '../controllers/setlist.controllers';
import { createPermissionRouter } from '../policies';

const router = createPermissionRouter();

router.post('/api/setlists/create', createSetlist);
router.get('/api/setlists/get', getSetlist);
router.put('/api/setlists/update', updateSetlist);
router.put('/api/setlists/delete', deleteSetlist);

export default router.getRouter();
