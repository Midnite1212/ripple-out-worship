export type AccessType = 'ministry' | 't3ch' | 'tc' | 'admin';

export type PermissionConfig =
  | {
      requiresAuth: true;
      allowedAccessTypes?: AccessType[];
      description?: string;
    }
  | {
      requiresAuth: false;
      optionalAuth?: boolean;
      description?: string;
    };

// Centralized permissions configuration
/**
 * By default, there is a hierarchy in this accessTypes
 * Admin > tc > t3ch > ministry > isLoggedIn (requiresAuth)
 * But this permission schema will not follow the ones in the main web.
 * It will use the more conventional approach, i.e. only the access types listed can access it.
 * Please make sure the proper access level are listed.
 */

const ALL_ACCESS_TYPES: AccessType[] = ['ministry', 't3ch', 'tc', 'admin'];

// TODO: Confirm on which access types can do what
export const ROUTE_PERMISSIONS: Record<string, PermissionConfig> = {
  // Ownership routes
  'POST /api/ownerships/create': {
    requiresAuth: true,
    description: 'Create ownership record',
  },
  'GET /api/ownerships/get': {
    requiresAuth: true,
    description: 'View ownership records',
  },
  'PUT /api/ownerships/update': {
    requiresAuth: true,
    description: 'Update ownership record',
  },
  'PUT /api/ownerships/delete': {
    requiresAuth: true,
    description: 'Delete ownership record',
  },

  // Group routes
  'POST /api/groups/create': {
    requiresAuth: true,
    description: 'Create new group',
  },
  'GET /api/groups/get': {
    requiresAuth: true,
    description: 'View groups',
  },
  'PUT /api/groups/update': {
    requiresAuth: true,
    description: 'Update group',
  },
  'PUT /api/groups/members': {
    requiresAuth: true,
    description: 'Add or remove group members',
  },
  'PUT /api/groups/delete': {
    requiresAuth: true,
    description: 'Delete group',
  },

  // Setlist routes
  'POST /api/setlists/create': {
    requiresAuth: true,
    description: 'Create new setlist',
  },
  'GET /api/setlists/get': {
    requiresAuth: false,
    optionalAuth: true,
    description: 'View setlists',
  },
  'PUT /api/setlists/update': {
    requiresAuth: true,
    description: 'Update setlist',
  },
  'PUT /api/setlists/delete': {
    requiresAuth: true,
    description: 'Delete setlist',
  },

  // Song routes
  'POST /api/songs/create': {
    requiresAuth: true,
    allowedAccessTypes: ALL_ACCESS_TYPES,
    description: 'Create new song',
  },
  'GET /api/songs/get': {
    requiresAuth: false,
    description: 'View songs (admin view)',
  },
  'GET /api/songs/get-view': {
    requiresAuth: false, // Public view
    description: 'Public song view',
  },
  'PUT /api/songs/update': {
    requiresAuth: true,
    allowedAccessTypes: ALL_ACCESS_TYPES,
    description: 'Update song',
  },
  'PUT /api/songs/delete': {
    requiresAuth: true,
    allowedAccessTypes: ALL_ACCESS_TYPES,
    description: 'Delete song',
  },
  'GET /api/songs/search': {
    requiresAuth: false,
    description: 'Search songs',
  },
};
