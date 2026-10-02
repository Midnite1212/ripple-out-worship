import { Types } from 'mongoose';
import { MongoInjectedFields } from './mongo.types';

type OwnershipEntry = {
  id: string;
  name: string;
  createdAt: string;
};

type OwnershipSchema = {
  userId: string;
  fullName: string;
  accessType: string;
  groupIds?: Types.DocumentArray<OwnershipEntry>;
  setlistIds?: Types.DocumentArray<OwnershipEntry>;
  isDeleted: boolean;
};

type OwnershipDocument = OwnershipSchema & MongoInjectedFields;

export { OwnershipDocument, OwnershipEntry, OwnershipSchema };
