import { Types } from 'mongoose';
import { MongoInjectedFields } from './mongo.types';

type SetlistSongKey = {
  songId: Types.ObjectId;
  key: string;
};

type SetlistSchema = {
  name: string;
  date: Date;
  createdBy: Types.ObjectId;
  songs: Types.Array<Types.ObjectId>;
  songKeys: SetlistSongKey[];
  lastUpdatedBy: Types.ObjectId;
  publicLink: string;
  groupIds: Types.Array<Types.ObjectId>;
  isDeleted: boolean;
};

type SetlistDocument = SetlistSchema & MongoInjectedFields;

export { SetlistSchema, SetlistDocument, SetlistSongKey };
