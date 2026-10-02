import { createGroup, deleteGroup, getGroup, updateGroup } from '../controllers/group.controllers';
import { createPermissionRouter } from '../policies';

const router = createPermissionRouter();

router.post('/groups/create', createGroup);
router.get('/groups/get', getGroup);
router.put('/groups/update', updateGroup);
router.put('/groups/delete', deleteGroup);

export default router.getRouter();
