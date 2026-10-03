import {
  createGroup,
  deleteGroup,
  getGroup,
  updateGroup,
  updateGroupMembers,
} from '../controllers/group.controllers';
import { createPermissionRouter } from '../policies';

const router = createPermissionRouter();

router.post('/api/groups/create', createGroup);
router.get('/api/groups/get', getGroup);
router.put('/api/groups/update', updateGroup);
router.put('/api/groups/members', updateGroupMembers);
router.put('/api/groups/delete', deleteGroup);

export default router.getRouter();
