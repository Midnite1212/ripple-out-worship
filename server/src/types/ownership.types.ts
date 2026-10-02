import { RecordFields } from './record.types';

type OwnershipEntry = {
  id: string;
  name: string;
  createdAt: string;
};

type StoredOwnershipEntry = Partial<OwnershipEntry>;

type OwnershipRecord = RecordFields & {
  userId: string;
  fullName: string;
  accessType: string;
  groupIds: StoredOwnershipEntry[];
  setlistIds: StoredOwnershipEntry[];
  isDeleted: boolean;
};

type OwnershipSummary = Pick<OwnershipRecord, '_id' | 'userId' | 'fullName' | 'groupIds'>;

export { OwnershipEntry, OwnershipRecord, OwnershipSummary, StoredOwnershipEntry };
