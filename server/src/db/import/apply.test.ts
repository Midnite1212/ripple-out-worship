import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mongoExport } from '../../testing/mongoExport';
import { TableCounts, decideTarget, plannedCounts } from './apply';
import { planImport } from './plan';

const EMPTY: TableCounts = {
  songs: 0,
  setlists: 0,
  groups: 0,
  ownerships: 0,
  setlist_songs: 0,
  setlist_song_keys: 0,
  group_setlists: 0,
  ownership_setlists: 0,
  ownership_groups: 0,
};

describe('decideTarget', () => {
  it('inserts into empty tables with or without --replace', () => {
    assert.deepEqual(decideTarget(EMPTY, false), { action: 'insert' });
    assert.deepEqual(decideTarget(EMPTY, true), { action: 'insert' });
  });

  it('refuses when any import table holds rows, so a re-run never duplicates', () => {
    const existing = { ...EMPTY, ownership_groups: 1 };
    assert.deepEqual(decideTarget(existing, false), { action: 'refuse', existing });
  });

  it('replaces a non-empty target only with --replace', () => {
    const existing = { ...EMPTY, songs: 15 };
    assert.deepEqual(decideTarget(existing, true), { action: 'replace', existing });
  });
});

describe('plannedCounts', () => {
  it('counts the rows the plan writes per table', () => {
    assert.deepEqual(plannedCounts(planImport(mongoExport())), {
      songs: 3,
      setlists: 4,
      groups: 3,
      ownerships: 2,
      setlist_songs: 5,
      setlist_song_keys: 2,
      group_setlists: 4,
      ownership_setlists: 4,
      ownership_groups: 1,
    });
  });
});
