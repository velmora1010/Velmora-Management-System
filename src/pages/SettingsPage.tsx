import React, { useState, useEffect, useMemo } from 'react';
import { departmentService } from '../services/departmentService';
import type { Department, DepartmentSection } from '../types';
import { supabase } from '../lib/supabase';
import { Settings, Plus, Edit2, Trash2, Search, ToggleLeft, ToggleRight, X, ArrowLeft, Shield, Database, Sliders, Zap, Plug } from 'lucide-react';
import { UserRoleManagement } from '../modules/settings/UserRoleManagement';
import { AuditLogViewer } from '../modules/settings/AuditLogViewer';
import { SystemConfiguration } from '../modules/settings/SystemConfiguration';
import { WorkflowAutomation } from '../modules/settings/WorkflowAutomation';
import { IntegrationHub } from '../modules/settings/IntegrationHub';
import toast from 'react-hot-toast';

type ActiveTab = 'departments' | 'sections' | 'roles' | 'audit' | 'config' | 'automation' | 'integrations';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<DepartmentSection[]>([]);
  const [isDeptsLoading, setIsDeptsLoading] = useState(false);
  const [isSectionsLoading, setIsSectionsLoading] = useState(false);

  // Search & Filter
  const [deptSearch, setDeptSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // Form States (Department)
  const [isDeptFormOpen, setIsDeptFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptStatus, setDeptStatus] = useState<string>('Active');

  // Form States (Section)
  const [isSectionFormOpen, setIsSectionFormOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<DepartmentSection | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [sectionCode, setSectionCode] = useState('');
  const [sectionDesc, setSectionDesc] = useState('');
  const [sectionStatus, setSectionStatus] = useState<string>('Active');
  const [sectionDeptId, setSectionDeptId] = useState<string>('');

  // Load Mapping Data
  const loadData = async () => {
    setIsDeptsLoading(true);
    setIsSectionsLoading(true);
    try {
      const { data: depts, error: deptsErr } = await departmentService.getAllDepartments();
      if (deptsErr) throw deptsErr;
      if (depts) setDepartments(depts);

      const { data: secs, error: secsErr } = await departmentService.getAllSections();
      if (secsErr) throw secsErr;
      if (secs) setSections(secs);
    } catch (err: any) {
      console.error('Error loading data in SettingsPage:', err.message);
      toast.error('Failed to load settings data.');
    } finally {
      setIsDeptsLoading(false);
      setIsSectionsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Department Form Operations
  const handleOpenDeptForm = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptName(dept.department_name);
      setDeptCode(dept.department_code || '');
      setDeptDesc(dept.description || '');
      setDeptStatus(dept.status);
    } else {
      setEditingDept(null);
      setDeptName('');
      setDeptCode('');
      setDeptDesc('');
      setDeptStatus('Active');
    }
    setIsDeptFormOpen(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) {
      toast.error('Please enter name and code.');
      return;
    }

    // Uniqueness Checks
    const nameDup = departments.find(d => d.id !== editingDept?.id && d.department_name.toLowerCase().trim() === deptName.toLowerCase().trim());
    const codeDup = departments.find(d => d.id !== editingDept?.id && (d.department_code || '').toLowerCase().trim() === deptCode.toLowerCase().trim());

    if (nameDup) {
      toast.error('Department Name must be unique.');
      return;
    }
    if (codeDup) {
      toast.error('Department Code must be unique.');
      return;
    }

    const payload = {
      department_name: deptName.trim(),
      department_code: deptCode.trim(),
      description: deptDesc.trim(),
      status: deptStatus
    };

    let result;
    if (editingDept) {
      result = await departmentService.updateDepartment(editingDept.id, payload);
    } else {
      result = await departmentService.createDepartment(payload);
    }

    if (result.error) {
      toast.error(result.error.message || 'Failed to save department.');
    } else {
      toast.success(editingDept ? 'Department updated successfully!' : 'Department created successfully!');
      setIsDeptFormOpen(false);
      loadData();
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    const hasSections = sections.some(s => s.department_id === dept.id);
    if (hasSections) {
      toast.error('Cannot delete department because sections exist in it. Please delete the sections first.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the department "${dept.department_name}"?`)) {
      const { success, error } = await departmentService.deleteDepartment(dept.id);
      if (error) {
        toast.error(error.message || 'Failed to delete department.');
      } else if (success) {
        toast.success('Department deleted successfully!');
        loadData();
      }
    }
  };

  const handleToggleDeptStatus = async (dept: Department) => {
    const nextStatus = dept.status === 'Active' ? 'Inactive' : 'Active';
    const { error } = await departmentService.updateDepartment(dept.id, { status: nextStatus });
    if (error) {
      toast.error('Failed to update status.');
    } else {
      toast.success(`Department status updated to ${nextStatus}`);
      loadData();
    }
  };

  // Section Form Operations
  const handleOpenSectionForm = (sec?: DepartmentSection) => {
    if (sec) {
      setEditingSection(sec);
      setSectionName(sec.section_name);
      setSectionCode(sec.section_code || '');
      setSectionDesc(sec.description || '');
      setSectionStatus(sec.status);
      setSectionDeptId(String(sec.department_id));
    } else {
      setEditingSection(null);
      setSectionName('');
      setSectionCode('');
      setSectionDesc('');
      setSectionStatus('Active');
      setSectionDeptId(selectedDeptFilter !== 'all' ? selectedDeptFilter : (departments[0]?.id ? String(departments[0].id) : ''));
    }
    setIsSectionFormOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName.trim() || !sectionCode.trim() || !sectionDeptId) {
      toast.error('Please fill out all required fields.');
      return;
    }

    // Uniqueness Checks: Section Name must be unique within its Department
    const secDup = sections.find(s => 
      s.id !== editingSection?.id && 
      s.department_id === Number(sectionDeptId) && 
      s.section_name.toLowerCase().trim() === sectionName.toLowerCase().trim()
    );

    if (secDup) {
      toast.error('Section Name must be unique within its Department.');
      return;
    }

    const payload = {
      department_id: Number(sectionDeptId),
      section_name: sectionName.trim(),
      section_code: sectionCode.trim(),
      description: sectionDesc.trim(),
      status: sectionStatus
    };

    let result;
    if (editingSection) {
      result = await departmentService.updateSection(editingSection.id, payload);
    } else {
      result = await departmentService.createSection(payload);
    }

    if (result.error) {
      toast.error(result.error.message || 'Failed to save section.');
    } else {
      toast.success(editingSection ? 'Section updated successfully!' : 'Section created successfully!');
      setIsSectionFormOpen(false);
      loadData();
    }
  };

  const handleDeleteSection = async (sec: DepartmentSection) => {
    // Check if referenced in Task_row table
    try {
      const { count, error: countErr } = await supabase
        .from('Task_row')
        .select('*', { count: 'exact', head: true })
        .eq('sub_category1', String(sec.id));

      if (countErr) throw countErr;

      if (count && count > 0) {
        toast.error(`Cannot delete section because it is referenced by ${count} active tasks.`);
        return;
      }
    } catch (err) {
      console.error('Error checking section references:', err);
      toast.error('Could not verify if section is referenced. Deletion aborted.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the section "${sec.section_name}"?`)) {
      const { success, error } = await departmentService.deleteSection(sec.id);
      if (error) {
        toast.error(error.message || 'Failed to delete section.');
      } else if (success) {
        toast.success('Section deleted successfully!');
        loadData();
      }
    }
  };

  const handleToggleSectionStatus = async (sec: DepartmentSection) => {
    const nextStatus = sec.status === 'Active' ? 'Inactive' : 'Active';
    const { error } = await departmentService.updateSection(sec.id, { status: nextStatus });
    if (error) {
      toast.error('Failed to update status.');
    } else {
      toast.success(`Section status updated to ${nextStatus}`);
      loadData();
    }
  };

  // Filtered Lists
  const filteredDepartments = useMemo(() => {
    return departments.filter(d => {
      const matchSearch = 
        d.department_name.toLowerCase().includes(deptSearch.toLowerCase()) ||
        (d.department_code || '').toLowerCase().includes(deptSearch.toLowerCase()) ||
        (d.description || '').toLowerCase().includes(deptSearch.toLowerCase());
      return matchSearch;
    });
  }, [departments, deptSearch]);

  const filteredSections = useMemo(() => {
    return sections.filter(s => {
      const matchDept = selectedDeptFilter === 'all' || String(s.department_id) === selectedDeptFilter;
      const matchSearch = 
        s.section_name.toLowerCase().includes(sectionSearch.toLowerCase()) ||
        (s.section_code || '').toLowerCase().includes(sectionSearch.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(sectionSearch.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [sections, selectedDeptFilter, sectionSearch]);

  const getDeptName = (id: number) => {
    const match = departments.find(d => d.id === id);
    return match ? match.department_name : String(id);
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 text-slate-200">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/10 rounded-lg text-purple-400">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">System Admin Settings</h1>
            <p className="text-sm text-slate-400">Configure departments and section architectures</p>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-700/60 gap-4 mb-4">
        <button 
          onClick={() => setActiveTab('departments')}
          className={`pb-2.5 px-2 text-sm font-semibold border-b-2 transition-all ${activeTab === 'departments' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Departments
        </button>
        <button 
          onClick={() => setActiveTab('sections')}
          className={`pb-2.5 px-2 text-sm font-semibold border-b-2 transition-all ${activeTab === 'sections' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Department Sections
        </button>
        <button 
          onClick={() => setActiveTab('roles')}
          className={`pb-2.5 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'roles' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Shield size={16} />
          User & Role Access Control
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`pb-2.5 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'audit' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Database size={16} />
          Audit Logs & Trail
        </button>
        <button 
          onClick={() => setActiveTab('config')}
          className={`pb-2.5 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'config' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Sliders size={16} />
          System Configuration
        </button>
        <button 
          onClick={() => setActiveTab('automation')}
          className={`pb-2.5 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'automation' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Zap size={16} />
          Workflow Automation
        </button>
        <button 
          onClick={() => setActiveTab('integrations')}
          className={`pb-2.5 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'integrations' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Plug size={16} />
          Integration Hub
        </button>
      </div>

      {/* Roles & Permissions Admin Tab */}
      {activeTab === 'roles' && (
        <UserRoleManagement />
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <AuditLogViewer />
      )}

      {/* System Configuration Tab */}
      {activeTab === 'config' && (
        <SystemConfiguration />
      )}

      {/* Workflow Automation Tab */}
      {activeTab === 'automation' && (
        <WorkflowAutomation />
      )}

      {/* Integration Hub Tab */}
      {activeTab === 'integrations' && (
        <IntegrationHub />
      )}

      {/* Departments Section */}
      {activeTab === 'departments' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-850 p-4 rounded-xl border border-slate-700/50">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search departments..."
                value={deptSearch}
                onChange={e => setDeptSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            </div>
            <button 
              onClick={() => handleOpenDeptForm()}
              className="w-full sm:w-auto h-[40px] px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-[10px] text-sm font-medium transition-colors flex items-center justify-center gap-2 self-stretch"
            >
              <Plus size={16} /> Add Department
            </button>
          </div>

          {/* Form Card (Inline Add/Edit) */}
          {isDeptFormOpen && (
            <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700 animate-in">
              <div className="flex justify-between items-center mb-4 border-b border-slate-750 pb-2">
                <h3 className="text-base font-bold text-slate-100">{editingDept ? '✏️ Edit Department' : '➕ Add Department'}</h3>
                <button onClick={() => setIsDeptFormOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveDept} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Department Name *</label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={e => setDeptName(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    placeholder="e.g. Sales"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Department Code *</label>
                  <input
                    type="text"
                    required
                    value={deptCode}
                    onChange={e => setDeptCode(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    placeholder="e.g. SAL"
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-400">Description</label>
                  <textarea
                    value={deptDesc}
                    onChange={e => setDeptDesc(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    rows={2}
                    placeholder="Brief description of responsibilities..."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Status</label>
                  <select
                    value={deptStatus}
                    onChange={e => setDeptStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end gap-2.5 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsDeptFormOpen(false)}
                    className="px-4 py-2 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Save Department
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Departments Table */}
          <div className="bg-slate-800/40 rounded-xl border border-slate-700 overflow-x-auto">
            {isDeptsLoading ? (
              <div className="text-center py-10 text-slate-400 text-sm">Loading departments...</div>
            ) : filteredDepartments.length > 0 ? (
              <table className="w-full text-left text-sm text-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700 text-slate-100 font-semibold">
                    <th className="px-4 py-3">Department Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Total Sections</th>
                    <th className="px-4 py-3">Created Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepartments.map(dept => {
                    const totalSecs = sections.filter(s => s.department_id === dept.id).length;
                    return (
                      <tr key={dept.id} className="border-b border-slate-700/60 hover:bg-slate-750/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-100">{dept.department_name}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{dept.department_code}</span></td>
                        <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[200px]">{dept.description || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${dept.status === 'Active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {dept.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{totalSecs}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{dept.created_at ? new Date(dept.created_at).toLocaleDateString() : '-'}</td>
                        <td className="px-4 py-3 text-right flex justify-end gap-1.5">
                          <button 
                            onClick={() => handleToggleDeptStatus(dept)} 
                            title={dept.status === 'Active' ? 'Deactivate' : 'Activate'}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {dept.status === 'Active' ? <ToggleRight size={18} className="text-purple-400" /> : <ToggleLeft size={18} />}
                          </button>
                          <button 
                            onClick={() => handleOpenDeptForm(dept)}
                            title="Edit"
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteDept(dept)}
                            title="Delete"
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-slate-400">No departments found.</div>
            )}
          </div>
        </div>
      )}

      {/* Sections Section */}
      {activeTab === 'sections' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-850 p-4 rounded-xl border border-slate-700/50">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search sections..."
                  value={sectionSearch}
                  onChange={e => setSectionSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
                <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              </div>
              <select
                value={selectedDeptFilter}
                onChange={e => setSelectedDeptFilter(e.target.value)}
                className="w-full sm:w-48 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.department_name}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => handleOpenSectionForm()}
              className="w-full md:w-auto h-[40px] px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-[10px] text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add Section
            </button>
          </div>

          {/* Form Card (Inline Add/Edit) */}
          {isSectionFormOpen && (
            <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700 animate-in">
              <div className="flex justify-between items-center mb-4 border-b border-slate-750 pb-2">
                <h3 className="text-base font-bold text-slate-100">{editingSection ? '✏️ Edit Section' : '➕ Add Section'}</h3>
                <button onClick={() => setIsSectionFormOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveSection} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Department *</label>
                  <select
                    required
                    value={sectionDeptId}
                    onChange={e => setSectionDeptId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.department_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Section Name *</label>
                  <input
                    type="text"
                    required
                    value={sectionName}
                    onChange={e => setSectionName(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    placeholder="e.g. Customer Support"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Section Code *</label>
                  <input
                    type="text"
                    required
                    value={sectionCode}
                    onChange={e => setSectionCode(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    placeholder="e.g. CS"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Status</label>
                  <select
                    value={sectionStatus}
                    onChange={e => setSectionStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-400">Description</label>
                  <textarea
                    value={sectionDesc}
                    onChange={e => setSectionDesc(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    rows={2}
                    placeholder="Brief description of section deliverables..."
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-2.5 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsSectionFormOpen(false)}
                    className="px-4 py-2 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Save Section
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sections Table */}
          <div className="bg-slate-800/40 rounded-xl border border-slate-700 overflow-x-auto">
            {isSectionsLoading ? (
              <div className="text-center py-10 text-slate-400 text-sm">Loading sections...</div>
            ) : filteredSections.length > 0 ? (
              <table className="w-full text-left text-sm text-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700 text-slate-100 font-semibold">
                    <th className="px-4 py-3">Section Name</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSections.map(sec => (
                    <tr key={sec.id} className="border-b border-slate-700/60 hover:bg-slate-750/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-100">{sec.section_name}</td>
                      <td className="px-4 py-3 text-slate-300 font-medium">{getDeptName(sec.department_id)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{sec.section_code}</span></td>
                      <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[200px]">{sec.description || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sec.status === 'Active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {sec.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{sec.created_at ? new Date(sec.created_at).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3 text-right flex justify-end gap-1.5">
                        <button 
                          onClick={() => handleToggleSectionStatus(sec)} 
                          title={sec.status === 'Active' ? 'Deactivate' : 'Activate'}
                          className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {sec.status === 'Active' ? <ToggleRight size={18} className="text-purple-400" /> : <ToggleLeft size={18} />}
                        </button>
                        <button 
                          onClick={() => handleOpenSectionForm(sec)}
                          title="Edit"
                          className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSection(sec)}
                          title="Delete"
                          className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-slate-400">No sections found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
