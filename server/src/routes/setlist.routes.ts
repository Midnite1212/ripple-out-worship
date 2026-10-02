import {
  createSetlist,
  deleteSetlist,
  getSetlist,
  updateSetlist,
} from '../controllers/setlist.controllers';
import { createPermissionRouter } from '../policies';

const router = createPermissionRouter();

router.post('/setlists/create', createSetlist);
router.get('/setlists/get', getSetlist);
router.put('/setlists/update', updateSetlist);
router.put('/setlists/delete', deleteSetlist);

export default router.getRouter();
