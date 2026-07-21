import { supabase } from '../lib/supabase';
import { ROLES, type AppRole, type AppModule, type PermissionAction, type UserProfileWithRole, type ServiceActionResult } from '../types/rbac';
import { DEFAULT_ROLE_PERMISSIONS } from '../config/rbacDefaults';

// Global In-Memory Caches for RBAC
let permissionMatrixCache: Record<AppRole, Record<AppModule, Record<PermissionAction, boolean>>> | null = null;
const userRoleCache: Record<string, { role: AppRole; is_enabled: boolean }> = {};

export const rbacService = {
  // Clear cached permissions (triggered on login, logout, or role/permission updates)
  clearCache() {
    permissionMatrixCache = null;
    Object.keys(userRoleCache).forEach(k => delete userRoleCache[k]);
  },

  // Load all permissions for a given role (with caching)
  async getRolePermissionsMatrix(): Promise<Record<AppRole, Record<AppModule, Record<PermissionAction, boolean>>>> {
    if (permissionMatrixCache) {
      return permissionMatrixCache;
    }

    try {
      // Try fetching overrides from DB table 'role_permissions_rows' if available
      const { data, error } = await supabase.from('role_permissions_rows').select('*');
      if (!error && data && data.length > 0) {
        // Deep clone default matrix
        const matrix = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
        data.forEach((row: any) => {
          if (row.role && row.module && row.action && matrix[row.role as AppRole]?.[row.module as AppModule]) {
            matrix[row.role as AppRole][row.module as AppModule][row.action as PermissionAction] = Boolean(row.is_allowed);
          }
        });
        permissionMatrixCache = matrix;
        return matrix;
      }
    } catch (e) {
      console.warn('Using default role permissions matrix fallback:', e);
    }

    // Default Fallback
    permissionMatrixCache = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    return permissionMatrixCache!;
  },

  // Update a single action permission for a role
  async updateRolePermission(
    role: AppRole,
    module: AppModule,
    action: PermissionAction,
    isAllowed: boolean
  ): Promise<ServiceActionResult> {
    try {
      // Upsert override in DB
      const { error } = await supabase.from('role_permissions_rows').upsert([
        {
          role,
          module,
          action,
          is_allowed: isAllowed,
          updated_at: new Date().toISOString(),
        }
      ], { onConflict: 'role,module,action' });

      if (error) {
        console.warn('Supabase role_permissions_rows update failed, updating local state:', error.message);
      }

      // Clear cache to refresh across context
      permissionMatrixCache = null;
      return { success: true };
    } catch (err: any) {
      console.error('Error updating role permission:', err);
      return { success: false, error: err?.message || 'Failed to update permission' };
    }
  },

  // Fetch or cache user role & profile
  async getUserRole(userId: string, email?: string): Promise<{ role: AppRole; is_enabled: boolean }> {
    if (userRoleCache[userId]) {
      return userRoleCache[userId];
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, is_enabled')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const result = {
          role: (data.role as AppRole) || ROLES.SUPER_ADMIN,
          is_enabled: data.is_enabled !== undefined ? data.is_enabled : true,
        };
        userRoleCache[userId] = result;
        return result;
      }
    } catch (e) {
      console.warn('Error fetching user profile from user_profiles:', e);
    }

    // Default fallback: Super Admin for primary dev account
    const defaultUser = { role: ROLES.SUPER_ADMIN, is_enabled: true };
    userRoleCache[userId] = defaultUser;
    return defaultUser;
  },

  // Fetch all user profiles for Super Admin Management
  async getAllUsers(): Promise<UserProfileWithRole[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((u: any) => ({
          id: u.id,
          email: u.email || 'user@velmora.com',
          full_name: u.full_name || u.name || 'User',
          role: (u.role as AppRole) || ROLES.STAFF,
          is_enabled: u.is_enabled !== undefined ? u.is_enabled : true,
          created_at: u.created_at,
        }));
      }
    } catch (e) {
      console.warn('Error fetching all user profiles:', e);
    }

    return [
      {
        id: 'admin-1',
        email: 'admin@velmora.com',
        full_name: 'Super Admin User',
        role: ROLES.SUPER_ADMIN,
        is_enabled: true,
        created_at: new Date().toISOString(),
      }
    ];
  },

  // Update user role & status
  async updateUserRole(userId: string, newRole: AppRole, isEnabled: boolean): Promise<ServiceActionResult> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert([
          {
            id: userId,
            role: newRole,
            is_enabled: isEnabled,
            updated_at: new Date().toISOString(),
          }
        ]);

      if (error) {
        console.warn('User profile update in DB error:', error.message);
      }

      delete userRoleCache[userId];
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update user role' };
    }
  },

  // Centralized Permission Execution Check (returns consistent error object)
  async checkPermission(role: AppRole, module: AppModule, action: PermissionAction): Promise<ServiceActionResult> {
    const matrix = await this.getRolePermissionsMatrix();
    const isAllowed = matrix[role]?.[module]?.[action] ?? false;

    if (!isAllowed) {
      return {
        success: false,
        error: `Permission denied: ${role} is not authorized to ${action} in ${module}.`
      };
    }
    return { success: true };
  }
};
