import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Bell,
  Clock,
  UserCheck,
  ChevronDown,
  LogOut,
  Calendar,
  UserCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import { NavigationTab } from './Sidebar';
import { UserRole } from '../../types/hrms';
import { findLinkedEmployee } from '../../utils/employeeIdentity';
import { Avatar } from '../common/Avatar';
import { supabase } from '../../../../lib/supabase';

interface TopNavProps {
  currentTab: NavigationTab;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onOpenCheckIn: () => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  onOpenMyProfile?: () => void;
  onOpenMyProfileProductSelect?: () => void;
  onOpenEmployeeLogin?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  onToggleSidebar,
  onOpenSearch,
  onOpenCheckIn,
  onNavigateTab,
  onOpenMyProfile,
  onOpenMyProfileProductSelect,
  onOpenEmployeeLogin,
}) => {
  const {
    currentUser,
    allUsers,
    switchUser,
    switchRole,
    canManageEmployees,
    activeHRAccountType,
    clearEmployeeSession,
  } = useAuth();
  const {
    employees,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    attendanceRecords,
    selectedDate,
  } = useHRMS();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const linkedEmployee = React.useMemo(
    () => findLinkedEmployee(currentUser, employees),
    [currentUser, employees]
  );

  const scopedNotifications = React.useMemo(() => {
    const isAdminOrHR = currentUser.role === 'admin' || currentUser.role === 'hr_manager' || currentUser.role === 'dept_head';
    return notifications.filter((n) => {
      if (n.targetRole === 'admin') return isAdminOrHR;
      if (n.targetRole === 'employee') {
        if (isAdminOrHR) return false;
        if (!n.recipientEmployeeId && !n.recipientUserId) return true;
      }
      if (n.recipientUserId && n.recipientUserId === currentUser.id) return true;
      if (n.recipientEmployeeId) {
        if (!linkedEmployee) return false;
        const recUpper = n.recipientEmployeeId.trim().toUpperCase();
        return (
          recUpper === linkedEmployee.id.trim().toUpperCase() ||
          recUpper === linkedEmployee.employeeCode.trim().toUpperCase()
        );
      }
      return isAdminOrHR;
    });
  }, [notifications, currentUser, linkedEmployee]);

  const unreadNotifs = scopedNotifications.filter((n) => !n.read);

  // Check if current user is checked in or checked out today
  const myAttendance = attendanceRecords.find(
    (a) =>
      (a.employeeId === linkedEmployee?.id ||
        a.employeeId === currentUser.employeeId ||
        (a.employeeCode &&
          linkedEmployee?.employeeCode &&
          a.employeeCode.toUpperCase() === linkedEmployee.employeeCode.toUpperCase())) &&
      a.date === selectedDate
  );
  const isClockedIn = !!myAttendance?.checkInTime && !myAttendance?.checkOutTime;
  const isClockedOut = !!myAttendance?.checkInTime && !!myAttendance?.checkOutTime;

  const tabTitles: Record<NavigationTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'HR Dashboard', subtitle: 'Real-time overview of workforce & operations' },
    employees: { title: 'Employee Directory', subtitle: 'Manage staff profiles, contracts, and records' },
    attendance: { title: 'Attendance Register', subtitle: 'Track clock-ins, daily logs, and work hours' },
    departments: { title: 'Department Structure', subtitle: 'Organizational hierarchy, heads, and budgets' },
    leave: { title: 'Leave Management', subtitle: 'Review, approve, and track employee leave requests' },
    shifts: { title: 'Shift Scheduling', subtitle: 'Manage rotational shifts, rosters, and schedules' },
    'work-assignment': { title: 'Work Assignment', subtitle: 'Assign and manage employee daily work tasks' },
    'assigned-works': {
      title: 'Assigned Works',
      subtitle: canManageEmployees
        ? 'Monitor employee assignments, acknowledgements, and task completion.'
        : 'View your assigned tasks, acknowledge instructions, and update completion.',
    },
    'employee-welfare': { title: 'Employee Welfare', subtitle: 'Select your monthly welfare product and track distribution history.' },
    payroll: { title: 'Salary & Payroll', subtitle: 'Generate payslips, process allowances, and taxes' },
    reports: { title: 'Analytics & Reports', subtitle: 'Comprehensive HR insights and performance metrics' },
    settings: { title: 'System Settings', subtitle: 'Company profile, fiscal calendars, and policies' },
    'my-profile': { title: 'My Profile', subtitle: 'View verified personal information and company records' },
    'product-select': { title: 'Monthly Product Select', subtitle: 'Select your monthly employee welfare product' },
  };

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    admin: { label: 'Administrator', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
    hr_manager: { label: 'HR Manager', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    dept_head: { label: 'Dept Head', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
    employee: { label: 'Employee', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-card/90 backdrop-blur-md border-b border-border px-4 sm:px-6 flex items-center justify-between transition-all">
      {/* Left: Mobile Menu & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-muted hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
            {tabTitles[currentTab]?.title || 'Dashboard'}
          </h1>
          <p className="text-xs text-muted hidden md:block">
            {tabTitles[currentTab]?.subtitle}
          </p>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-900/60 hover:bg-slate-900/90 text-slate-400 rounded-xl border border-border transition-all text-xs text-left group shadow-xs"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
            <span className="truncate group-hover:text-slate-300">Search employees, departments, records...</span>
          </span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700 rounded font-mono text-slate-300">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Punch Button, Notification Center, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Attendance Punch Button */}
        <button
          onClick={onOpenCheckIn}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            isClockedOut
              ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
              : isClockedIn
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
              : 'bg-slate-900/60 text-slate-300 border-border hover:border-primary hover:text-primary'
          }`}
          title="Attendance Punch"
        >
          <Clock
            className={`w-4 h-4 ${
              isClockedOut ? 'text-primary' : isClockedIn ? 'text-emerald-400' : 'text-slate-400'
            }`}
          />
          <span className="hidden md:inline">
            {isClockedOut
              ? 'Checked Out'
              : isClockedIn
              ? `Checked In (${myAttendance?.checkInTime?.substring(0, 5)})`
              : 'Check In/Out'}
          </span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-xl text-muted hover:text-white hover:bg-white/5 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifs.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-card" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-sidebar rounded-2xl shadow-2xl border border-border py-2 z-50 animate-fade-in text-white">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">Notifications</span>
                  {unreadNotifs.length > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {unreadNotifs.length} new
                    </span>
                  )}
                </div>
                {unreadNotifs.length > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                {scopedNotifications.length === 0 ? (
                  <p className="text-xs text-muted p-6 text-center">No notifications</p>
                ) : (
                  scopedNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markNotificationRead(notif.id);
                        if (notif.type === 'attendance') {
                          onNavigateTab?.('attendance');
                          setIsNotifOpen(false);
                        } else if (notif.type === 'work_assigned') {
                          onNavigateTab?.(canManageEmployees ? 'work-assignment' : 'assigned-works');
                          setIsNotifOpen(false);
                        } else if (notif.type === 'welfare') {
                          if (canManageEmployees) {
                            onNavigateTab?.('employee-welfare');
                          } else if (onOpenMyProfileProductSelect) {
                            onOpenMyProfileProductSelect();
                          } else {
                            onOpenMyProfile?.();
                          }
                          setIsNotifOpen(false);
                        }
                      }}
                      className={`p-3.5 hover:bg-white/5 cursor-pointer transition-colors flex items-start gap-3 ${
                        !notif.read ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          !notif.read ? 'bg-primary' : 'bg-transparent'
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-white">{notif.title}</p>
                        <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{notif.message}</p>
                        <span className="text-[10px] text-slate-500 mt-1 block">{notif.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separate Employee Login Button */}
        {activeHRAccountType === 'admin' ? (
          <button
            type="button"
            onClick={onOpenEmployeeLogin}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl transition-all shadow-xs cursor-pointer"
            title="Employee Self-Service Login"
          >
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span className="font-medium">Employee Login</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              clearEmployeeSession();
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 rounded-xl transition-all shadow-xs cursor-pointer"
            title="Exit Employee Mode and Return to Admin"
          >
            <LogOut className="w-4 h-4 text-amber-400" />
            <span className="font-medium">Exit Employee Mode</span>
          </button>
        )}

        {/* Administrator Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-white/5 transition-colors"
          >
            <Avatar
              src={currentUser.avatar}
              name={currentUser.name}
              size="sm"
              className="ring-2 ring-primary/30 shadow-xs"
            />
            <div className="hidden lg:block text-left">
              <span className="block text-xs font-bold text-white leading-tight">
                {currentUser.name}
              </span>
              <span className="text-[11px] text-muted block truncate max-w-[130px]">
                {currentUser.title}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted hidden lg:block" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-sidebar rounded-2xl shadow-2xl border border-border p-2 z-50 animate-fade-in text-white">
              {/* Profile Card */}
              <div className="p-3 bg-slate-900/60 rounded-xl mb-2 border border-border">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={currentUser.avatar}
                    name={currentUser.name}
                    size="md"
                    className="shadow-xs"
                  />
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-muted truncate">{currentUser.email}</p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleLabels[currentUser.role].color}`}
                    >
                      {roleLabels[currentUser.role].label}
                    </span>
                  </div>
                </div>
              </div>

              {/* My Profile Action */}
              {onOpenMyProfile && (
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenMyProfile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors mb-1 cursor-pointer"
                >
                  <UserCircle className="w-4 h-4 text-primary" />
                  <span>My Profile</span>
                </button>
              )}

              {/* Logout Action */}
              <button
                onClick={async () => {
                  setIsProfileOpen(false);
                  if (activeHRAccountType === 'employee') {
                    clearEmployeeSession();
                  } else {
                    await supabase.auth.signOut();
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
