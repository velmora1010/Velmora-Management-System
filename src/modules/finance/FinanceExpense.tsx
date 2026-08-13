import { useState, useEffect, useMemo } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';
import { useExpenses, type FinanceExpense as FinanceExpenseType } from '../../hooks/finance/useExpenses';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseCardEditor } from './ExpenseCardEditor';
import { FinanceInfoCard } from '../../components/ui/FinanceInfoCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { supabase } from '../../lib/supabase';
import { UploadExpense } from './UploadExpense';

export const FinanceExpense = () => {
  const { expenses, isLoading, archiveExpense, refreshExpenses } = useExpenses();
  const [searchQuery, setSearchQuery] = useState('');
  const [categorizationFilter, setCategorizationFilter] = useState<'all' | 'categorized' | 'uncategorized'>('all');

  
  // Tab and Form state
  const [activeTab, setActiveTab] = useState<'view' | 'add' | 'analytics' | 'upload'>('view');
  const [editingExpense, setEditingExpense] = useState<FinanceExpenseType | null>(null);

  // Modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [selectedSub2Filter, setSelectedSub2Filter] = useState<string>('all');
  const [selectedSub3Filter, setSelectedSub3Filter] = useState<string>('all');

  // Dynamic Filter Options
  const dynamicDepartments = useMemo(() => {
    const depts = new Set(expenses.map(e => e.main_category).filter(Boolean));
    return Array.from(depts).sort() as string[];
  }, [expenses]);

  const dynamicSections = useMemo(() => {
    if (selectedDeptFilter === 'all') return [];
    const secs = new Set(
      expenses
        .filter(e => e.main_category === selectedDeptFilter)
        .map(e => e.sub_category1)
        .filter(Boolean)
    );
    return Array.from(secs).sort() as string[];
  }, [expenses, selectedDeptFilter]);

  const dynamicSub2 = useMemo(() => {
    if (selectedDeptFilter === 'all' || selectedSectionFilter === 'all') return [];
    const sub2s = new Set(
      expenses
        .filter(e => e.main_category === selectedDeptFilter && e.sub_category1 === selectedSectionFilter)
        .map(e => e.sub_category2)
        .filter(Boolean)
    );
    return Array.from(sub2s).sort() as string[];
  }, [expenses, selectedDeptFilter, selectedSectionFilter]);

  const dynamicSub3 = useMemo(() => {
    if (selectedDeptFilter === 'all' || selectedSectionFilter === 'all' || selectedSub2Filter === 'all') return [];
    const sub3s = new Set(
      expenses
        .filter(e => e.main_category === selectedDeptFilter && e.sub_category1 === selectedSectionFilter && e.sub_category2 === selectedSub2Filter)
        .map(e => e.sub_category3)
        .filter(Boolean)
    );
    return Array.from(sub3s).sort() as string[];
  }, [expenses, selectedDeptFilter, selectedSectionFilter, selectedSub2Filter]);

  // Reset child filters if parent filter changes
  useEffect(() => {
    setSelectedSectionFilter('all');
    setSelectedSub2Filter('all');
    setSelectedSub3Filter('all');
  }, [selectedDeptFilter]);

  useEffect(() => {
    setSelectedSub2Filter('all');
    setSelectedSub3Filter('all');
  }, [selectedSectionFilter]);

  useEffect(() => {
    setSelectedSub3Filter('all');
  }, [selectedSub2Filter]);

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter(expense => {
      // Dept filter
      if (selectedDeptFilter !== 'all' && expense.main_category !== selectedDeptFilter) {
        return false;
      }
      // Section filter
      if (selectedSectionFilter !== 'all' && expense.sub_category1 !== selectedSectionFilter) {
        return false;
      }
      // Sub 2 filter
      if (selectedSub2Filter !== 'all' && expense.sub_category2 !== selectedSub2Filter) {
        return false;
      }
      // Sub 3 filter
      if (selectedSub3Filter !== 'all' && expense.sub_category3 !== selectedSub3Filter) {
        return false;
      }
      
      // Categorization filter
      if (categorizationFilter === 'categorized' && expense.main_category === 'Uncategorized') {
        return false;
      }
      if (categorizationFilter === 'uncategorized' && expense.main_category !== 'Uncategorized') {
        return false;
      }

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const resolvedDept = (expense.main_category || '-').toLowerCase();
      const resolvedSection = (expense.sub_category1 || '-').toLowerCase();
      
      return (
        resolvedDept.includes(q) ||
        resolvedSection.includes(q) ||
        (expense.sub_category2 || '').toLowerCase().includes(q) ||
        (expense.sub_category3 || '').toLowerCase().includes(q) ||
        (expense.vendor || '').toLowerCase().includes(q) ||
        (expense.purchased_by || '').toLowerCase().includes(q)
      );
    });

    // Sort by date descending (newest first)
    return filtered.sort((a, b) => {
      // The cards currently display expense.created_at
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      
      const isValidA = !isNaN(dateA) && dateA > 0;
      const isValidB = !isNaN(dateB) && dateB > 0;
      
      if (isValidA && isValidB) return dateB - dateA;
      if (isValidA && !isValidB) return -1;
      if (!isValidA && isValidB) return 1;
      return 0;
    });
  }, [expenses, selectedDeptFilter, selectedSectionFilter, selectedSub2Filter, selectedSub3Filter, categorizationFilter, searchQuery]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const groupedExpenses = useMemo(() => {
    const groups: Record<string, FinanceExpenseType[]> = {};
    filteredExpenses.forEach(expense => {
      const dateKey = formatDate(expense.created_at);
      const validKey = dateKey === '-' || dateKey === 'Invalid Date' ? 'Date Not Available' : dateKey;
      if (!groups[validKey]) {
        groups[validKey] = [];
      }
      groups[validKey].push(expense);
    });
    
    // Maintain the sorted order of keys from filteredExpenses
    const orderedKeys = Array.from(new Set(filteredExpenses.map(expense => {
       const dateKey = formatDate(expense.created_at);
       return dateKey === '-' || dateKey === 'Invalid Date' ? 'Date Not Available' : dateKey;
    })));
    
    return orderedKeys.map(key => ({
      date: key,
      items: groups[key]
    }));
  }, [filteredExpenses]);

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
        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center flex-wrap">
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
            className="w-full sm:w-auto min-w-[140px] bg-card border border-border/50 text-main text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">All Departments</option>
            {dynamicDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Section Filter */}
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            disabled={selectedDeptFilter === 'all'}
            className="w-full sm:w-auto min-w-[140px] bg-card border border-border/50 text-main text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          >
            <option value="all">All Sections</option>
            {dynamicSections.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          {/* Sub Category 2 Filter */}
          <select
            value={selectedSub2Filter}
            onChange={(e) => setSelectedSub2Filter(e.target.value)}
            disabled={selectedSectionFilter === 'all'}
            className="w-full sm:w-auto min-w-[140px] bg-card border border-border/50 text-main text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          >
            <option value="all">All Sub Categories 2</option>
            {dynamicSub2.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          {/* Sub Category 3 Filter */}
          <select
            value={selectedSub3Filter}
            onChange={(e) => setSelectedSub3Filter(e.target.value)}
            disabled={selectedSub2Filter === 'all'}
            className="w-full sm:w-auto min-w-[140px] bg-card border border-border/50 text-main text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          >
            <option value="all">All Sub Categories 3</option>
            {dynamicSub3.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          {/* Categorization Filter */}
          <select
            value={categorizationFilter}
            onChange={(e) => setCategorizationFilter(e.target.value as any)}
            className="w-full sm:w-auto min-w-[140px] bg-card border border-border/50 text-main text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
          >

            <option value="all">All</option>
            <option value="categorized">Categorized</option>
            <option value="uncategorized">Uncategorized</option>
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
              <div className="flex flex-col gap-8 pb-8">
                {groupedExpenses.map(group => (
                  <div key={group.date} className="flex flex-col gap-5">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-border/50 flex-1"></div>
                      <h4 className="text-sm font-medium text-muted uppercase tracking-wider">{group.date}</h4>
                      <div className="h-px bg-border/50 flex-1"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 items-start">
                      {group.items.map(expense => (
                        <FinanceInfoCard
                          key={expense.id}
                          title={expense.main_category || '-'}
                          subtitle={`${expense.sub_category1 || '-'}${expense.sub_category2 ? ` › ${expense.sub_category2}` : ''}`}
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
                            { label: "Payment Mode", value: expense.payment_mode || '-' },
                            { label: "Purchased By", value: expense.purchased_by || '-' },
                            { label: "GST Status", value: expense.gst_status || '-' },
                          ]}
                        />
                      ))}
                    </div>
                  </div>
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
