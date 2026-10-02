import jwt from 'jsonwebtoken';

export type TokenUser = {
  id: string;
  accessType: string;
  emailAddress?: string;
};

const verifyToken = (token: string): TokenUser | null => {
  const secret = process.env.JWT_KEY;
  if (!token || !secret) return null;

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (
      typeof payload !== 'object' ||
      typeof payload.id !== 'string' ||
      typeof payload.accessType !== 'string'
    ) {
      return null;
    }
    return {
      id: payload.id,
      accessType: payload.accessType,
      emailAddress: typeof payload.emailAddress === 'string' ? payload.emailAddress : undefined,
    };
  } catch {
    return null;
  }
};

export default verifyToken;
