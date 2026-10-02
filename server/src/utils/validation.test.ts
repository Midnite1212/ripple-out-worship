import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { describe, it } from 'node:test';
import { isObjectIdString } from './validation';

describe('isObjectIdString', () => {
  it('accepts 24-character hex strings in either case', () => {
    assert.equal(isObjectIdString('507f1f77bcf86cd799439011'), true);
    assert.equal(isObjectIdString('507F1F77BCF86CD799439011'), true);
  });

  it('accepts any 12-character string', () => {
    assert.equal(isObjectIdString('aaaaaaaaaaaa'), true);
    assert.equal(isObjectIdString('zzzzzzzzzzzz'), true);
  });

  it('rejects other strings', () => {
    for (const value of ['', 'abc', '507f1f77bcf86cd79943901', '507f1f77bcf86cd79943901g']) {
      assert.equal(isObjectIdString(value), false, value);
    }
  });

  it('rejects non-string values, including ObjectId instances', () => {
    const values: unknown[] = [
      undefined,
      null,
      42,
      ['507f1f77bcf86cd799439011'],
      { id: '507f1f77bcf86cd799439011' },
      new Types.ObjectId(),
    ];
    for (const value of values) {
      assert.equal(isObjectIdString(value), false);
    }
  });
});
