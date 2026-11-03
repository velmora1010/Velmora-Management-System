import React, { useState, useEffect } from 'react';
import { Search, Users, Building2, Calendar, ArrowRight, X } from 'lucide-react';
import { useHRMS } from '../../context/HRMSContext';
import { Employee, Department } from '../../types/hrms';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmployee: (employee: Employee) => void;
  onSelectDepartment: (department: Department) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectEmployee,
  onSelectDepartment,
}) => {
  const { employees, departments } = useHRMS();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // toggle open is handled by parent
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredEmployees = searchTerm.trim()
    ? employees.filter(
        (e) =>
          e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const filteredDepartments = searchTerm.trim()
    ? departments.filter(
        (d) =>
          d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-start justify-center p-4 pt-16 sm:pt-24 text-center">
        <div
          className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all w-full max-w-2xl border border-slate-100 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input Bar */}
          <div className="flex items-center px-4 border-b border-slate-100 bg-white">
            <Search className="w-5 h-5 text-slate-400 mr-3" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employees, roles, departments..."
              className="w-full py-4 text-sm text-[#172B4D] placeholder-slate-400 bg-transparent focus:outline-hidden"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="p-1 rounded text-slate-400 hover:text-slate-600 mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="px-2 py-0.5 text-[10px] bg-slate-100 border border-slate-200 rounded font-mono text-slate-500">
              ESC
            </kbd>
          </div>

          {/* Results Area */}
          <div className="max-h-96 overflow-y-auto p-4 space-y-4">
            {!searchTerm.trim() ? (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-400">
                  Type an employee name, job title, department, or ID code to search.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['Alexander', 'Engineering', 'EMP-1001', 'Design', 'Active'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSearchTerm(tag)}
                      className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : filteredEmployees.length === 0 && filteredDepartments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No matching records found for "{searchTerm}".
              </div>
            ) : (
              <>
                {/* Employees Group */}
                {filteredEmployees.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#206DA6]" /> Employees ({filteredEmployees.length})
                    </h4>
                    <div className="space-y-1">
                      {filteredEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => {
                            onSelectEmployee(emp);
                            onClose();
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group border border-transparent hover:border-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={emp.avatar}
                              alt={emp.fullName}
                              className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200"
                            />
                            <div>
                              <p className="text-sm font-semibold text-[#172B4D] group-hover:text-[#206DA6] transition-colors">
                                {emp.fullName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {emp.designation} &bull; {emp.departmentName} &bull; <span className="font-mono text-[11px]">{emp.employeeCode}</span>
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#206DA6] transition-colors" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Departments Group */}
                {filteredDepartments.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#18A999]" /> Departments ({filteredDepartments.length})
                    </h4>
                    <div className="space-y-1">
                      {filteredDepartments.map((dept) => (
                        <div
                          key={dept.id}
                          onClick={() => {
                            onSelectDepartment(dept);
                            onClose();
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group border border-transparent hover:border-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs"
                              style={{ backgroundColor: dept.color }}
                            >
                              {dept.code}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#172B4D] group-hover:text-[#18A999] transition-colors">
                                {dept.name}
                              </p>
                              <p className="text-xs text-slate-500">{dept.description}</p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#18A999] transition-colors" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
