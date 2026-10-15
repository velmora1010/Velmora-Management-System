import { useState, useEffect, useMemo } from 'react';
import { Search, X, Plus, RefreshCw } from 'lucide-react';
import { useExpenses, type FinanceExpense as FinanceExpenseType } from '../../hooks/finance/useExpenses';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseCardEditor } from './ExpenseCardEditor';
import { ExpenseCard } from './ExpenseCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { supabase } from '../../lib/supabase';
import { UploadExpense } from './UploadExpense';
import { ExpenseAnalytics } from './ExpenseAnalytics';
import toast from 'react-hot-toast';

export const FinanceExpense = () => {
  const { expenses, isLoading, archiveExpense, refreshExpenses } = useExpenses();
  const [searchQuery, setSearchQuery] = useState('');
  const [categorizationFilter, setCategorizationFilter] = useState<'all' | 'categorized' | 'uncategorized'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshExpenses();
      toast.success('Expenses refreshed successfully.');
    } catch (err) {
      console.error('Failed to refresh expenses:', err);
      toast.error('Failed to refresh expenses.');
    } finally {
      setIsRefreshing(false);
    }
  };


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

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDeptFilter('all');
    setSelectedSectionFilter('all');
    setSelectedSub2Filter('all');
    setSelectedSub3Filter('all');
    setCategorizationFilter('all');
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
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'add'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          Add Expense
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upload'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          Upload Expense
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'view'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          View Expense
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'analytics'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          Expense Analytics
        </button>
      </div>

      {activeTab === 'view' && (
        <div className="mb-6 overflow-x-auto custom-scrollbar pb-1">
          <div className="flex flex-nowrap items-center gap-2 w-full min-w-max">
            {/* 1. Search Expenses Input */}
            <div className="relative flex-1 min-w-[170px] max-w-xs shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[42px] bg-slate-800/80 border border-slate-700/80 text-slate-100 text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* 2. Department Filter */}
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="h-[42px] shrink-0 bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all max-w-[150px] truncate cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All Departments</option>
              {dynamicDepartments.map((dept) => (
                <option key={dept} value={dept} className="bg-slate-900 text-slate-100">{dept}</option>
              ))}
            </select>

            {/* 3. Section Filter */}
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              disabled={selectedDeptFilter === 'all'}
              className="h-[42px] shrink-0 bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed max-w-[140px] truncate cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All Sections</option>
              {dynamicSections.map((sec) => (
                <option key={sec} value={sec} className="bg-slate-900 text-slate-100">{sec}</option>
              ))}
            </select>

            {/* 4. Sub Category 2 Filter */}
            <select
              value={selectedSub2Filter}
              onChange={(e) => setSelectedSub2Filter(e.target.value)}
              disabled={selectedSectionFilter === 'all'}
              className="h-[42px] shrink-0 bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed max-w-[155px] truncate cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All Sub Categories 2</option>
              {dynamicSub2.map((sec) => (
                <option key={sec} value={sec} className="bg-slate-900 text-slate-100">{sec}</option>
              ))}
            </select>

            {/* 5. Sub Category 3 Filter */}
            <select
              value={selectedSub3Filter}
              onChange={(e) => setSelectedSub3Filter(e.target.value)}
              disabled={selectedSub2Filter === 'all'}
              className="h-[42px] shrink-0 bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed max-w-[155px] truncate cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All Sub Categories 3</option>
              {dynamicSub3.map((sec) => (
                <option key={sec} value={sec} className="bg-slate-900 text-slate-100">{sec}</option>
              ))}
            </select>

            {/* 6. Categorization Status Filter */}
            <select
              value={categorizationFilter}
              onChange={(e) => setCategorizationFilter(e.target.value as any)}
              className="h-[42px] shrink-0 bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all max-w-[125px] cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All</option>
              <option value="categorized" className="bg-slate-900 text-slate-100">Categorized</option>
              <option value="uncategorized" className="bg-slate-900 text-slate-100">Uncategorized</option>
            </select>

            {/* 7. Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="h-[42px] shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:border-purple-500/50 hover:bg-slate-700/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:opacity-50 ml-auto"
              title="Refresh Expenses"
              aria-label="Refresh Expenses"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-purple-400" : "text-slate-400"} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* 8. Expense Count Badge */}
            <span className="h-[42px] shrink-0 inline-flex items-center px-3.5 rounded-xl text-xs font-medium bg-slate-800/80 border border-slate-700/80 text-slate-400 whitespace-nowrap">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'}
              {(searchQuery || selectedDeptFilter !== 'all' || selectedSectionFilter !== 'all' || selectedSub2Filter !== 'all' || selectedSub3Filter !== 'all' || categorizationFilter !== 'all') && ` of ${expenses.length}`}
            </span>

            {/* Optional Clear Filters Button */}
            {(searchQuery || selectedDeptFilter !== 'all' || selectedSectionFilter !== 'all' || selectedSub2Filter !== 'all' || selectedSub3Filter !== 'all' || categorizationFilter !== 'all') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="h-[42px] shrink-0 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Clear all filters"
              >
                Clear
              </button>
            )}
          </div>
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
          <ExpenseAnalytics expenses={expenses} />
        )}

        {activeTab === 'view' && (
          <>
            {isLoading && expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/20 border-t-purple-500"></div>
                <span className="text-xs text-slate-400">Loading expenses...</span>
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
                <div className="w-16 h-16 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4">
                  📉
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-1.5">No expenses recorded yet</h3>
                <p className="text-slate-400 text-sm max-w-md mb-5">
                  Click &apos;+ Add Expense&apos; to log your first company expenditure.
                </p>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 transition-all"
                >
                  <Plus size={16} />
                  Add First Expense
                </button>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
                <div className="w-16 h-16 bg-slate-800 text-slate-400 border border-slate-700 rounded-2xl flex items-center justify-center text-2xl mb-4">
                  🔍
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-1.5">No matching expenses found</h3>
                <p className="text-slate-400 text-sm max-w-md mb-5">
                  Try adjusting your search query or reset your filters to view more records.
                </p>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-8 pb-12">
                {groupedExpenses.map(group => (
                  <div key={group.date} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-slate-700/60 flex-1"></div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3.5 py-1 rounded-full bg-slate-800/90 border border-slate-700/70 shadow-sm">
                        {group.date}
                      </span>
                      <div className="h-px bg-slate-700/60 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
                      {group.items.map(expense => (
                        <ExpenseCard
                          key={expense.id}
                          expense={expense}
                          onEdit={() => handleEdit(expense)}
                          onDelete={() => expense.id && handleDelete(expense.id)}
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
