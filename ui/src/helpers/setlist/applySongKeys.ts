import { Setlist } from '../../types/setlist.types';

export const applySongKeys = (data: Setlist): Setlist => {
  const songs = Array.isArray(data.songs) ? data.songs : [];
  return {
    ...data,
    songs: songs.map((song) => ({
      ...song,
      key: data.songKeys?.find(({ songId }) => songId === song._id)?.key ?? song.originalKey,
    })),
  };
};
