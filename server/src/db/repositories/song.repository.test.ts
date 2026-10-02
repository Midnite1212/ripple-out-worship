import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { containsPattern } from './song.repository';

describe('containsPattern', () => {
  it('wraps the text in wildcards, escaping LIKE wildcards and the escape character', () => {
    assert.equal(containsPattern('a.b*(1)'), '%a.b*(1)%');
    assert.equal(containsPattern('50%_off\\'), '%50\\%\\_off\\\\%');
  });
});
