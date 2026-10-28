import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Employee } from '../../types/hrms';
import { useHRMS } from '../../context/HRMSContext';
import { Clock, CheckCircle } from 'lucide-react';

interface ShiftAssignModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShiftAssignModal: React.FC<ShiftAssignModalProps> = ({
  employee,
  isOpen,
  onClose,
}) => {
  const { shiftTemplates, assignShift } = useHRMS();
  const [selectedShiftId, setSelectedShiftId] = useState('');

  useEffect(() => {
    if (employee) {
      setSelectedShiftId(employee.shiftId || shiftTemplates[0]?.id || '');
    }
  }, [employee, shiftTemplates, isOpen]);

  if (!employee) return null;

  const handleAssign = () => {
    if (!selectedShiftId) return;
    assignShift(employee.id, selectedShiftId);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Shift Schedule"
      subtitle={`Configure work rotation for ${employee.fullName}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Employee Info */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <img src={employee.avatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <h4 className="text-sm font-bold text-[#172B4D]">{employee.fullName}</h4>
            <p className="text-xs text-slate-500">
              Current: <span className="font-semibold text-[#206DA6]">{employee.shiftName}</span>
            </p>
          </div>
        </div>

        {/* Shift Templates List */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase">
            Select Target Shift Template
          </label>
          <div className="space-y-2">
            {shiftTemplates.map((shift) => {
              const isSelected = selectedShiftId === shift.id;
              return (
                <div
                  key={shift.id}
                  onClick={() => setSelectedShiftId(shift.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-[#206DA6] bg-blue-50/50 ring-1 ring-[#206DA6]'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3.5 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: shift.color }}
                    />
                    <div>
                      <p className="text-xs font-bold text-[#172B4D]">{shift.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono font-semibold text-slate-700">
                          {shift.startTime} - {shift.endTime}
                        </span>{' '}
                        ({shift.workHours} Hours) &bull; {shift.description}
                      </p>
                    </div>
                  </div>

                  {isSelected && <CheckCircle className="w-5 h-5 text-[#206DA6]" />}
                </div>
              );
            })}
          </div>
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
            type="button"
            onClick={handleAssign}
            className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-xs"
          >
            Confirm Shift Assignment
          </button>
        </div>
      </div>
    </Modal>
  );
};
