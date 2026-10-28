import React, { useState } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { Department } from '../../../types/hrms';
import {
  Building2,
  Users,
  DollarSign,
  MapPin,
  Plus,
  Search,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface DepartmentModuleProps {
  onSelectDepartment: (department: Department) => void;
  onAddDepartment: () => void;
  onEditDepartment: (department: Department) => void;
}

export const DepartmentModule: React.FC<DepartmentModuleProps> = ({
  onSelectDepartment,
  onAddDepartment,
  onEditDepartment,
}) => {
  const { departments, employees, settings } = useHRMS();
  const { canManageDepartments } = useAuth();
  const [search, setSearch] = useState('');

  const filteredDepartments = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#172B4D] tracking-tight">
            Department Structure
          </h2>
          <p className="text-xs text-[#64748B]">
            {departments.length} operational units across the organization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search departments..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>

          {canManageDepartments && (
            <button
              onClick={onAddDepartment}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          )}
        </div>
      </div>

      {/* Department Cards Grid or Empty State */}
      {filteredDepartments.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#18A999] flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-[#172B4D]">No departments created yet.</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            Create departments to organize teams, leadership, and divisional structures.
          </p>
          {canManageDepartments && (
            <button
              onClick={onAddDepartment}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Department</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDepartments.map((dept) => {
          const members = employees.filter((e) => e.departmentId === dept.id);
          const totalBaseSalary = members.reduce((sum, e) => sum + e.baseSalary, 0);

          return (
            <div
              key={dept.id}
              onClick={() => onSelectDepartment(dept)}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-md hover:border-[#206DA6]/50 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Top Accent Line */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                style={{ backgroundColor: dept.color }}
              />

              <div>
                <div className="flex items-start justify-between gap-3 mb-2 pt-1">
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white inline-block mb-1 shadow-xs"
                      style={{ backgroundColor: dept.color }}
                    >
                      {dept.code}
                    </span>
                    <h3 className="text-base font-bold text-[#172B4D] group-hover:text-[#206DA6] transition-colors">
                      {dept.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Personnel
                    </span>
                    <span className="text-lg font-bold text-[#172B4D] font-mono">
                      {members.length}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                  {dept.description}
                </p>

                {/* Head of Department Pill */}
                <div className="mt-4 p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate">
                    {dept.headEmployeeAvatar ? (
                      <img
                        src={dept.headEmployeeAvatar}
                        alt=""
                        className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">
                        HD
                      </div>
                    )}
                    <div className="truncate">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Head of Dept
                      </span>
                      <span className="text-xs font-semibold text-slate-800 truncate block">
                        {dept.headEmployeeName || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                </div>

                {/* Location and Budget */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{dept.location}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 truncate font-mono text-slate-700">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-semibold">
                      {settings.currencySymbol}
                      {dept.monthlyBudget.toLocaleString()} /mo
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom inspect link */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#206DA6] font-bold">
                <span>View Full Department Details</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
