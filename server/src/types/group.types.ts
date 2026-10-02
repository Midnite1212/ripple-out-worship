import { RecordFields } from './record.types';

type GroupRecord = RecordFields & {
  groupName: string;
  setlistIds: string[];
  createdBy?: string;
  lastUpdatedBy?: string;
  isDeleted: boolean;
};

type GroupAccess = Pick<GroupRecord, '_id' | 'createdBy' | 'groupName' | 'createdAt'>;

export { GroupAccess, GroupRecord };
