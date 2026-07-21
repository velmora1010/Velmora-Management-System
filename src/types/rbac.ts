export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  EXECUTIVE: 'Executive',
  STAFF: 'Staff',
  VIEWER: 'Viewer',
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

export const MODULES = {
  DASHBOARD: 'dashboard',
  MARKETING: 'marketing',
  TASKS: 'tasks',
  FINANCE: 'finance',
  VENDORS: 'vendors',
  PURCHASE_ORDERS: 'purchase_orders',
  INVENTORY: 'inventory',
  PRODUCTION: 'production',
  QUALITY_CONTROL: 'quality_control',
  SETTINGS: 'settings',
} as const;

export type AppModule = typeof MODULES[keyof typeof MODULES];

export const ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
} as const;

export type PermissionAction = typeof ACTIONS[keyof typeof ACTIONS];

export interface Role {
  id: string;
  name: AppRole;
  description: string;
}

export interface Permission {
  id: string;
  module: AppModule;
  action: PermissionAction;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}

export interface UserRoleRecord {
  user_id: string;
  role_id: string;
}

export interface UserProfileWithRole {
  id: string;
  email: string;
  full_name?: string;
  role: AppRole;
  is_enabled: boolean;
  created_at?: string;
}

export interface ServiceActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
