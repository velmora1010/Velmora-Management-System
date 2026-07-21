import React, { useState, useEffect } from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import { rbacService } from '../../services/rbacService';
import { ROLES, MODULES, ACTIONS, type AppRole, type AppModule, type PermissionAction, type UserProfileWithRole } from '../../types/rbac';
import { ALL_ROLES, ALL_MODULES, ALL_ACTIONS } from '../../config/rbacDefaults';
import { Shield, Users, Lock, CheckCircle, XCircle, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export const UserRoleManagement: React.FC = () => {
  const { role: currentRole, refreshPermissions } = useRBAC();
  const [activeTab, setActiveTab] = useState<'users' | 'matrix'>('users');
  const [users, setUsers] = useState<UserProfileWithRole[]>([]);
  const [permissionMatrix, setPermissionMatrix] = useState<Record<AppRole, Record<AppModule, Record<PermissionAction, boolean>>> | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>(ROLES.MANAGER);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isSuperAdmin = currentRole === ROLES.SUPER_ADMIN;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await rbacService.getAllUsers();
      setUsers(fetchedUsers);

      const matrix = await rbacService.getRolePermissionsMatrix();
      setPermissionMatrix(matrix);
    } catch (err) {
      console.error('Failed to load RBAC admin data:', err);
      toast.error('Failed to load access control data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole, currentEnabled: boolean) => {
    if (!isSuperAdmin) {
      return toast.error('Only Super Admins can assign user roles.');
    }
    try {
      const res = await rbacService.updateUserRole(userId, newRole, currentEnabled);
      if (res.success) {
        toast.success(`Role updated to ${newRole}`);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        await refreshPermissions();
      } else {
        toast.error(res.error || 'Failed to update role');
      }
    } catch (e) {
      toast.error('Failed to update role');
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean, userRole: AppRole) => {
    if (!isSuperAdmin) {
      return toast.error('Only Super Admins can disable user access.');
    }
    const newStatus = !currentStatus;
    try {
      const res = await rbacService.updateUserRole(userId, userRole, newStatus);
      if (res.success) {
        toast.success(`User ${newStatus ? 'enabled' : 'disabled'}`);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_enabled: newStatus } : u));
        await refreshPermissions();
      } else {
        toast.error(res.error || 'Failed to update user status');
      }
    } catch (e) {
      toast.error('Failed to toggle status');
    }
  };

  const handleTogglePermission = async (module: AppModule, action: PermissionAction) => {
    if (!isSuperAdmin) {
      return toast.error('Only Super Admins can modify the role permission matrix.');
    }
    if (!permissionMatrix) return;

    const currentVal = Boolean(permissionMatrix[selectedRole]?.[module]?.[action]);
    const newVal = !currentVal;

    // Optimistic UI update
    setPermissionMatrix(prev => {
      if (!prev) return prev;
      const copy = JSON.parse(JSON.stringify(prev));
      copy[selectedRole][module][action] = newVal;
      return copy;
    });

    setIsSaving(true);
    try {
      const res = await rbacService.updateRolePermission(selectedRole, module, action, newVal);
      if (res.success) {
        toast.success(`Permission updated for ${selectedRole}`);
        await refreshPermissions();
      } else {
        toast.error(res.error || 'Failed to update permission');
        loadData(); // Revert on failure
      }
    } catch (e) {
      toast.error('Error saving permission');
      loadData();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSuperAdmin && currentRole !== ROLES.ADMIN) {
    return (
      <div className="p-8 text-center bg-card border border-border rounded-xl space-y-4">
        <Lock className="mx-auto text-rose-500" size={48} />
        <h2 className="text-xl font-bold text-main">Access Restricted</h2>
        <p className="text-muted text-sm max-w-md mx-auto">
          User & Role Management is restricted to Super Admins. Please contact your system administrator if you require permissions adjustments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="text-indigo-500" size={24} />
            <h2 className="text-xl font-bold text-main">User & Role Management</h2>
          </div>
          <p className="text-muted text-sm">Configure system access permissions, assign roles, and manage user accounts.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={16} />
            User Accounts ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'matrix' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock size={16} />
            Role Permission Matrix
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-16 text-muted gap-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading RBAC configuration...</span>
        </div>
      ) : activeTab === 'users' ? (
        /* User Accounts View */
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900/40 border-b border-border text-xs uppercase tracking-wider text-muted font-semibold">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Assigned Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-main">{u.full_name || 'User'}</div>
                      <div className="text-xs text-muted font-mono">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        disabled={!isSuperAdmin || u.role === ROLES.SUPER_ADMIN}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole, u.is_enabled)}
                        className="bg-slate-900 border border-slate-700 text-main rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        u.is_enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {u.is_enabled ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {u.is_enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        disabled={!isSuperAdmin || u.role === ROLES.SUPER_ADMIN}
                        onClick={() => handleToggleStatus(u.id, u.is_enabled, u.role)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          u.is_enabled
                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {u.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Role Permission Matrix Editor */
        <div className="space-y-6">
          {/* Role Selector Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted">Select Role to Edit:</span>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRole(r)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedRole === r
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono animate-pulse">
                <Save size={14} /> Saving updates...
              </span>
            )}
          </div>

          {/* Matrix Grid */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-border text-xs uppercase tracking-wider text-muted font-semibold">
                    <th className="px-6 py-4">Module</th>
                    {ALL_ACTIONS.map((action) => (
                      <th key={action} className="px-4 py-4 text-center">{action}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ALL_MODULES.map((mod) => (
                    <tr key={mod} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-main capitalize">
                        {mod.replace('_', ' ')}
                      </td>
                      {ALL_ACTIONS.map((action) => {
                        const isAllowed = Boolean(permissionMatrix?.[selectedRole]?.[mod]?.[action]);
                        const isSuperAdminRole = selectedRole === ROLES.SUPER_ADMIN;

                        return (
                          <td key={action} className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              disabled={!isSuperAdmin || isSuperAdminRole}
                              onChange={() => handleTogglePermission(mod, action)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
