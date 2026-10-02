import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isObjectIdString } from '../utils/validation';
import { generateObjectId } from './objectId';

describe('generateObjectId', () => {
  it('produces distinct lowercase 24-hex ids led by the creation time in seconds', () => {
    const now = new Date('2026-10-04T00:00:00.000Z');
    const ids = Array.from({ length: 1000 }, () => generateObjectId(now));
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.ok(isObjectIdString(id) && id === id.toLowerCase(), id);
      assert.equal(parseInt(id.slice(0, 8), 16), now.getTime() / 1000);
    }
  });

  it('sorts ids created later after ids created earlier', () => {
    const earlier = generateObjectId(new Date('2026-01-01T00:00:00.000Z'));
    const later = generateObjectId(new Date('2026-01-01T00:00:01.000Z'));
    assert.ok(earlier < later);
  });
});
