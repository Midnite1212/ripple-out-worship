import { Model, Schema, model, models } from 'mongoose';
import { OwnershipEntry, OwnershipSchema } from '../types/ownership.types';

const ownershipEntrySchema = new Schema<OwnershipEntry>(
  {
    id: { type: String },
    name: { type: String },
    createdAt: { type: String },
  },
  { _id: false, strict: false }
);

const ownershipSchema = new Schema<OwnershipSchema>(
  {
    userId: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    accessType: { type: String, required: true, default: 'unsigned' },
    groupIds: [ownershipEntrySchema],
    setlistIds: [ownershipEntrySchema],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Ownership =
  (models.Ownership as Model<OwnershipSchema> | undefined) ??
  model<OwnershipSchema>('Ownership', ownershipSchema);

export { Ownership };
