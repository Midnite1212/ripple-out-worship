import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pick } from './pick';

describe('pick', () => {
  it('copies only the listed keys', () => {
    const source = { artist: 'A', createdBy: 'x', title: 'T' };
    assert.deepEqual(pick(source, ['title', 'artist']), { artist: 'A', title: 'T' });
  });

  it('skips listed keys that are missing or undefined', () => {
    assert.deepEqual(pick({ title: undefined }, ['title', 'artist']), {});
  });

  it('keeps falsy values other than undefined', () => {
    const source = { a: null, b: false, c: 0, d: '' };
    assert.deepEqual(pick(source, ['a', 'b', 'c', 'd']), { a: null, b: false, c: 0, d: '' });
  });

  it('ignores inherited properties', () => {
    const source: unknown = Object.create({ title: 'inherited' });
    assert.deepEqual(pick(source, ['title']), {});
  });

  it('returns an empty object for non-object sources', () => {
    for (const source of [undefined, null, 'title', 42, true]) {
      assert.deepEqual(pick(source, ['title']), {});
    }
  });

  it('keeps nested values by reference', () => {
    const songs = ['a'];
    assert.equal(pick({ songs }, ['songs']).songs, songs);
  });

  it('reads array indexes as own keys', () => {
    assert.deepEqual(pick(['first'], ['0']), { 0: 'first' });
  });
});
