import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import verifyToken from './verify-jwt';

const SECRET = 'test-secret';
const USER_ID = '507f1f77bcf86cd799439011';

const sign = (payload: object, options: jwt.SignOptions = {}, secret = SECRET): string =>
  jwt.sign(payload, secret, { algorithm: 'HS256', ...options });

describe('verifyToken', () => {
  const originalKey = process.env.JWT_KEY;

  before(() => {
    process.env.JWT_KEY = SECRET;
  });

  after(() => {
    if (originalKey === undefined) delete process.env.JWT_KEY;
    else process.env.JWT_KEY = originalKey;
  });

  it('returns id, accessType and emailAddress for a valid HS256 token', () => {
    const token = sign({ accessType: 'admin', emailAddress: 'user@example.com', id: USER_ID });
    assert.deepEqual(verifyToken(token), {
      accessType: 'admin',
      emailAddress: 'user@example.com',
      id: USER_ID,
    });
  });

  it('drops other claims and sets emailAddress to undefined when absent or not a string', () => {
    assert.deepEqual(verifyToken(sign({ accessType: 'tc', extra: 'x', id: USER_ID })), {
      accessType: 'tc',
      emailAddress: undefined,
      id: USER_ID,
    });
    assert.deepEqual(verifyToken(sign({ accessType: 'tc', emailAddress: 42, id: USER_ID })), {
      accessType: 'tc',
      emailAddress: undefined,
      id: USER_ID,
    });
  });

  it('accepts any non-empty accessType value', () => {
    assert.deepEqual(verifyToken(sign({ accessType: 'unsigned', id: USER_ID })), {
      accessType: 'unsigned',
      emailAddress: undefined,
      id: USER_ID,
    });
  });

  it('rejects ids that are not 24-character hex strings', () => {
    for (const id of ['not-an-object-id', 'aaaaaaaaaaaa', '', `${USER_ID}0`]) {
      assert.equal(verifyToken(sign({ accessType: 'admin', id })), null, id);
    }
  });

  it('rejects an empty accessType', () => {
    assert.equal(verifyToken(sign({ accessType: '', id: USER_ID })), null);
  });

  it('rejects tokens signed with another algorithm', () => {
    const token = jwt.sign({ accessType: 'admin', id: USER_ID }, SECRET, { algorithm: 'HS512' });
    assert.equal(verifyToken(token), null);
  });

  it('rejects unsigned tokens', () => {
    const token = jwt.sign({ accessType: 'admin', id: USER_ID }, '', { algorithm: 'none' });
    assert.equal(verifyToken(token), null);
  });

  it('rejects tokens signed with another secret', () => {
    assert.equal(verifyToken(sign({ accessType: 'admin', id: USER_ID }, {}, 'other')), null);
  });

  it('rejects expired tokens', () => {
    const token = sign({
      accessType: 'admin',
      exp: Math.floor(Date.now() / 1000) - 60,
      id: USER_ID,
    });
    assert.equal(verifyToken(token), null);
  });

  it('rejects payloads missing a string id or accessType', () => {
    for (const payload of [
      { accessType: 'admin' },
      { id: USER_ID },
      { accessType: 'admin', id: 42 },
      { accessType: ['admin'], id: USER_ID },
    ]) {
      assert.equal(verifyToken(sign(payload)), null, JSON.stringify(payload));
    }
  });

  it('rejects string payloads', () => {
    assert.equal(verifyToken(jwt.sign('plain', SECRET, { algorithm: 'HS256' })), null);
  });

  it('rejects garbage and empty tokens', () => {
    assert.equal(verifyToken('garbage'), null);
    assert.equal(verifyToken('a.b.c'), null);
    assert.equal(verifyToken(''), null);
  });

  it('rejects every token when JWT_KEY is unset', () => {
    const token = sign({ accessType: 'admin', id: USER_ID });
    delete process.env.JWT_KEY;
    try {
      assert.equal(verifyToken(token), null);
    } finally {
      process.env.JWT_KEY = SECRET;
    }
  });
});
