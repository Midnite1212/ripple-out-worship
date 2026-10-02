import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isObjectIdString, toObjectIdList } from './validation';

describe('isObjectIdString', () => {
  it('accepts 24-character hex strings in either case', () => {
    assert.equal(isObjectIdString('507f1f77bcf86cd799439011'), true);
    assert.equal(isObjectIdString('507F1F77BCF86CD799439011'), true);
  });

  it('rejects 12-character strings that Mongoose would accept', () => {
    assert.equal(isObjectIdString('aaaaaaaaaaaa'), false);
    assert.equal(isObjectIdString('zzzzzzzzzzzz'), false);
    assert.equal(isObjectIdString('507f1f77bcf8'), false);
  });

  it('rejects other strings', () => {
    for (const value of [
      '',
      'abc',
      '507f1f77bcf86cd79943901',
      '507f1f77bcf86cd79943901g',
      '507f1f77bcf86cd7994390111',
      ' 507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439011\n',
    ]) {
      assert.equal(isObjectIdString(value), false, value);
    }
  });

  it('rejects non-string values, including objects that stringify to an id', () => {
    const values: unknown[] = [
      undefined,
      null,
      42,
      ['507f1f77bcf86cd799439011'],
      { id: '507f1f77bcf86cd799439011' },
      { toString: () => '507f1f77bcf86cd799439011' },
    ];
    for (const value of values) {
      assert.equal(isObjectIdString(value), false);
    }
  });
});

describe('toObjectIdList', () => {
  it('treats a missing value as an empty list and a single id as a one-item list', () => {
    assert.deepEqual(toObjectIdList(undefined), []);
    assert.deepEqual(toObjectIdList(null), []);
    assert.deepEqual(toObjectIdList('507f1f77bcf86cd799439011'), ['507f1f77bcf86cd799439011']);
  });

  it('lowercases and de-duplicates ids, keeping first-seen order', () => {
    assert.deepEqual(
      toObjectIdList([
        '507F1F77BCF86CD799439012',
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      ]),
      ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439011']
    );
  });

  it('rejects a list with any value that is not a 24-hex id', () => {
    for (const value of [['507f1f77bcf86cd799439011', 'bad'], [1], 'bad', { id: 'x' }]) {
      assert.equal(toObjectIdList(value), null, JSON.stringify(value));
    }
  });
});
