import { RecordFields } from './record.types';
import { PublicSongRecord, SongRecord } from './song.types';

type SetlistSongKey = {
  songId: string;
  key: string;
};

type SetlistRecord = RecordFields & {
  name: string;
  date: Date | null;
  createdBy?: string;
  songs: string[];
  songKeys: SetlistSongKey[];
  lastUpdatedBy?: string;
  publicLink: string | null;
  groupIds: string[];
  isDeleted: boolean;
};

type PopulatedSetlistRecord = Omit<SetlistRecord, 'songs'> & { songs: SongRecord[] };

type PublicSetlistRecord = Omit<
  SetlistRecord,
  'createdBy' | 'lastUpdatedBy' | 'groupIds' | 'songs'
> & { songs: PublicSongRecord[] };

type SetlistAccess = {
  _id: string;
  createdBy?: string;
  groupIds: string[];
  songs: string[];
};

export {
  PopulatedSetlistRecord,
  PublicSetlistRecord,
  SetlistAccess,
  SetlistRecord,
  SetlistSongKey,
};
