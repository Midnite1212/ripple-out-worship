import {
  createSong,
  deleteSong,
  getSong,
  getSongView,
  searchSongs,
  updateSong,
} from '../controllers/song.controllers';
import { createPermissionRouter } from '../policies';

const router = createPermissionRouter();

router.post('/api/songs/create', createSong);
router.get('/api/songs/get', getSong);
router.get('/api/songs/get-view', getSongView);
router.put('/api/songs/update', updateSong);
router.put('/api/songs/delete', deleteSong);
router.get('/api/songs/search', searchSongs);

export default router.getRouter();
