import { ROLES, MODULES, ACTIONS, type AppRole, type AppModule, type PermissionAction } from '../types/rbac';

export const ALL_ROLES: AppRole[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.EXECUTIVE,
  ROLES.STAFF,
  ROLES.VIEWER,
];

export const ALL_MODULES: AppModule[] = [
  MODULES.DASHBOARD,
  MODULES.MARKETING,
  MODULES.TASKS,
  MODULES.FINANCE,
  MODULES.VENDORS,
  MODULES.PURCHASE_ORDERS,
  MODULES.INVENTORY,
  MODULES.PRODUCTION,
  MODULES.QUALITY_CONTROL,
  MODULES.SETTINGS,
];

export const ALL_ACTIONS: PermissionAction[] = [
  ACTIONS.VIEW,
  ACTIONS.CREATE,
  ACTIONS.EDIT,
  ACTIONS.DELETE,
  ACTIONS.APPROVE,
  ACTIONS.EXPORT,
];

// Normalized Default Role-Permission matrix map: Role -> Module -> Action -> boolean
export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, Record<AppModule, Record<PermissionAction, boolean>>> = {
  [ROLES.SUPER_ADMIN]: ALL_MODULES.reduce((acc, mod) => {
    acc[mod] = ALL_ACTIONS.reduce((actAcc, act) => {
      actAcc[act] = true;
      return actAcc;
    }, {} as Record<PermissionAction, boolean>);
    return acc;
  }, {} as Record<AppModule, Record<PermissionAction, boolean>>),

  [ROLES.ADMIN]: ALL_MODULES.reduce((acc, mod) => {
    acc[mod] = ALL_ACTIONS.reduce((actAcc, act) => {
      // Admins have all permissions except editing super admin role management in settings
      actAcc[act] = true;
      return actAcc;
    }, {} as Record<PermissionAction, boolean>);
    return acc;
  }, {} as Record<AppModule, Record<PermissionAction, boolean>>),

  [ROLES.MANAGER]: ALL_MODULES.reduce((acc, mod) => {
    const isSettings = mod === MODULES.SETTINGS;
    acc[mod] = {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: !isSettings,
      [ACTIONS.EDIT]: !isSettings,
      [ACTIONS.DELETE]: false,
      [ACTIONS.APPROVE]: true,
      [ACTIONS.EXPORT]: true,
    };
    return acc;
  }, {} as Record<AppModule, Record<PermissionAction, boolean>>),

  [ROLES.EXECUTIVE]: ALL_MODULES.reduce((acc, mod) => {
    const isSettings = mod === MODULES.SETTINGS;
    acc[mod] = {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: !isSettings,
      [ACTIONS.EDIT]: !isSettings,
      [ACTIONS.DELETE]: false,
      [ACTIONS.APPROVE]: false,
      [ACTIONS.EXPORT]: true,
    };
    return acc;
  }, {} as Record<AppModule, Record<PermissionAction, boolean>>),

  [ROLES.STAFF]: ALL_MODULES.reduce((acc, mod) => {
    const isOperational = [MODULES.TASKS, MODULES.INVENTORY, MODULES.PRODUCTION, MODULES.QUALITY_CONTROL].includes(mod);
    acc[mod] = {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: isOperational,
      [ACTIONS.EDIT]: isOperational,
      [ACTIONS.DELETE]: false,
      [ACTIONS.APPROVE]: false,
      [ACTIONS.EXPORT]: false,
    };
    return acc;
  }, {} as Record<AppModule, Record<PermissionAction, boolean>>),

  [ROLES.VIEWER]: ALL_MODULES.reduce((acc, mod) => {
    acc[mod] = {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: false,
      [ACTIONS.EDIT]: false,
      [ACTIONS.DELETE]: false,
      [ACTIONS.APPROVE]: false,
      [ACTIONS.EXPORT]: false,
    };
    return acc;
  }, {} as Record<AppModule, Record<PermissionAction, boolean>>),
};
