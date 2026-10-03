import { OwnershipEntry } from '../types/ownership.types';
import { ownedEntryIds } from './authorization';
import { isObjectIdString } from './validation';

type LegacyDocument = {
  _id: unknown;
  createdBy?: unknown;
  isDeleted?: boolean | null;
};

export type LegacySetlist = LegacyDocument & {
  groupIds?: readonly unknown[] | null;
};

export type LegacyGroup = LegacyDocument & {
  setlistIds?: readonly unknown[] | null;
};

export type LegacyOwnership = {
  userId: string;
  groupIds?: readonly OwnershipEntry[] | null;
  setlistIds?: readonly OwnershipEntry[] | null;
  isDeleted?: boolean | null;
};

export type SetlistCreatorFix = { setlistId: string; userId: string };
export type GroupCreatorFix = { groupId: string; userId: string };
export type SetlistGroupLink = { setlistId: string; groupId: string };
export type GroupSetlistLink = { groupId: string; setlistId: string };

export type BackfillPlan = {
  setlistCreatedBy: SetlistCreatorFix[];
  groupCreatedBy: GroupCreatorFix[];
  setlistGroupAdds: SetlistGroupLink[];
  groupSetlistAdds: GroupSetlistLink[];
  ambiguous: { setlists: string[]; groups: string[] };
  danglingLinks: { setlistGroupRefs: SetlistGroupLink[]; groupSetlistRefs: GroupSetlistLink[] };
};

type BackfillInput = {
  setlists: readonly LegacySetlist[];
  groups: readonly LegacyGroup[];
  ownerships: readonly LegacyOwnership[];
};

const isLive = (doc: { isDeleted?: boolean | null }): boolean => doc.isDeleted !== true;

const hasCreator = (doc: LegacyDocument): boolean =>
  doc.createdBy !== undefined && doc.createdBy !== null;

const linkIds = (ids: readonly unknown[] | null | undefined): Set<string> =>
  new Set((ids ?? []).map(String));

const holdersByEntryId = (
  ownerships: readonly LegacyOwnership[],
  entries: (ownership: LegacyOwnership) => readonly OwnershipEntry[] | null | undefined
): Map<string, Set<string>> => {
  const holders = new Map<string, Set<string>>();
  for (const ownership of ownerships) {
    for (const id of ownedEntryIds(entries(ownership))) {
      const userIds = holders.get(id) ?? new Set<string>();
      userIds.add(ownership.userId);
      holders.set(id, userIds);
    }
  }
  return holders;
};

const soleHolder = (holders: Map<string, Set<string>>, id: string): string | null => {
  const userIds = [...(holders.get(id) ?? [])];
  return userIds.length === 1 && isObjectIdString(userIds[0]) ? userIds[0] : null;
};

export const planBackfill = ({ setlists, groups, ownerships }: BackfillInput): BackfillPlan => {
  const liveSetlists = setlists.filter(isLive);
  const liveGroups = groups.filter(isLive);
  const liveOwnerships = ownerships.filter(isLive);

  const plan: BackfillPlan = {
    setlistCreatedBy: [],
    groupCreatedBy: [],
    setlistGroupAdds: [],
    groupSetlistAdds: [],
    ambiguous: { setlists: [], groups: [] },
    danglingLinks: { setlistGroupRefs: [], groupSetlistRefs: [] },
  };

  const setlistHolders = holdersByEntryId(liveOwnerships, (ownership) => ownership.setlistIds);
  for (const setlist of liveSetlists.filter((doc) => !hasCreator(doc))) {
    const setlistId = String(setlist._id);
    const userId = soleHolder(setlistHolders, setlistId);
    if (userId) plan.setlistCreatedBy.push({ setlistId, userId });
    else plan.ambiguous.setlists.push(setlistId);
  }

  const groupHolders = holdersByEntryId(liveOwnerships, (ownership) => ownership.groupIds);
  for (const group of liveGroups.filter((doc) => !hasCreator(doc))) {
    const groupId = String(group._id);
    const userId = soleHolder(groupHolders, groupId);
    if (userId) plan.groupCreatedBy.push({ groupId, userId });
    else plan.ambiguous.groups.push(groupId);
  }

  const setlistLinks = new Map(liveSetlists.map((doc) => [String(doc._id), linkIds(doc.groupIds)]));
  const groupLinks = new Map(liveGroups.map((doc) => [String(doc._id), linkIds(doc.setlistIds)]));

  for (const [groupId, setlistIds] of groupLinks) {
    for (const setlistId of setlistIds) {
      const groupIds = setlistLinks.get(setlistId);
      if (!groupIds) plan.danglingLinks.groupSetlistRefs.push({ groupId, setlistId });
      else if (!groupIds.has(groupId)) plan.setlistGroupAdds.push({ setlistId, groupId });
    }
  }

  for (const [setlistId, groupIds] of setlistLinks) {
    for (const groupId of groupIds) {
      const setlistIds = groupLinks.get(groupId);
      if (!setlistIds) plan.danglingLinks.setlistGroupRefs.push({ setlistId, groupId });
      else if (!setlistIds.has(setlistId)) plan.groupSetlistAdds.push({ groupId, setlistId });
    }
  }

  return plan;
};
