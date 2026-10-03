import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AccessType, ROUTE_PERMISSIONS } from './permissions.config';
import verifyToken, { TokenUser } from '../utils/verify-jwt';

export interface AuthenticatedRequest extends Request {
  user?: TokenUser;
}

/**
 * Creates a permission middleware based on the route's permission configuration
 */
export const createPermissionMiddleware = (method: string, path: string): RequestHandler[] => {
  const routeKey = `${method.toUpperCase()} ${path}`;
  const config = ROUTE_PERMISSIONS[routeKey];

  if (!config) {
    console.warn(`No permission config found for route: ${routeKey}`);
    return [requireAuth];
  }

  if (!config.requiresAuth) {
    return config.optionalAuth ? [optionalAuth] : [];
  }

  const middlewares: RequestHandler[] = [requireAuth];
  if (config.allowedAccessTypes && config.allowedAccessTypes.length > 0) {
    middlewares.push(requireAccessType(config.allowedAccessTypes));
  }
  return middlewares;
};

const readBearerToken = (req: Request): string | null => {
  const [scheme, token, ...rest] = (req.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token && rest.length === 0 ? token : null;
};

/**
 * Authentication middleware - checks for valid JWT token, i.e. isLoggedIn
 */
const requireAuth: RequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.headers.authorization) {
    return res.status(401).json({
      message: 'Unauthorized',
      error: 'No authorization header provided',
    });
  }

  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({
      message: 'Unauthorized',
      error: 'Invalid authorization header format. Expected: Bearer <token>',
    });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized',
      error: 'Invalid or expired token',
    });
  }

  req.user = user;
  next();
  return;
};

/**
 * Fills req.user when a valid token is present; never rejects the request
 */
const optionalAuth: RequestHandler = (req: AuthenticatedRequest, _res: Response, next) => {
  const token = readBearerToken(req);
  const user = token ? verifyToken(token) : null;
  if (user) req.user = user;
  next();
};

const isAllowedAccessType = (allowedTypes: AccessType[], accessType: string): boolean =>
  allowedTypes.some((allowedType) => allowedType === accessType);

/**
 * Access type middleware factory - checks if user has required access type
 */
const requireAccessType = (allowedTypes: AccessType[]): RequestHandler => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Unauthorized',
        error: 'No user information found',
      });
    }

    if (!isAllowedAccessType(allowedTypes, req.user.accessType)) {
      return res.status(403).json({
        message: 'Forbidden',
        error: 'Access denied',
      });
    }

    next();
    return;
  };
};
