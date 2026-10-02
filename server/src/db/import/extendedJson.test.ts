import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExtendedJsonError, fromExtendedJson } from './extendedJson';

describe('fromExtendedJson', () => {
  it('turns $oid into the lowercase hex string', () => {
    assert.equal(
      fromExtendedJson({ $oid: '64B0000000000000000000AA' }),
      '64b0000000000000000000aa'
    );
  });

  it('reads relaxed, canonical, and numeric $date values', () => {
    const iso = '2026-01-02T03:04:05.678Z';
    assert.deepEqual(fromExtendedJson({ $date: iso }), new Date(iso));
    assert.deepEqual(
      fromExtendedJson({ $date: { $numberLong: String(Date.parse(iso)) } }),
      new Date(iso)
    );
    assert.deepEqual(fromExtendedJson({ $date: Date.parse(iso) }), new Date(iso));
    assert.deepEqual(fromExtendedJson({ $date: '2026-10-04T00:00:00Z' }), new Date('2026-10-04'));
  });

  it('reads canonical numbers', () => {
    assert.deepEqual(
      fromExtendedJson([
        { $numberInt: '7' },
        { $numberLong: '9007199254740991' },
        { $numberDouble: '1.5' },
        { $numberDecimal: '2.25' },
      ]),
      [7, 9007199254740991, 1.5, 2.25]
    );
  });

  it('converts nested documents and arrays and leaves plain values alone', () => {
    assert.deepEqual(
      fromExtendedJson({
        _id: { $oid: '64b0000000000000000000aa' },
        songKeys: [{ songId: { $oid: '64b0000000000000000000BB' }, key: 'C' }],
        name: 'Plain',
        count: 3,
        empty: null,
      }),
      {
        _id: '64b0000000000000000000aa',
        songKeys: [{ songId: '64b0000000000000000000bb', key: 'C' }],
        name: 'Plain',
        count: 3,
        empty: null,
      }
    );
  });

  it('keeps documents that only look like wrappers', () => {
    const value = { $oid: '64b0000000000000000000aa', extra: true };
    assert.deepEqual(fromExtendedJson(value), value);
    assert.deepEqual(fromExtendedJson({ $binary: { base64: 'AA==' } }), {
      $binary: { base64: 'AA==' },
    });
  });

  it('rejects malformed wrappers', () => {
    assert.throws(() => fromExtendedJson({ $oid: 12 }), ExtendedJsonError);
    assert.throws(() => fromExtendedJson({ $date: 'not a date' }), ExtendedJsonError);
    assert.throws(() => fromExtendedJson({ $date: { $numberLong: 'x' } }), ExtendedJsonError);
    assert.throws(() => fromExtendedJson({ $numberInt: 'seven' }), ExtendedJsonError);
  });
});
