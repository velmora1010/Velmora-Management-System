import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { LeaveRequest } from '../../types/hrms';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';
import { Calendar, CheckCircle, XCircle, Clock, MessageSquare, AlertCircle } from 'lucide-react';

interface LeaveDetailModalProps {
  leave: LeaveRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LeaveDetailModal: React.FC<LeaveDetailModalProps> = ({
  leave,
  isOpen,
  onClose,
}) => {
  const { approveLeave, rejectLeave } = useHRMS();
  const { currentUser, canApproveLeave } = useAuth();
  const [remarks, setRemarks] = useState('');

  if (!leave) return null;

  const handleApprove = () => {
    approveLeave(leave.id, currentUser.name, remarks);
    setRemarks('');
    onClose();
  };

  const handleReject = () => {
    rejectLeave(leave.id, currentUser.name, remarks || 'Request declined by reviewer.');
    setRemarks('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Leave Request Details"
      subtitle={`Application ID: ${leave.id}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Requester Header */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center gap-3">
            <img src={leave.avatar} alt="" className="w-11 h-11 rounded-xl object-cover ring-2 ring-white shadow-xs" />
            <div>
              <h4 className="text-sm font-bold text-[#172B4D]">{leave.employeeName}</h4>
              <p className="text-xs text-slate-500">
                {leave.departmentName} &bull; <span className="font-mono">{leave.employeeCode}</span>
              </p>
            </div>
          </div>
          <Badge variant={leave.status}>{leave.status}</Badge>
        </div>

        {/* Leave Details Card */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-slate-500">Leave Category:</span>
            <span className="font-bold text-[#172B4D] capitalize text-sm">
              {leave.leaveType === 'others' ? 'Others' : `${leave.leaveType} Leave`}
            </span>
          </div>

          {leave.leaveType === 'others' && (
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-slate-500">Custom Leave Type:</span>
              <span className="font-bold text-[#206DA6] text-sm">
                {leave.customLeaveType || '—'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-slate-500">Requested Period:</span>
            <span className="font-semibold text-slate-800">
              {leave.startDate} &rarr; {leave.endDate}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-slate-500">Total Duration:</span>
            <span className="font-bold font-mono text-[#206DA6] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {leave.daysCount} Working Day{leave.daysCount > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Applied Date:</span>
            <span className="font-medium text-slate-700">{leave.appliedDate}</span>
          </div>
        </div>

        {/* Reason Box */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Reason Stated by Employee
          </span>
          <p className="text-xs text-slate-700 leading-relaxed italic">"{leave.reason}"</p>
        </div>

        {/* Existing Review Info if processed */}
        {leave.status !== 'pending' && (
          <div
            className={`p-3.5 rounded-xl border text-xs ${
              leave.status === 'approved'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/70 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold mb-1">
              {leave.status === 'approved' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>
                {leave.status === 'approved' ? 'Approved' : 'Rejected'} by {leave.reviewedBy || 'HR Admin'}
              </span>
            </div>
            {leave.reviewedDate && (
              <span className="text-[10px] opacity-75 block mb-1">Reviewed on {leave.reviewedDate}</span>
            )}
            {leave.reviewRemarks && (
              <p className="text-[11px] mt-1 bg-white/60 p-2 rounded-lg italic">
                "{leave.reviewRemarks}"
              </p>
            )}
          </div>
        )}

        {/* Review Workflow Controls (if pending & authorized) */}
        {leave.status === 'pending' && canApproveLeave && (
          <div className="pt-2 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-[#206DA6]" /> Reviewer Remarks (Optional)
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Approved. Team schedule covered."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleReject}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
              >
                <XCircle className="w-4 h-4" /> Reject Request
              </button>

              <button
                type="button"
                onClick={handleApprove}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all"
              >
                <CheckCircle className="w-4 h-4" /> Approve Leave
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
