import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Department } from '../../types/hrms';
import { useHRMS } from '../../context/HRMSContext';

interface DepartmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentToEdit?: Department | null;
}

const COLOR_PRESETS = [
  '#206DA6',
  '#18A999',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
  '#10B981',
  '#3B82F6',
  '#6366F1',
];

export const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({
  isOpen,
  onClose,
  departmentToEdit,
}) => {
  const { employees, addDepartment, updateDepartment } = useHRMS();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Building A, 2nd Floor');
  const [monthlyBudget, setMonthlyBudget] = useState(75000);
  const [headEmployeeId, setHeadEmployeeId] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (departmentToEdit) {
      setName(departmentToEdit.name);
      setCode(departmentToEdit.code);
      setDescription(departmentToEdit.description);
      setLocation(departmentToEdit.location);
      setMonthlyBudget(departmentToEdit.monthlyBudget);
      setHeadEmployeeId(departmentToEdit.headEmployeeId || '');
      setColor(departmentToEdit.color || COLOR_PRESETS[0]);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setLocation('Building A, 1st Floor');
      setMonthlyBudget(80000);
      setHeadEmployeeId(employees[0]?.id || '');
      setColor(COLOR_PRESETS[0]);
    }
    setErrors({});
  }, [departmentToEdit, employees, isOpen]);

  const validate = () => {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = 'Department name is required';
    if (!code.trim()) err.code = 'Department code is required';
    if (!description.trim()) err.description = 'Description is required';
    if (monthlyBudget <= 0) err.monthlyBudget = 'Valid budget is required';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const headEmp = employees.find((e) => e.id === headEmployeeId);

    const deptData = {
      name,
      code: code.toUpperCase(),
      description,
      location,
      monthlyBudget: Number(monthlyBudget),
      headEmployeeId: headEmp?.id,
      headEmployeeName: headEmp?.fullName,
      headEmployeeAvatar: headEmp?.avatar,
      color,
    };

    if (departmentToEdit) {
      updateDepartment(departmentToEdit.id, deptData);
    } else {
      addDepartment(deptData);
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={departmentToEdit ? 'Edit Department' : 'Create New Department'}
      subtitle="Define organizational unit, departmental lead, and operational budget"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Department Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              placeholder="e.g. Legal & Compliance"
            />
            {errors.name && <span className="text-[11px] text-red-500">{errors.name}</span>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] uppercase font-mono font-bold"
              placeholder="e.g. LGL"
            />
            {errors.code && <span className="text-[11px] text-red-500">{errors.code}</span>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Description & Mission *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            placeholder="Brief scope of departmental responsibilities"
          />
          {errors.description && <span className="text-[11px] text-red-500">{errors.description}</span>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Head of Department
          </label>
          <select
            value={headEmployeeId}
            onChange={(e) => setHeadEmployeeId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
          >
            <option value="">-- Select Department Lead --</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({emp.designation})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Office Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
              placeholder="Building A, 2nd Floor"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Monthly Budget (USD) *
            </label>
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
              placeholder="75000"
            />
          </div>
        </div>

        {/* Color Accent Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
            Brand Accent Color
          </label>
          <div className="flex items-center gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-xl transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-slate-800 ring-offset-2' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-xs"
          >
            {departmentToEdit ? 'Save Department' : 'Create Department'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
