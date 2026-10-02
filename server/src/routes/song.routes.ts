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

router.post('/songs/create', createSong);
router.get('/songs/get', getSong);
router.get('/songs/get-view', getSongView);
router.put('/songs/update', updateSong);
router.put('/songs/delete', deleteSong);
router.get('/songs/search', searchSongs);

export default router.getRouter();
