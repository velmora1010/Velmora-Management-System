import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Building2,
  CalendarDays,
  Clock,
  CircleDollarSign,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ClipboardList,
  ClipboardCheck,
  HeartHandshake,
} from 'lucide-react';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { useWorkAssignment } from '../../context/WorkAssignmentContext';
import { findLinkedEmployee, doesAssignmentBelongToEmployee } from '../../utils/employeeIdentity';

export type NavigationTab =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'departments'
  | 'leave'
  | 'shifts'
  | 'work-assignment'
  | 'assigned-works'
  | 'employee-welfare'
  | 'payroll'
  | 'reports'
  | 'settings'
  | 'my-profile'
  | 'product-select';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { dashboardMetrics, leaveRequests, employees } = useHRMS();
  const { currentUser, canViewPayroll, canManageEmployees } = useAuth();
  const { summaryMetrics, taskAssignments } = useWorkAssignment();

  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending').length;

  const assignedWorksBadge = React.useMemo(() => {
    if (canManageEmployees) {
      return null;
    }
    const ownEmp = findLinkedEmployee(currentUser, employees);
    if (!ownEmp) return null;
    const seenTaskIds = new Set<string>();
    let personalPending = 0;
    taskAssignments.forEach((a) => {
      if (doesAssignmentBelongToEmployee(a, ownEmp)) {
        const key = a.taskId || a.id;
        if (!seenTaskIds.has(key)) {
          seenTaskIds.add(key);
          if (a.status !== 'completed' && a.status !== 'cancelled') {
            personalPending++;
          }
        }
      }
    });
    return personalPending > 0 ? personalPending : null;
  }, [canManageEmployees, currentUser, employees, taskAssignments]);

  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'employees' as NavigationTab,
      label: 'Employees',
      icon: Users,
      badge: dashboardMetrics.totalEmployees,
    },
    {
      id: 'attendance' as NavigationTab,
      label: 'Attendance',
      icon: CalendarCheck,
      badge: `${dashboardMetrics.presentToday}/${dashboardMetrics.totalEmployees}`,
    },
    {
      id: 'departments' as NavigationTab,
      label: 'Departments',
      icon: Building2,
      badge: dashboardMetrics.totalDepartments,
    },
    {
      id: 'leave' as NavigationTab,
      label: 'Leave Management',
      icon: CalendarDays,
      badge: pendingLeaves > 0 ? pendingLeaves : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'shifts' as NavigationTab,
      label: 'Shift Management',
      icon: Clock,
      badge: null,
    },
    {
      id: 'work-assignment' as NavigationTab,
      label: 'Work Assignment',
      icon: ClipboardList,
      badge: null,
    },
    {
      id: 'assigned-works' as NavigationTab,
      label: 'Assigned Works',
      icon: ClipboardCheck,
      badge: assignedWorksBadge,
      badgeColor: 'bg-[#206DA6] text-white',
    },
    {
      id: 'employee-welfare' as NavigationTab,
      label: 'Employee Welfare',
      icon: HeartHandshake,
      badge: null,
    },
    {
      id: 'payroll' as NavigationTab,
      label: 'Salary / Payroll',
      icon: CircleDollarSign,
      badge: canViewPayroll ? 'Active' : 'Locked',
      restricted: !canViewPayroll,
    },
    {
      id: 'reports' as NavigationTab,
      label: 'Reports',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  // Administrator login: Show Work Assignment & Employee Welfare; Hide Assigned Works.
  // Employee login: Show Assigned Works; Hide Work Assignment & standalone Employee Welfare.
  const visibleNavItems = navItems.filter(
    (item) =>
      (item.id !== 'employee-welfare' || canManageEmployees) &&
      (item.id !== 'work-assignment' || canManageEmployees) &&
      (item.id !== 'assigned-works' || !canManageEmployees)
  );

  return (
    <aside
      className={`relative bg-white border-r border-slate-200/80 flex flex-col transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#206DA6] to-[#18A999] flex items-center justify-center text-white font-bold shadow-md shadow-[#206DA6]/20 flex-shrink-0">
            HR
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <span className="font-extrabold text-[#172B4D] tracking-tight text-base block">
                Human Resources
              </span>
              <span className="text-[11px] font-medium text-[#18A999] tracking-wider uppercase block">
                Enterprise HRMS
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-[#206DA6] text-white shadow-md shadow-[#206DA6]/25'
                  : 'text-slate-600 hover:text-[#172B4D] hover:bg-slate-100/80'
              }`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-white' : 'text-slate-500 group-hover:text-[#206DA6]'
                }`}
              />

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between truncate text-left">
                  <span className="truncate">{item.label}</span>

                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold transition-colors ${
                        item.badgeColor
                          ? item.badgeColor
                          : isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {item.restricted && (
                    <ShieldAlert className="w-4 h-4 text-slate-400 ml-1.5" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / System Status */}
      <div className="p-3 border-t border-slate-100">
        <div
          className={`rounded-xl p-3 bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-100 ${
            isCollapsed ? 'text-center' : ''
          }`}
        >
          {!isCollapsed ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#172B4D]">Live Database</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] text-slate-500">Connected & Synced</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-600">
                v2.6
              </span>
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Database Connected" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
