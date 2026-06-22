import { useState } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';
import { useBills, type FinanceBill } from '../../hooks/finance/useBills';
import { BillAnalytics } from './BillAnalytics';
import { BillForm } from './BillForm';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const FinanceBills = () => {
  const { bills, isLoading, archiveBill, refreshBills } = useBills();
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'analytics'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [editingBill, setEditingBill] = useState<FinanceBill | null>(null);

  // Modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);

  const filteredBills = bills.filter(bill => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (bill.main_category || '').toLowerCase().includes(q) ||
      (bill.sub_category1 || '').toLowerCase().includes(q) ||
      (bill.payment_type || '').toLowerCase().includes(q) ||
      (bill.bill_status || '').toLowerCase().includes(q)
    );
  });

  const handleEdit = (bill: FinanceBill) => {
    setEditingBill(bill);
    setActiveTab('add');
  };

  const handleAddNew = () => {
    setEditingBill(null);
    setActiveTab('add');
  };

  const handleDelete = (id: string) => {
    setBillToDelete(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (billToDelete) {
      await archiveBill(billToDelete);
      setBillToDelete(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
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
          Add Bill
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'list' 
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110' 
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          View Bills
        </button>
        <button
          onClick={() => {}}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5"
        >
          Upcoming Bills
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'analytics' 
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110' 
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Bill Analytics
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="relative w-full md:w-64 mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            placeholder="Search bills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border/50 text-main text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {activeTab === 'add' && (
          <BillForm 
            bill={editingBill} 
            onClose={() => setActiveTab('list')} 
            onSuccess={() => {
              setActiveTab('list');
              refreshBills();
            }} 
          />
        )}

        {activeTab === 'analytics' && (
          <BillAnalytics bills={bills} />
        )}

        {activeTab === 'list' && (
          <>
            {isLoading && bills.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border/50 shadow-sm mt-4 fade-in">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl mb-4">
                  🧾
                </div>
                <h3 className="text-xl font-semibold text-main mb-2">No bills found</h3>
                <p className="text-muted max-w-md">
                  {searchQuery ? "Try adjusting your search criteria." : "Click '+ Add Bill' to create your first bill."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredBills.map(bill => (
                  <div key={bill.id} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:border-border transition-colors group">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-main">
                            {bill.main_category || 'Uncategorized'}
                          </h3>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                            bill.bill_status === 'Paid' ? 'bg-green-500/10 text-green-500' :
                            bill.bill_status === 'Overdue' ? 'bg-red-500/10 text-red-500' :
                            'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500'
                          }`}>
                            {bill.bill_status}
                          </span>
                        </div>
                        <div className="text-sm text-muted mb-4">
                          {bill.sub_category1 || ''} 
                          {bill.sub_category2 ? ` › ${bill.sub_category2}` : ''}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-6">
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Amount</div>
                            <div className="text-sm font-semibold text-main">₹{bill.amount ?? '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Due Date</div>
                            <div className="text-sm text-main">{formatDate(bill.due_date)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Billing Cycle</div>
                            <div className="text-sm text-main">{bill.billing_cycle || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Payment Type</div>
                            <div className="text-sm text-main">{bill.payment_type || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Account</div>
                            <div className="text-sm text-main">{bill.account || '-'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col items-end gap-2 shrink-0">
                        <button 
                          onClick={() => handleEdit(bill)}
                          className="p-2 text-muted hover:text-primary bg-background rounded-lg hover:bg-primary/10 transition-colors"
                          title="Edit Bill"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => bill.id && handleDelete(bill.id)}
                          className="p-2 text-muted hover:text-red-500 bg-background rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Archive Bill"
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
        title="Archive Bill"
        message="Are you sure you want to archive this bill?"
        confirmText="Archive"
        onConfirm={executeDelete}
        onClose={() => {
          setIsConfirmOpen(false);
          setBillToDelete(null);
        }}
      />
    </div>
  );
};
