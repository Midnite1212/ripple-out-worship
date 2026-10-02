import { groupBy } from '../repositories/shared';
import { COLLECTIONS, IMPORT_TABLES, ImportPlan, SkippedLink } from './plan';

const indent = (lines: string[], depth = 1): string[] =>
  lines.map((line) => `${'  '.repeat(depth)}${line}`);

const describeLink = ({ fromId, toId }: SkippedLink): string =>
  `${fromId} -> ${toId ?? '(invalid or no id)'}`;

const skippedLinkLines = (links: SkippedLink[]): string[] =>
  Array.from(
    groupBy(
      links,
      ({ table, reason }) => `${table}, ${reason}`,
      (link) => link
    )
  ).flatMap(([kind, kindLinks]) => [
    `${kind}: ${kindLinks.length}`,
    ...indent(kindLinks.map(describeLink)),
  ]);

export const formatPlan = (plan: ImportPlan): string[] => {
  const { ambiguous } = plan.backfill;
  const unknown = COLLECTIONS.flatMap((collection) =>
    Object.entries(plan.unknownFields[collection])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([field, count]) => `${collection}.${field}: ${count}`)
  );
  return [
    `Documents read: ${COLLECTIONS.map((c) => `${c} ${plan.read[c]}`).join(', ')}`,
    'Rows to write:',
    ...indent(IMPORT_TABLES.map((table) => `${table}: ${plan.rows[table].length}`)),
    `Invalid documents skipped: ${plan.invalidDocuments.length}`,
    ...indent(
      plan.invalidDocuments.map(
        ({ collection, index, id, reason }) =>
          `${collection}[${index}]${id ? ` ${id}` : ''}: ${reason}`
      )
    ),
    `Skipped links: ${plan.skippedLinks.length}`,
    ...indent(skippedLinkLines(plan.skippedLinks)),
    `Backfilled createdBy: setlists ${plan.backfill.setlists}, folders ${plan.backfill.groups}`,
    `Ambiguous backfill, createdBy left empty: setlists ${ambiguous.setlists.length}, folders ${ambiguous.groups.length}`,
    ...indent([
      ...ambiguous.setlists.map((id) => `setlist ${id}`),
      ...ambiguous.groups.map((id) => `folder ${id}`),
    ]),
    `Unknown fields: ${unknown.length === 0 ? 'none' : ''}`.trimEnd(),
    ...indent(unknown),
  ];
};
