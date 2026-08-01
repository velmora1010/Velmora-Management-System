import { useState, useEffect, useMemo } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';
import { useExpenses, type FinanceExpense as FinanceExpenseType } from '../../hooks/finance/useExpenses';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseCardEditor } from './ExpenseCardEditor';
import { FinanceInfoCard } from '../../components/ui/FinanceInfoCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { departmentService } from '../../services/departmentService';
import { supabase } from '../../lib/supabase';
import type { Department, DepartmentSection } from '../../types';
import { UploadExpense } from './UploadExpense';

export const FinanceExpense = () => {
  const { expenses, isLoading, archiveExpense, refreshExpenses } = useExpenses();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab and Form state
  const [activeTab, setActiveTab] = useState<'view' | 'add' | 'analytics' | 'upload'>('view');
  const [editingExpense, setEditingExpense] = useState<FinanceExpenseType | null>(null);

  // Modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Mappings
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<DepartmentSection[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');

  useEffect(() => {
    const loadMappings = async () => {
      try {
        const { data: depts } = await departmentService.getAllDepartments();
        if (depts) setDepartments(depts);
        
        const { data: secs } = await departmentService.getAllSections();
        if (secs) setSections(secs);
      } catch (err) {
        console.error('Failed to load mappings in FinanceExpense:', err);
      }
    };
    loadMappings();
  }, []);

  const getDeptName = (id: string | null) => {
    if (!id) return '-';
    const match = departments.find(d => String(d.id) === String(id));
    return match ? match.department_name : String(id);
  };

  const getSectionName = (id: string | null) => {
    if (!id) return '-';
    const match = sections.find(s => String(s.id) === String(id));
    return match ? match.section_name : String(id);
  };

  // Sections filtered by selected department filter
  const filteredSectionsForFilterDropdown = useMemo(() => {
    if (selectedDeptFilter === 'all') return [];
    return sections.filter(s => String(s.department_id) === selectedDeptFilter);
  }, [sections, selectedDeptFilter]);

  // Reset section filter if department filter changes
  useEffect(() => {
    setSelectedSectionFilter('all');
  }, [selectedDeptFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Dept filter
      if (selectedDeptFilter !== 'all' && String(expense.main_category) !== selectedDeptFilter) {
        return false;
      }
      // Section filter
      if (selectedSectionFilter !== 'all' && String(expense.sub_category1) !== selectedSectionFilter) {
        return false;
      }

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const resolvedDept = getDeptName(expense.main_category).toLowerCase();
      const resolvedSection = getSectionName(expense.sub_category1).toLowerCase();
      
      return (
        resolvedDept.includes(q) ||
        resolvedSection.includes(q) ||
        (expense.sub_category2 || '').toLowerCase().includes(q) ||
        (expense.vendor || '').toLowerCase().includes(q) ||
        (expense.purchased_by || '').toLowerCase().includes(q)
      );
    });
  }, [expenses, selectedDeptFilter, selectedSectionFilter, searchQuery, departments, sections]);

  const handleEdit = (expense: FinanceExpenseType) => {
    setEditingId(expense.id || null);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setActiveTab('add');
  };

  const handleDelete = (id: string) => {
    setExpenseToDelete(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (expenseToDelete) {
      await archiveExpense(expenseToDelete);
      setExpenseToDelete(null);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full fade-in text-slate-200">
      {/* Finance Sub Navigation */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        <button
          onClick={handleAddNew}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'add'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Add Expense
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'upload'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Upload Expense
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'view'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          View Expense
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Expense Analytics
        </button>
      </div>

      {activeTab === 'view' && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border/50 text-main text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          
          {/* Department Filter */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="w-full sm:w-48 bg-card border border-border/50 text-main text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.department_name}</option>
            ))}
          </select>

          {/* Section Filter */}
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            disabled={selectedDeptFilter === 'all'}
            className="w-full sm:w-48 bg-card border border-border/50 text-main text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          >
            <option value="all">All Sections</option>
            {filteredSectionsForFilterDropdown.map((s) => (
              <option key={s.id} value={s.id}>{s.section_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {activeTab === 'add' && (
          <ExpenseForm 
            expense={editingExpense} 
            onClose={() => setActiveTab('view')} 
            onSuccess={() => {
              setActiveTab('view');
              refreshExpenses();
            }} 
          />
        )}

        {activeTab === 'upload' && (
          <UploadExpense onClose={() => setActiveTab('view')} />
        )}

        {activeTab === 'analytics' && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border/50 shadow-sm mt-4 fade-in">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl mb-4">
              📊
            </div>
            <h3 className="text-xl font-semibold text-main mb-2">Analytics Dashboard</h3>
            <p className="text-muted max-w-md">
              Expense analytics and reporting features will be available here.
            </p>
          </div>
        )}

        {activeTab === 'view' && (
          <>
            {isLoading && expenses.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border/50 shadow-sm mt-4">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl mb-4">
                  📉
                </div>
                <h3 className="text-xl font-semibold text-main mb-2">No expenses found</h3>
                <p className="text-muted max-w-md">
                  {searchQuery || selectedDeptFilter !== 'all' || selectedSectionFilter !== 'all' 
                    ? "Try adjusting your search or filters." 
                    : "Click '+ Add Expense' to log your first expense."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 items-start">
                {filteredExpenses.map(expense => (
                  <FinanceInfoCard
                    key={expense.id}
                    title={getDeptName(expense.main_category)}
                    subtitle={`${getSectionName(expense.sub_category1)}${expense.sub_category2 ? ` › ${expense.sub_category2}` : ''}`}
                    badges={[expense.vendor || 'No Vendor']}
                    onEdit={() => handleEdit(expense)}
                    onDelete={() => expense.id && handleDelete(expense.id)}
                    editTooltip="Edit Expense"
                    deleteTooltip="Archive Expense"
                    isEditing={editingId === expense.id}
                    formId={`edit-expense-${expense.id}`}
                    onCancelEdit={() => setEditingId(null)}
                    renderEditForm={() => (
                      <ExpenseCardEditor
                        expense={expense}
                        formId={`edit-expense-${expense.id}`}
                        onClose={() => setEditingId(null)}
                        onSuccess={() => setEditingId(null)}
                      />
                    )}
                    fields={[
                      { label: "Amount", value: `₹${expense.amount ?? '-'}` },
                      { label: "Date", value: formatDate(expense.created_at) },
                      { label: "Payment Mode", value: expense.payment_mode || '-' },
                      { label: "Purchased By", value: expense.purchased_by || '-' },
                      { label: "GST Status", value: expense.gst_status || '-' },
                    ]}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Archive Expense"
        message="Are you sure you want to archive this expense?"
        confirmText="Archive"
        onConfirm={executeDelete}
        onClose={() => {
          setIsConfirmOpen(false);
          setExpenseToDelete(null);
        }}
      />
    </div>
  );
};
