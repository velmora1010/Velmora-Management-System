import { useState } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';
import { useExpenses, type FinanceExpense as FinanceExpenseType } from '../../hooks/finance/useExpenses';
import { ExpenseForm } from './ExpenseForm';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const FinanceExpense = () => {
  const { expenses, isLoading, archiveExpense, refreshExpenses } = useExpenses();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab and Form state
  const [activeTab, setActiveTab] = useState<'view' | 'add' | 'analytics'>('view');
  const [editingExpense, setEditingExpense] = useState<FinanceExpenseType | null>(null);

  // Modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const filteredExpenses = expenses.filter(expense => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (expense.main_category || '').toLowerCase().includes(q) ||
      (expense.sub_category1 || '').toLowerCase().includes(q) ||
      (expense.vendor || '').toLowerCase().includes(q) ||
      (expense.purchased_by || '').toLowerCase().includes(q)
    );
  });

  const handleEdit = (expense: FinanceExpenseType) => {
    setEditingExpense(expense);
    setActiveTab('add');
  };

  const handleAddNew = () => {
    setEditingExpense(null);
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
    <div className="flex flex-col h-full fade-in">
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
        <div className="relative w-full md:w-64 mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border/50 text-main text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
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
                  {searchQuery ? "Try adjusting your search criteria." : "Click '+ Add Expense' to log your first expense."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredExpenses.map(expense => (
                  <div key={expense.id} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:border-border transition-colors group">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-main">
                            {expense.main_category || 'Uncategorized'}
                          </h3>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary`}>
                            {expense.vendor || 'No Vendor'}
                          </span>
                        </div>
                        <div className="text-sm text-muted mb-4">
                          {expense.sub_category1 || ''} 
                          {expense.sub_category2 ? ` › ${expense.sub_category2}` : ''}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-6">
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Amount</div>
                            <div className="text-sm font-semibold text-main">₹{expense.amount ?? '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Date</div>
                            <div className="text-sm text-main">{formatDate(expense.created_at)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Payment Mode</div>
                            <div className="text-sm text-main">{expense.payment_mode || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Purchased By</div>
                            <div className="text-sm text-main">{expense.purchased_by || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">GST Status</div>
                            <div className="text-sm text-main">{expense.gst_status || '-'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col items-end gap-2 shrink-0">
                        <button 
                          onClick={() => handleEdit(expense)}
                          className="p-2 text-muted hover:text-primary bg-background rounded-lg hover:bg-primary/10 transition-colors"
                          title="Edit Expense"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => expense.id && handleDelete(expense.id)}
                          className="p-2 text-muted hover:text-red-500 bg-background rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Archive Expense"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

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
