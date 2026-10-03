import { SongSetlistSchema } from './song.types';
import { Dayjs } from 'dayjs';

interface SetlistEditorFields {
  name: string;
  date: Dayjs;
  songs: SongSetlistSchema[];
  groupIds: string[];
}

interface SetlistEditorProps {
  actionOnEditor?: string;
}

export type SetlistSongKey = {
  songId: string;
  key: string;
};

export type Setlist = {
  _id: string;
  name: string;
  date: Date | string;
  songs: SongSetlistSchema[];
  songKeys?: SetlistSongKey[];
  groupIds: string[];
  publicLink: string;
  createdAt: string;
  lastUpdatedBy: string;
  isDeleted: boolean;
};

export type SetlistFolder = {
  _id: string;
  groupName: string;
  setlistIds: string[];
  createdBy: string;
  lastUpdatedBy: string;
  createdAt: string;
  isDeleted: boolean;
};

export type SetlistFolderMember = {
  _id: string;
  fullName: string;
  email: string;
};

export type { SetlistEditorFields, SetlistEditorProps };
