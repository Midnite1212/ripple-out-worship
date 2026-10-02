import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MISSING_ID, SETLIST_1, SETLIST_AMBIGUOUS, mongoExport } from '../../testing/mongoExport';
import { planImport } from './plan';
import { formatPlan } from './report';

describe('formatPlan', () => {
  const lines = formatPlan(planImport(mongoExport()));
  const text = lines.join('\n');

  it('lists the row counts per table', () => {
    assert.ok(lines.includes('Documents read: songs 5, setlists 4, groups 3, ownerships 3'));
    assert.ok(lines.includes('  setlist_songs: 5'));
    assert.ok(lines.includes('  group_setlists: 4'));
  });

  it('groups skipped links by table and reason with their ids', () => {
    assert.ok(lines.includes('Skipped links: 9'));
    assert.ok(lines.includes('  setlist_songs, missing document: 1'));
    assert.ok(lines.includes(`    ${SETLIST_1} -> ${MISSING_ID}`));
    assert.ok(lines.includes(`    ${SETLIST_1} -> (invalid or no id)`));
  });

  it('reports invalid documents, ambiguous backfill items, and unknown fields', () => {
    assert.ok(lines.includes('Invalid documents skipped: 3'));
    assert.ok(lines.includes('  songs[4]: invalid _id'));
    assert.ok(lines.includes(`  setlist ${SETLIST_AMBIGUOUS}`));
    assert.ok(lines.includes('  songs.legacyRating: 2'));
  });

  it('prints no names, titles, or other stored text', () => {
    for (const value of ['Fixture Owner', 'Fixture Song', 'Fixture Folder', 'Fixture Sunday']) {
      assert.ok(!text.includes(value), value);
    }
  });

  it('says none when there are no unknown fields', () => {
    const empty = formatPlan(planImport({ songs: [], setlists: [], groups: [], ownerships: [] }));
    assert.ok(empty.includes('Unknown fields: none'));
  });
});
