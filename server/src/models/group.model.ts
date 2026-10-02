import { Model, Schema, Types, model, models } from 'mongoose';
import { GroupSchema } from '../types/group.types';

const groupSchema = new Schema<GroupSchema>(
  {
    groupName: { type: String, required: true },
    setlistIds: [{ type: Types.ObjectId, ref: 'Setlist' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'Ownership' },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'Ownership' },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const Group =
  (models.Group as Model<GroupSchema> | undefined) ?? model<GroupSchema>('Group', groupSchema);

export { Group };
