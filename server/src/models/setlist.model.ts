import { Model, Schema, Types, model, models } from 'mongoose';
import { SetlistSchema, SetlistSongKey } from '../types/setlist.types';

const MUSIC_KEYS = [
  'A',
  'A#',
  'Bb',
  'B',
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
] as const;

const songKeySchema = new Schema<SetlistSongKey>(
  {
    songId: { type: Schema.Types.ObjectId, ref: 'Song', required: true },
    key: { type: String, required: true, enum: MUSIC_KEYS },
  },
  { _id: false }
);

const setlistSchema = new Schema<SetlistSchema>(
  {
    name: { type: String, required: true },
    date: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Ownership' },
    songs: [{ type: Types.ObjectId, ref: 'Song' }],
    songKeys: { type: [songKeySchema], default: [] },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'Ownership' },
    publicLink: { type: String, required: false, unique: true, sparse: true, default: null },
    groupIds: [{ type: Types.ObjectId, ref: 'Group' }],
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const Setlist =
  (models.Setlist as Model<SetlistSchema> | undefined) ??
  model<SetlistSchema>('Setlist', setlistSchema);

export { MUSIC_KEYS, Setlist };
