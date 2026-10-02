import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  InvalidInputError,
  castDate,
  castObjectIdArray,
  castOptionalString,
  castRequiredString,
  castStringArray,
} from './cast';

const ID = '507f1f77bcf86cd799439011';

describe('cast', () => {
  it('casts scalars to strings and rejects objects and arrays', () => {
    assert.equal(castOptionalString('year', 2020), '2020');
    assert.equal(castOptionalString('year', true), 'true');
    assert.equal(castOptionalString('year', null), null);
    assert.equal(castOptionalString('year', undefined), null);
    for (const value of [{}, ['a'], { toString: () => 'x' }]) {
      assert.throws(() => castOptionalString('year', value), InvalidInputError);
    }
  });

  it('requires a non-empty string for required fields', () => {
    assert.equal(castRequiredString('title', ' '), ' ');
    assert.equal(castRequiredString('title', 123), '123');
    for (const value of ['', null, undefined]) {
      assert.throws(() => castRequiredString('title', value), InvalidInputError);
    }
  });

  it('wraps a scalar into a one-item array and rejects null items', () => {
    assert.deepEqual(castStringArray('tempo', 'Fast'), ['Fast']);
    assert.deepEqual(castStringArray('tempo', ['Fast', 1]), ['Fast', '1']);
    assert.deepEqual(castStringArray('tempo', null), []);
    assert.deepEqual(castStringArray('tempo', ['']), ['']);
    assert.throws(() => castStringArray('tempo', [null]), InvalidInputError);
    assert.throws(
      () => castStringArray('themes', [''], { itemsRequired: true }),
      InvalidInputError
    );
  });

  it('lowercases object ids and rejects anything else', () => {
    assert.deepEqual(castObjectIdArray('songs', ID.toUpperCase()), [ID]);
    assert.deepEqual(castObjectIdArray('songs', [ID, ID]), [ID, ID]);
    assert.deepEqual(castObjectIdArray('songs', undefined), []);
    for (const value of [['bad'], [ID, 1], 'aaaaaaaaaaaa']) {
      assert.throws(() => castObjectIdArray('songs', value), InvalidInputError);
    }
  });

  it('casts dates from strings, numbers, and dates, treating empty values as null', () => {
    assert.equal(castDate('date', '2026-10-04')?.toISOString(), '2026-10-04T00:00:00.000Z');
    assert.equal(castDate('date', 0)?.toISOString(), '1970-01-01T00:00:00.000Z');
    assert.equal(castDate('date', new Date(5))?.getTime(), 5);
    for (const value of [null, undefined, '']) {
      assert.equal(castDate('date', value), null);
    }
    for (const value of ['nope', true, {}, []]) {
      assert.throws(() => castDate('date', value), InvalidInputError);
    }
  });
});
