import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LeaveType } from '../../types/hrms';
import { findLinkedEmployee } from '../../utils/employeeIdentity';

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({ isOpen, onClose }) => {
  const { employees, applyLeave, selectedDate } = useHRMS();
  const { currentUser, canApplyLeave } = useAuth();
  const { showToast } = useToast();

  // Always resolve the employee profile directly from the authenticated user's linked employeeId
  const authenticatedEmployee = useMemo(
    () => findLinkedEmployee(currentUser, employees),
    [currentUser, employees]
  );

  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [customLeaveType, setCustomLeaveType] = useState('');
  const [customTypeError, setCustomTypeError] = useState('');
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(selectedDate);
  const [reason, setReason] = useState('');
  const [daysCount, setDaysCount] = useState(1);
  const [error, setError] = useState('');

  // Clear validation errors when current user changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setError('');
      setCustomTypeError('');
    }
  }, [isOpen, currentUser.id]);

  // Recalculate duration when dates change
  useEffect(() => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setDaysCount(diffDays > 0 ? diffDays : 1);
    } catch {
      setDaysCount(1);
    }
  }, [startDate, endDate]);

  if (!canApplyLeave) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!authenticatedEmployee) {
      const missingLinkMsg = 'Your user account is not linked to an employee profile. Please contact HR.';
      setError(missingLinkMsg);
      showToast(missingLinkMsg, 'error');
      return;
    }

    let hasValidationError = false;

    if (leaveType === 'others' && !customLeaveType.trim()) {
      setCustomTypeError('Please specify your leave type.');
      hasValidationError = true;
    }

    if (!startDate || !endDate || endDate < startDate) {
      setError('End date cannot be earlier than start date.');
      hasValidationError = true;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the leave request.');
      hasValidationError = true;
    }

    if (hasValidationError) return;

    const saved = applyLeave({
      employeeId: authenticatedEmployee.id,
      employeeName: authenticatedEmployee.fullName,
      employeeCode: authenticatedEmployee.employeeCode,
      departmentId: authenticatedEmployee.departmentId,
      departmentName: authenticatedEmployee.departmentName,
      avatar: authenticatedEmployee.avatar,
      leaveType,
      customLeaveType: leaveType === 'others' ? customLeaveType.trim() : undefined,
      startDate,
      endDate,
      daysCount,
      reason: reason.trim(),
    });

    if (saved) {
      setLeaveType('annual');
      setCustomLeaveType('');
      setCustomTypeError('');
      setReason('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      subtitle="Submit request for manager & HR review"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Employee Name
          </label>
          {authenticatedEmployee ? (
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-[#172B4D] flex items-center justify-between gap-2">
              <span className="truncate">{authenticatedEmployee.fullName}</span>
              <span className="text-xs font-mono text-slate-500 flex-shrink-0">
                {authenticatedEmployee.departmentName} &bull; {authenticatedEmployee.employeeCode}
              </span>
            </div>
          ) : (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              Your user account is not linked to an employee profile. Please contact HR.
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Leave Category
          </label>
          <select
            value={leaveType}
            onChange={(e) => {
              const nextType = e.target.value as LeaveType;
              setLeaveType(nextType);
              if (nextType !== 'others') {
                setCustomTypeError('');
              }
            }}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
          >
            <option value="annual">Annual Vacation</option>
            <option value="casual">Casual Leave</option>
            <option value="sick">Medical / Sick Leave</option>
            <option value="maternity">Maternity / Care Leave</option>
            <option value="paternity">Paternity Leave</option>
            <option value="unpaid">Unpaid Leave</option>
            <option value="others">Others</option>
          </select>
        </div>

        {leaveType === 'others' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Specify Leave Type *
            </label>
            <input
              type="text"
              value={customLeaveType}
              maxLength={100}
              onChange={(e) => {
                const val = e.target.value;
                setCustomLeaveType(val);
                if (val.trim()) {
                  setCustomTypeError('');
                }
              }}
              placeholder="Enter your leave type"
              className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] ${
                customTypeError ? 'border-rose-400' : 'border-slate-200'
              }`}
            />
            {customTypeError && (
              <p className="text-[11px] text-rose-500 mt-1">{customTypeError}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                setStartDate(nextStart);
                if (endDate < nextStart) {
                  setEndDate(nextStart);
                }
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>
        </div>

        <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Calculated Leave Duration:</span>
          <span className="font-bold font-mono text-[#206DA6] bg-white px-2.5 py-1 rounded-md border border-blue-200">
            {daysCount} Day{daysCount > 1 ? 's' : ''}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Reason / Justification *
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) {
                setError('');
              }
            }}
            rows={3}
            placeholder="Please share context, handover notes, or emergency contacts during this period..."
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
          />
          {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-md text-white bg-[#206DA6] hover:bg-[#1A5987] shadow-[#206DA6]/20"
          >
            Submit Application
          </button>
        </div>
      </form>
    </Modal>
  );
};
