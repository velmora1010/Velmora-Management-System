import React from 'react';
import { Modal } from '../common/Modal';
import { Department, Employee } from '../../types/hrms';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';
import { Building2, Users, DollarSign, MapPin, Edit2, Trash2, ShieldCheck, ArrowRight } from 'lucide-react';

interface DepartmentDetailModalProps {
  department: Department | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
  onSelectEmployee: (employee: Employee) => void;
}

export const DepartmentDetailModal: React.FC<DepartmentDetailModalProps> = ({
  department,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onSelectEmployee,
}) => {
  const { employees, settings } = useHRMS();
  const { canManageDepartments } = useAuth();

  if (!department) return null;

  const departmentMembers = employees.filter((e) => e.departmentId === department.id);
  const totalSalaryExpenses = departmentMembers.reduce((sum, e) => sum + e.baseSalary, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Department Structure"
      subtitle={`Code: ${department.code}`}
      maxWidth="3xl"
    >
      {/* Department Hero Card */}
      <div
        className="p-5 rounded-2xl text-white shadow-md relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${department.color} 0%, #172B4D 100%)`,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1.5 backdrop-blur-md">
              {department.code} Department
            </span>
            <h2 className="text-2xl font-black">{department.name}</h2>
            <p className="text-xs text-white/80 mt-1 max-w-lg leading-relaxed">{department.description}</p>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 flex-shrink-0">
            <span className="text-[11px] text-white/70">Monthly Allocation</span>
            <span className="text-xl font-mono font-extrabold">
              {settings.currencySymbol}
              {department.monthlyBudget.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap gap-4 text-xs text-white/80">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {department.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {departmentMembers.length} Active Personnel
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Base Payroll: {settings.currencySymbol}
            {totalSalaryExpenses.toLocaleString()} / mo
          </span>
        </div>
      </div>

      {/* Head of Department Card */}
      <div className="mt-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          {department.headEmployeeAvatar ? (
            <img
              src={department.headEmployeeAvatar}
              alt=""
              className="w-11 h-11 rounded-xl object-cover ring-2 ring-white shadow-xs"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-slate-500">
              HD
            </div>
          )}
          <div>
            <span className="text-[10px] font-bold text-[#206DA6] uppercase tracking-wider block">
              Head of Department
            </span>
            <h4 className="text-sm font-bold text-[#172B4D]">{department.headEmployeeName || 'Not Assigned'}</h4>
            <p className="text-xs text-slate-500">Executive Department Director</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Authorized Lead
        </span>
      </div>

      {/* Assigned Members List */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-[#206DA6]" /> Department Members ({departmentMembers.length})
          </h4>
          <span className="text-[11px] text-slate-400">Click member to view profile</span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
          {departmentMembers.length === 0 ? (
            <p className="text-xs text-slate-400 p-6 text-center">No employees currently assigned to this department.</p>
          ) : (
            departmentMembers.map((emp) => (
              <div
                key={emp.id}
                onClick={() => {
                  onSelectEmployee(emp);
                }}
                className="flex items-center justify-between p-3 hover:bg-slate-50/90 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <img src={emp.avatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
                  <div>
                    <p className="text-xs font-bold text-[#172B4D] group-hover:text-[#206DA6] transition-colors">
                      {emp.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {emp.designation} &bull; <span className="font-mono">{emp.employeeCode}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={emp.status} size="sm">
                    {emp.status}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#206DA6] transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Actions */}
      {canManageDepartments && (
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onDelete(department);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Department
          </button>

          <button
            type="button"
            onClick={() => {
              onEdit(department);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-xs transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Department
          </button>
        </div>
      )}
    </Modal>
  );
};
