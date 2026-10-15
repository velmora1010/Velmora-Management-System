import { useState, useEffect } from 'react';
import { Search, X, Plus, RefreshCw } from 'lucide-react';
import { useBills, type FinanceBill } from '../../hooks/finance/useBills';
import { BillAnalytics } from './BillAnalytics';
import { BillForm } from './BillForm';
import { BillCardEditor } from './BillCardEditor';
import { BillCard } from './BillCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { departmentService } from '../../services/departmentService';
import { supabase } from '../../lib/supabase';
import type { Department, DepartmentSection } from '../../types';
import toast from 'react-hot-toast';

export const FinanceBills = () => {
  const { bills, isLoading, archiveBill, refreshBills } = useBills();
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'analytics'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshBills();
      toast.success('Bills refreshed successfully.');
    } catch (err) {
      console.error('Failed to refresh bills:', err);
      toast.error('Failed to refresh bills.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Form state
  const [editingBill, setEditingBill] = useState<FinanceBill | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);

  // Mappings
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<DepartmentSection[]>([]);

  useEffect(() => {
    const loadMappings = async () => {
      try {
        const { data: depts } = await departmentService.getAllDepartments();
        if (depts) setDepartments(depts);

        const { data: secs } = await departmentService.getAllSections();
        if (secs) setSections(secs);
      } catch (err) {
        console.error('Failed to load mappings in FinanceBills:', err);
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

  const filteredBills = bills.filter(bill => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const resolvedDept = getDeptName(bill.main_category).toLowerCase();
    const resolvedSection = getSectionName(bill.sub_category1).toLowerCase();

    return (
      resolvedDept.includes(q) ||
      resolvedSection.includes(q) ||
      (bill.payment_type || '').toLowerCase().includes(q) ||
      (bill.bill_status || '').toLowerCase().includes(q)
    );
  });

  const handleEdit = (bill: FinanceBill) => {
    setEditingId(bill.id || null);
  };

  const handleAddNew = () => {
    setEditingId(null);
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
    <div className="flex flex-col h-full fade-in text-slate-200">
      {/* Finance Sub Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={handleAddNew}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'add'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          Add Bill
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'list'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          View Bills
        </button>
        <button
          onClick={() => {}}
          className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white"
        >
          Upcoming Bills
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'analytics'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          Bill Analytics
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search bills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl pl-10 pr-9 py-2.5 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-purple-500/50 hover:bg-slate-700/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:opacity-50"
              title="Refresh Bills"
              aria-label="Refresh Bills"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-purple-400" : "text-slate-400"} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <span className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/80 border border-slate-700/80 text-slate-400">
              {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
              {searchQuery && ` of ${bills.length}`}
            </span>
          </div>
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
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/20 border-t-purple-500"></div>
                <span className="text-xs text-slate-400">Loading bills...</span>
              </div>
            ) : bills.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
                <div className="w-16 h-16 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4">
                  🧾
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-1.5">No bills recorded yet</h3>
                <p className="text-slate-400 text-sm max-w-md mb-5">
                  Keep track of recurring company bills, utility payments, and subscriptions in one organized place.
                </p>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 transition-all"
                >
                  <Plus size={16} />
                  Add First Bill
                </button>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
                <div className="w-16 h-16 bg-slate-800 text-slate-400 border border-slate-700 rounded-2xl flex items-center justify-center text-2xl mb-4">
                  🔍
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-1.5">No matching bills found</h3>
                <p className="text-slate-400 text-sm max-w-md mb-5">
                  No bills matched &ldquo;{searchQuery}&rdquo;. Try checking for typos or searching by department or status.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
                {filteredBills.map(bill => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    departmentName={getDeptName(bill.main_category)}
                    categoryHierarchy={`${getSectionName(bill.sub_category1)}${bill.sub_category2 ? ` › ${bill.sub_category2}` : ''}`}
                    onEdit={() => handleEdit(bill)}
                    onDelete={() => bill.id && handleDelete(bill.id)}
                    isEditing={editingId === bill.id}
                    onCancelEdit={() => setEditingId(null)}
                    formId={`edit-bill-${bill.id}`}
                    formatDate={formatDate}
                    renderEditForm={() => (
                      <BillCardEditor
                        bill={bill}
                        formId={`edit-bill-${bill.id}`}
                        onClose={() => setEditingId(null)}
                        onSuccess={() => setEditingId(null)}
                      />
                    )}
                  />
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
