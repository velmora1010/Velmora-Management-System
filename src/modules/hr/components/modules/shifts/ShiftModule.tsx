import React, { useState } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { Employee, ShiftTemplate } from '../../../types/hrms';
import { Clock, Users, Plus, Search, Calendar, Layers } from 'lucide-react';

interface ShiftModuleProps {
  onOpenAssignShift: (employee: Employee) => void;
  onSelectEmployee: (employee: Employee) => void;
  onOpenAddShift?: () => void;
}

export const ShiftModule: React.FC<ShiftModuleProps> = ({
  onOpenAssignShift,
  onSelectEmployee,
  onOpenAddShift,
}) => {
  const { shiftTemplates, employees, departments } = useHRMS();
  const { canManageShifts } = useAuth();

  const [selectedDept, setSelectedDept] = useState('all');
  const [search, setSearch] = useState('');

  const filteredEmployees = employees.filter((e) => {
    const matchesDept = selectedDept === 'all' || e.departmentId === selectedDept;
    const matchesSearch =
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      e.designation.toLowerCase().includes(search.toLowerCase()) ||
      e.shiftName.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#172B4D] tracking-tight">
            Shift Management & Rostering
          </h2>
          <p className="text-xs text-[#64748B]">
            Work rotation schedules, operational hours, and employee shift assignments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee or shift..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>

          {departments.length > 0 && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {canManageShifts && onOpenAddShift && (
            <button
              onClick={onOpenAddShift}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Shift Templates Grid or Empty State */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#206DA6]" /> Active Shift Profiles ({shiftTemplates.length})
        </h3>

        {shiftTemplates.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#172B4D]">No shifts configured yet.</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
              Define operational work hours, rotations, and shift timing profiles.
            </p>
            {canManageShifts && onOpenAddShift && (
              <button
                onClick={onOpenAddShift}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Shift</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {shiftTemplates.map((shift) => {
              const assignedCount = employees.filter((e) => e.shiftId === shift.id).length;
              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card flex flex-col justify-between relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 bottom-0 w-1.5"
                    style={{ backgroundColor: shift.color }}
                  />

                  <div className="pl-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#172B4D]">{shift.name}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: shift.color }}
                      />
                    </div>
                    <p className="text-base font-extrabold font-mono text-[#206DA6] mt-2">
                      {shift.startTime} &ndash; {shift.endTime}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {shift.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 pl-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{shift.workHours}h Working Window</span>
                    <span className="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {assignedCount} Assigned
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shift Roster Matrix Table */}
      {employees.length > 0 && shiftTemplates.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#206DA6]" />
              <h3 className="text-sm font-bold text-[#172B4D]">Weekly Roster Schedule</h3>
            </div>
            <span className="text-xs text-slate-400">Current Work Week</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Employee</th>
                  <th className="py-3 px-4 min-w-[140px]">Primary Shift</th>
                  {daysOfWeek.map((day) => (
                    <th key={day} className="py-3 px-3 text-center">
                      {day}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const shift = shiftTemplates.find((s) => s.id === emp.shiftId) || shiftTemplates[0];

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div
                          className="flex items-center gap-3 cursor-pointer group"
                          onClick={() => onSelectEmployee(emp)}
                        >
                          <img src={emp.avatar} alt="" className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200" />
                          <div>
                            <p className="font-bold text-[#172B4D] group-hover:text-[#206DA6]">{emp.fullName}</p>
                            <p className="text-[11px] text-slate-500">{emp.departmentName}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: shift.color }}
                          />
                          <span className="font-semibold text-slate-800">{shift.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          {shift.startTime} - {shift.endTime}
                        </span>
                      </td>

                      {daysOfWeek.map((day, idx) => {
                        const isWeekend = idx >= 5;
                        const worksWeekend = shift.id === 'shift-night';

                        return (
                          <td key={day} className="py-3 px-3 text-center">
                            {isWeekend && !worksWeekend ? (
                              <span className="text-[10px] text-slate-300 font-medium">OFF</span>
                            ) : (
                              <span
                                className="text-[10px] font-bold px-2 py-1 rounded-md text-white block shadow-2xs truncate"
                                style={{ backgroundColor: shift.color }}
                                title={`${shift.name} (${shift.startTime}-${shift.endTime})`}
                              >
                                {shift.startTime}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-right">
                        {canManageShifts && (
                          <button
                            onClick={() => onOpenAssignShift(emp)}
                            className="text-xs font-bold text-[#206DA6] hover:underline"
                          >
                            Reassign
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
