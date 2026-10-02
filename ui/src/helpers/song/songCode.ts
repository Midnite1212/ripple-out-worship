import { customAxios as axios } from '../../components/custom/customAxios';
import { SongSchema } from '../../types/song.types';

const SONG_CODE_PAGE_SIZE = 100;
const MAX_SONG_CODE_PAGES = 50;

export const getNextSongCode = async (songLetter: string) => {
  const prefix = songLetter.toUpperCase();
  if (!prefix) return '';

  let highestIndex = 0;
  for (let page = 1; page <= MAX_SONG_CODE_PAGES; page++) {
    const { data } = await axios.get<{ data?: SongSchema[]; totalPages?: number }>(
      '/api/songs/search',
      { params: { code: prefix, sortBy: 'code', limit: SONG_CODE_PAGE_SIZE, page } }
    );
    const songs = Array.isArray(data?.data) ? data.data : [];
    highestIndex = songs.reduce((highest, { code }) => {
      if (!code?.toUpperCase().startsWith(prefix)) return highest;
      const suffix = code.slice(prefix.length);
      return /^\d+$/.test(suffix) ? Math.max(highest, parseInt(suffix, 10)) : highest;
    }, highestIndex);
    if (songs.length < SONG_CODE_PAGE_SIZE || page >= (data?.totalPages ?? 1)) break;
  }
  return prefix + (highestIndex + 1);
};
