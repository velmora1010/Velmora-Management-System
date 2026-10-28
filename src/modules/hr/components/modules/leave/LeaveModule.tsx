import React, { useState, useMemo } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { LeaveRequest, LeaveStatus } from '../../../types/hrms';
import { findLinkedEmployee, doesLeaveBelongToEmployee } from '../../../utils/employeeIdentity';
import { Badge } from '../../common/Badge';
import {
  CalendarDays,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Heart,
  Briefcase,
  Baby,
  Download,
} from 'lucide-react';

interface LeaveModuleProps {
  onOpenApplyLeave: () => void;
  onSelectLeave: (leave: LeaveRequest) => void;
}

export const LeaveModule: React.FC<LeaveModuleProps> = ({
  onOpenApplyLeave,
  onSelectLeave,
}) => {
  const { employees, leaveRequests, settings, approveLeave, rejectLeave } = useHRMS();
  const { currentUser, canApproveLeave, canApplyLeave } = useAuth();

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');

  const authenticatedEmployee = useMemo(
    () => findLinkedEmployee(currentUser, employees),
    [currentUser, employees]
  );

  const roleScopedLeaves = useMemo(() => {
    if (currentUser.role === 'employee') {
      if (!authenticatedEmployee) return [];
      return leaveRequests.filter((leave) => doesLeaveBelongToEmployee(leave, authenticatedEmployee));
    }
    return leaveRequests;
  }, [currentUser.role, authenticatedEmployee, leaveRequests]);

  const filteredLeaves = roleScopedLeaves.filter((leave) => {
    const matchesTab = activeTab === 'all' || leave.status === activeTab;
    const q = search.toLowerCase();
    const matchesSearch =
      leave.employeeName.toLowerCase().includes(q) ||
      leave.departmentName.toLowerCase().includes(q) ||
      leave.reason.toLowerCase().includes(q) ||
      leave.leaveType.toLowerCase().includes(q) ||
      (leave.customLeaveType && leave.customLeaveType.toLowerCase().includes(q));
    return matchesTab && matchesSearch;
  });

  const pendingCount = roleScopedLeaves.filter((l) => l.status === 'pending').length;
  const approvedCount = roleScopedLeaves.filter((l) => l.status === 'approved').length;
  const rejectedCount = roleScopedLeaves.filter((l) => l.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Apply Button */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#172B4D] tracking-tight">
            Leave Management
          </h2>
          <p className="text-xs text-[#64748B]">
            Process time-off applications, vacation requests, and wellness leaves
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee, reason..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>

          {canApplyLeave && (
            <button
              onClick={onOpenApplyLeave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Apply for Leave</span>
            </button>
          )}
        </div>
      </div>

      {/* Leave Allowance Policy Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Annual Vacation
            </span>
            <span className="text-2xl font-black text-[#206DA6] font-mono mt-0.5 block">
              {settings.leaveAllowances.annual} Days
            </span>
            <span className="text-[10px] text-slate-400">Full Paid / Year</span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-[#206DA6]">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Casual Leave
            </span>
            <span className="text-2xl font-black text-[#18A999] font-mono mt-0.5 block">
              {settings.leaveAllowances.casual} Days
            </span>
            <span className="text-[10px] text-slate-400">Personal & Emergency</span>
          </div>
          <div className="p-2.5 rounded-xl bg-teal-50 text-[#18A999]">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Medical / Sick
            </span>
            <span className="text-2xl font-black text-rose-600 font-mono mt-0.5 block">
              {settings.leaveAllowances.sick} Days
            </span>
            <span className="text-[10px] text-slate-400">Health & Wellness</span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
            <Heart className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Maternity / Care
            </span>
            <span className="text-2xl font-black text-purple-600 font-mono mt-0.5 block">
              {settings.leaveAllowances.maternity} Days
            </span>
            <span className="text-[10px] text-slate-400">Parental Benefit</span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <Baby className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2.5 transition-colors ${
            activeTab === 'all'
              ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          All Requests ({roleScopedLeaves.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2.5 transition-colors flex items-center gap-1.5 ${
            activeTab === 'pending'
              ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <span>Pending Approvals</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`pb-2.5 transition-colors ${
            activeTab === 'approved'
              ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          Approved ({approvedCount})
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`pb-2.5 transition-colors ${
            activeTab === 'rejected'
              ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          Rejected ({rejectedCount})
        </button>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Period & Duration</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4">Applied Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    <p className="font-semibold text-slate-600">No leave requests available.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Submit a new leave application to request time off.</p>
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => (
                  <tr
                    key={leave.id}
                    onClick={() => onSelectLeave(leave)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img src={leave.avatar} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200" />
                        <div>
                          <p className="font-bold text-[#172B4D] hover:text-[#206DA6]">{leave.employeeName}</p>
                          <p className="text-[11px] text-slate-500">{leave.departmentName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {leave.leaveType === 'others'
                        ? leave.customLeaveType
                          ? `Others — ${leave.customLeaveType}`
                          : 'Others'
                        : <span className="capitalize">{leave.leaveType}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {leave.startDate} &rarr; {leave.endDate}
                      </span>
                      <span className="block text-[11px] font-mono text-[#206DA6] font-bold">
                        {leave.daysCount} Day{leave.daysCount > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate italic">
                      "{leave.reason}"
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                      {leave.appliedDate}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={leave.status} size="sm">
                        {leave.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {leave.status === 'pending' && canApproveLeave ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => rejectLeave(leave.id, currentUser.name, 'Declined')}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => approveLeave(leave.id, currentUser.name, 'Approved')}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectLeave(leave)}
                          className="text-xs font-bold text-[#206DA6] hover:underline"
                        >
                          View Details &rarr;
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
