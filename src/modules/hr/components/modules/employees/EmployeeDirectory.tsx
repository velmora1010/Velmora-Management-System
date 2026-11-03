import React, { useState } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { Employee } from '../../../types/hrms';
import { Badge } from '../../common/Badge';
import { Avatar } from '../../common/Avatar';
import {
  Search,
  Filter,
  UserPlus,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Building,
  Clock,
  Download,
  MoreVertical,
  Edit2,
  Trash2,
} from 'lucide-react';

interface EmployeeDirectoryProps {
  onSelectEmployee: (employee: Employee) => void;
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (employee: Employee) => void;
}

export const EmployeeDirectory: React.FC<EmployeeDirectoryProps> = ({
  onSelectEmployee,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
}) => {
  const { employees, departments } = useHRMS();
  const { canManageEmployees } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDept === 'all' || emp.departmentId === selectedDept;
    const matchesStatus = selectedStatus === 'all' || emp.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const exportCSV = () => {
    if (!canManageEmployees) return;
    const headers = ['Employee Code', 'Full Name', 'Designation', 'Department', 'Email', 'Phone', 'Status', 'Shift', 'Location'];
    const rows = filteredEmployees.map((e) => [
      e.employeeCode,
      `"${e.fullName}"`,
      `"${e.designation}"`,
      `"${e.departmentName}"`,
      e.email,
      e.phone,
      e.status,
      `"${e.shiftName}"`,
      e.workLocation,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `employees_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#172B4D] tracking-tight">Staff Directory</h2>
          <p className="text-xs text-[#64748B]">
            Showing {filteredEmployees.length} of {employees.length} company employees
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, role, ID..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>

          {/* Department Filter */}
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

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="probation">Probation</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-xs text-[#206DA6]' : 'text-slate-500'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-xs text-[#206DA6]' : 'text-slate-500'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Export CSV (authorized) */}
          {canManageEmployees && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}

          {/* Add Employee Button (authorized) */}
          {canManageEmployees && (
            <button
              onClick={onAddEmployee}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#206DA6] flex items-center justify-center mb-4">
            <UserPlus className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-[#172B4D]">No Employees Added Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            Start building your workforce by adding your first employee.
          </p>
          {canManageEmployees && (
            <button
              onClick={onAddEmployee}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Employee</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => onSelectEmployee(emp)}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-md hover:border-[#206DA6]/50 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative"
            >
              <div>
                {/* Status & Code */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] font-bold text-slate-400">
                    {emp.employeeCode}
                  </span>
                  <Badge variant={emp.status} size="sm">
                    {emp.status.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Avatar & Names */}
                <div className="text-center my-2">
                  <Avatar
                    src={emp.avatar}
                    name={emp.fullName}
                    size="lg"
                    className="mx-auto ring-4 ring-slate-50 group-hover:ring-[#206DA6]/20 shadow-xs transition-all"
                  />
                  <h3 className="text-sm font-bold text-[#172B4D] group-hover:text-[#206DA6] transition-colors mt-2.5 truncate">
                    {emp.fullName}
                  </h3>
                  <p className="text-xs text-[#206DA6] font-medium truncate">{emp.designation}</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5 truncate">{emp.departmentName}</p>
                </div>

                {/* Info Pills */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate text-[11px]">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate text-[11px]">{emp.shiftName}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Quick Link */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-400">{emp.workLocation}</span>
                <span className="font-bold text-[#206DA6] group-hover:underline">View Profile &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Shift</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => onSelectEmployee(emp)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={emp.avatar}
                          name={emp.fullName}
                          size="sm"
                          className="ring-1 ring-slate-200"
                        />
                        <div>
                          <p className="font-bold text-[#172B4D] hover:text-[#206DA6]">{emp.fullName}</p>
                          <p className="text-[11px] text-slate-500">{emp.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-600">{emp.employeeCode}</td>
                    <td className="py-3 px-4 text-slate-700">{emp.departmentName}</td>
                    <td className="py-3 px-4 text-slate-500">
                      <div>{emp.email}</div>
                      <div className="text-[11px] text-slate-400">{emp.phone}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{emp.shiftName}</td>
                    <td className="py-3 px-4">
                      <Badge variant={emp.status} size="sm">
                        {emp.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEmployee(emp);
                        }}
                        className="text-xs font-bold text-[#206DA6] hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
