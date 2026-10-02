import dotenv from 'dotenv';
import { Types, connect, disconnect } from 'mongoose';
import { Group } from '../src/models/group.model';
import { Ownership } from '../src/models/ownership.model';
import { Setlist } from '../src/models/setlist.model';
import { connectToDB } from '../src/mongoose';
import { BackfillPlan, planBackfill } from '../src/utils/legacyOwnership';

dotenv.config();

const URI_FLAG = '--uri=';
const APPLY_FLAG = '--apply';
const LIVE = { isDeleted: { $ne: true } };
const NO_CREATOR = {
  $or: [{ createdBy: { $exists: false } }, { createdBy: { $type: 'null' as const } }],
};

const toObjectId = (id: string): Types.ObjectId => new Types.ObjectId(id);

type Options = { shouldApply: boolean; uri?: string };

const parseArgs = (args: string[]): Options => {
  const unknown = args.filter((arg) => arg !== APPLY_FLAG && !arg.startsWith(URI_FLAG));
  if (unknown.length > 0) throw new Error(`Unknown arguments: ${unknown.join(' ')}`);
  const uri = args.find((arg) => arg.startsWith(URI_FLAG))?.slice(URI_FLAG.length);
  return { shouldApply: args.includes(APPLY_FLAG), uri };
};

const printSection = (title: string, lines: string[], note?: string): void => {
  console.log(`\n${title}: ${lines.length}`);
  if (note && lines.length > 0) console.log(`  (${note})`);
  for (const line of lines) console.log(`  ${line}`);
};

const printReport = (plan: BackfillPlan): void => {
  printSection(
    'Setlist createdBy to set',
    plan.setlistCreatedBy.map(({ setlistId, userId }) => `setlist ${setlistId} -> user ${userId}`)
  );
  printSection(
    'Folder createdBy to set',
    plan.groupCreatedBy.map(({ groupId, userId }) => `folder ${groupId} -> user ${userId}`)
  );
  printSection(
    'Setlist groupIds to add',
    plan.setlistGroupAdds.map(
      ({ setlistId, groupId }) => `setlist ${setlistId} += folder ${groupId}`
    )
  );
  printSection(
    'Folder setlistIds to add',
    plan.groupSetlistAdds.map(
      ({ groupId, setlistId }) => `folder ${groupId} += setlist ${setlistId}`
    )
  );
  printSection(
    'Ambiguous setlists left without createdBy',
    plan.ambiguous.setlists.map((id) => `setlist ${id}`),
    'zero or several ownerships list the setlist; setlistIds also gains entries when someone edits a shared setlist, so several holders are expected'
  );
  printSection(
    'Ambiguous folders left without createdBy',
    plan.ambiguous.groups.map((id) => `folder ${id}`),
    'zero or several members'
  );
  printSection(
    'Dangling links left in place',
    [
      ...plan.danglingLinks.setlistGroupRefs.map(
        ({ setlistId, groupId }) => `setlist ${setlistId} -> missing or deleted folder ${groupId}`
      ),
      ...plan.danglingLinks.groupSetlistRefs.map(
        ({ groupId, setlistId }) => `folder ${groupId} -> missing or deleted setlist ${setlistId}`
      ),
    ],
    'reported only; nothing is removed'
  );
};

const applyPlan = async (plan: BackfillPlan): Promise<{ setlists: number; groups: number }> => {
  const setlistOps = [
    ...plan.setlistCreatedBy.map(({ setlistId, userId }) => ({
      updateOne: {
        filter: { _id: toObjectId(setlistId), ...LIVE, ...NO_CREATOR },
        update: { $set: { createdBy: toObjectId(userId) } },
        timestamps: false,
      },
    })),
    ...plan.setlistGroupAdds.map(({ setlistId, groupId }) => ({
      updateOne: {
        filter: { _id: toObjectId(setlistId), ...LIVE },
        update: { $addToSet: { groupIds: toObjectId(groupId) } },
        timestamps: false,
      },
    })),
  ];
  const groupOps = [
    ...plan.groupCreatedBy.map(({ groupId, userId }) => ({
      updateOne: {
        filter: { _id: toObjectId(groupId), ...LIVE, ...NO_CREATOR },
        update: { $set: { createdBy: toObjectId(userId) } },
        timestamps: false,
      },
    })),
    ...plan.groupSetlistAdds.map(({ groupId, setlistId }) => ({
      updateOne: {
        filter: { _id: toObjectId(groupId), ...LIVE },
        update: { $addToSet: { setlistIds: toObjectId(setlistId) } },
        timestamps: false,
      },
    })),
  ];

  const [setlistResult, groupResult] = await Promise.all([
    setlistOps.length > 0 ? Setlist.bulkWrite(setlistOps, { ordered: false }) : null,
    groupOps.length > 0 ? Group.bulkWrite(groupOps, { ordered: false }) : null,
  ]);
  return {
    setlists: setlistResult?.modifiedCount ?? 0,
    groups: groupResult?.modifiedCount ?? 0,
  };
};

const main = async (): Promise<void> => {
  const { shouldApply, uri } = parseArgs(process.argv.slice(2));

  if (uri) await connect(uri);
  else await connectToDB();

  const [setlists, groups, ownerships] = await Promise.all([
    Setlist.find({}, 'createdBy groupIds isDeleted').lean().exec(),
    Group.find({}, 'createdBy setlistIds isDeleted').lean().exec(),
    Ownership.find({}, 'userId groupIds.id setlistIds.id isDeleted').lean().exec(),
  ]);

  console.log(shouldApply ? 'Mode: APPLY' : 'Mode: DRY RUN (no writes; pass --apply to write)');
  console.log(
    `Loaded ${setlists.length} setlists, ${groups.length} folders, ${ownerships.length} ownerships (soft-deleted included, then ignored)`
  );

  const plan = planBackfill({ setlists, groups, ownerships });
  printReport(plan);

  if (!shouldApply) return;
  const modified = await applyPlan(plan);
  console.log(
    `\nApplied: ${modified.setlists} setlist and ${modified.groups} folder updates changed a document`
  );
};

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Backfill failed');
    process.exitCode = 1;
  })
  .finally(() => disconnect());
