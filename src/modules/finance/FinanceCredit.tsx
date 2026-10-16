import { useState, useMemo, useEffect } from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import { UploadCredit } from './UploadCredit';
import { useCredits, type FinanceCredit as FinanceCreditType } from '../../hooks/finance/useCredits';
import { CreditCard } from './CreditCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CreditCardEditor } from './CreditCardEditor';
import { CreditAnalytics } from './CreditAnalytics';
import toast from 'react-hot-toast';

export const FinanceCredit = () => {
  const { credits, isLoading, archiveCredit, refreshCredits } = useCredits();

  // Tab state
  const [activeTab, setActiveTab] = useState<'view' | 'upload' | 'rules' | 'analytics'>('view');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [selectedSub2Filter, setSelectedSub2Filter] = useState<string>('all');
  const [categorizationFilter, setCategorizationFilter] = useState<'all' | 'categorized' | 'uncategorized'>('all');

  // Modal / Editing state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creditToDelete, setCreditToDelete] = useState<string | null>(null);

  // Dynamic Filters
  const dynamicDepartments = useMemo(() => {
    const depts = new Set(credits.map(e => e.main_category).filter(Boolean));
    return Array.from(depts).sort() as string[];
  }, [credits]);

  const dynamicSections = useMemo(() => {
    if (selectedDeptFilter === 'all') return [];
    const secs = new Set(
      credits
        .filter(e => e.main_category === selectedDeptFilter)
        .map(e => e.sub_category1)
        .filter(Boolean)
    );
    return Array.from(secs).sort() as string[];
  }, [credits, selectedDeptFilter]);

  const dynamicSub2 = useMemo(() => {
    if (selectedDeptFilter === 'all' || selectedSectionFilter === 'all') return [];
    const sub2s = new Set(
      credits
        .filter(e => e.main_category === selectedDeptFilter && e.sub_category1 === selectedSectionFilter)
        .map(e => e.sub_category2)
        .filter(Boolean)
    );
    return Array.from(sub2s).sort() as string[];
  }, [credits, selectedDeptFilter, selectedSectionFilter]);

  // Reset cascading filters
  useEffect(() => {
    setSelectedSectionFilter('all');
    setSelectedSub2Filter('all');
  }, [selectedDeptFilter]);

  useEffect(() => {
    setSelectedSub2Filter('all');
  }, [selectedSectionFilter]);

  // Filtering Logic
  const filteredCredits = useMemo(() => {
    const filtered = credits.filter(credit => {
      // Exclude archived credits visually
      if (credit.status === 'archived') return false;

      // Dept filter
      if (selectedDeptFilter !== 'all' && credit.main_category !== selectedDeptFilter) return false;
      // Section filter
      if (selectedSectionFilter !== 'all' && credit.sub_category1 !== selectedSectionFilter) return false;
      // Sub 2 filter
      if (selectedSub2Filter !== 'all' && credit.sub_category2 !== selectedSub2Filter) return false;

      // Categorization filter
      if (categorizationFilter === 'categorized' && credit.main_category === 'Uncategorized') return false;
      if (categorizationFilter === 'uncategorized' && credit.main_category !== 'Uncategorized') return false;

      // Search Query
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const resolvedDept = (credit.main_category || '-').toLowerCase();
      const resolvedSection = (credit.sub_category1 || '-').toLowerCase();

      return (
        resolvedDept.includes(q) ||
        resolvedSection.includes(q) ||
        (credit.sub_category2 || '').toLowerCase().includes(q) ||
        (credit.source || '').toLowerCase().includes(q) ||
        (credit.notes || '').toLowerCase().includes(q)
      );
    });

    // Sort by transaction_date descending (newest first)
    return filtered.sort((a, b) => {
      const dateA = a.transaction_date ? new Date(a.transaction_date).getTime() : 0;
      const dateB = b.transaction_date ? new Date(b.transaction_date).getTime() : 0;

      const isValidA = !isNaN(dateA) && dateA > 0;
      const isValidB = !isNaN(dateB) && dateB > 0;

      if (isValidA && isValidB) return dateB - dateA;
      if (isValidA && !isValidB) return -1;
      if (!isValidA && isValidB) return 1;
      return 0;
    });
  }, [credits, selectedDeptFilter, selectedSectionFilter, selectedSub2Filter, categorizationFilter, searchQuery]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const groupedCredits = useMemo(() => {
    const groups: Record<string, FinanceCreditType[]> = {};
    filteredCredits.forEach(credit => {
      const dateKey = formatDate(credit.transaction_date);
      const validKey = dateKey === '-' || dateKey === 'Invalid Date' ? 'Date Not Available' : dateKey;
      if (!groups[validKey]) {
        groups[validKey] = [];
      }
      groups[validKey].push(credit);
    });

    // Maintain sorted keys
    const orderedKeys = Array.from(new Set(filteredCredits.map(credit => {
       const dateKey = formatDate(credit.transaction_date);
       return dateKey === '-' || dateKey === 'Invalid Date' ? 'Date Not Available' : dateKey;
    })));

    return orderedKeys.map(key => ({
      date: key,
      items: groups[key]
    }));
  }, [filteredCredits]);

  const handleEdit = (credit: FinanceCreditType) => {
    setEditingId(credit.id || null);
  };

  const handleDelete = (id: string) => {
    setCreditToDelete(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (creditToDelete) {
      await archiveCredit(creditToDelete);
      setCreditToDelete(null);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDeptFilter('all');
    setSelectedSectionFilter('all');
    setSelectedSub2Filter('all');
    setCategorizationFilter('all');
  };

  return (
    <div className="flex flex-col lg:h-full fade-in text-slate-200">
      {/* Finance Sub Navigation */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upload'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          Upload Credit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('view')}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'view'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          View Credit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'analytics'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
              : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          Credit Analytics
        </button>
      </div>

      {activeTab === 'view' && (
        <div className="flex flex-col gap-3.5 mb-6">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                placeholder="Search credits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[42px] bg-slate-800/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl pl-10 pr-9 py-2 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
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

            {/* Department / Main Category Filter */}
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="h-[42px] bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All Main Categories</option>
              {dynamicDepartments.map((dept) => (
                <option key={dept} value={dept} className="bg-slate-900 text-slate-100">{dept}</option>
              ))}
            </select>

            {/* Section / Sub Category 1 Filter */}
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              disabled={selectedDeptFilter === 'all'}
              className="h-[42px] bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All Sub Categories 1</option>
              {dynamicSections.map((sec) => (
                <option key={sec} value={sec} className="bg-slate-900 text-slate-100">{sec}</option>
              ))}
            </select>

            {/* Sub Category 2 Filter */}
            <select
              value={selectedSub2Filter}
              onChange={(e) => setSelectedSub2Filter(e.target.value)}
              disabled={selectedSectionFilter === 'all'}
              className="h-[42px] bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All Sub Categories 2</option>
              {dynamicSub2.map((sec) => (
                <option key={sec} value={sec} className="bg-slate-900 text-slate-100">{sec}</option>
              ))}
            </select>

            {/* Categorization Filter */}
            <select
              value={categorizationFilter}
              onChange={(e) => setCategorizationFilter(e.target.value as any)}
              className="h-[42px] bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
            >
              <option value="all" className="bg-slate-900 text-slate-100">All</option>
              <option value="categorized" className="bg-slate-900 text-slate-100">Categorized</option>
              <option value="uncategorized" className="bg-slate-900 text-slate-100">Uncategorized</option>
            </select>

            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await refreshCredits();
                  toast.success('Credits refreshed successfully.');
                } catch (err) {
                  toast.error('Failed to refresh credits.');
                }
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="h-[42px] px-4 rounded-xl text-xs font-semibold bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 hover:text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              title="Refresh credits"
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Count & Reset */}
            <div className="ml-auto flex items-center gap-2">
              <span className="h-[42px] flex items-center px-3.5 rounded-xl text-xs font-medium bg-slate-800/80 border border-slate-700/80 text-slate-400">
                {filteredCredits.length} {filteredCredits.length === 1 ? 'credit' : 'credits'}
                {(searchQuery || selectedDeptFilter !== 'all' || selectedSectionFilter !== 'all' || selectedSub2Filter !== 'all' || categorizationFilter !== 'all') && ` of ${credits.length}`}
              </span>
              {(searchQuery || selectedDeptFilter !== 'all' || selectedSectionFilter !== 'all' || selectedSub2Filter !== 'all' || categorizationFilter !== 'all') && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="h-[42px] px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Clear all filters"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area Placeholder */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {activeTab === 'upload' && (
          <UploadCredit onClose={() => setActiveTab('view')} />
        )}

        {activeTab === 'view' && (
          <>
            {isLoading && credits.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/20 border-t-purple-500"></div>
                <span className="text-xs text-slate-400">Loading credits...</span>
              </div>
            ) : credits.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
                <div className="w-16 h-16 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4">
                  💳
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-1.5">No credits recorded yet</h3>
                <p className="text-slate-400 text-sm max-w-md mb-5">
                  Click &apos;Upload Credit&apos; to import your first credit statement.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 transition-all"
                >
                  Upload First Statement
                </button>
              </div>
            ) : filteredCredits.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
                <div className="w-16 h-16 bg-slate-800 text-slate-400 border border-slate-700 rounded-2xl flex items-center justify-center text-2xl mb-4">
                  🔍
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-1.5">No matching credits found</h3>
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
                {groupedCredits.map(group => (
                  <div key={group.date} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-slate-700/60 flex-1"></div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3.5 py-1 rounded-full bg-slate-800/90 border border-slate-700/70 shadow-sm">
                        {group.date}
                      </span>
                      <div className="h-px bg-slate-700/60 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
                      {group.items.map(credit => (
                        <CreditCard
                          key={credit.id}
                          credit={credit}
                          onEdit={() => handleEdit(credit)}
                          onDelete={() => credit.id && handleDelete(credit.id)}
                          isEditing={editingId === credit.id}
                          formId={`edit-credit-${credit.id}`}
                          onCancelEdit={() => setEditingId(null)}
                          renderEditForm={() => (
                            <CreditCardEditor
                              credit={credit}
                              formId={`edit-credit-${credit.id}`}
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

        {activeTab === 'analytics' && (
          <CreditAnalytics
            credits={credits}
            onRefresh={async () => {
              setIsRefreshing(true);
              try {
                await refreshCredits();
                toast.success('Credits refreshed successfully.');
              } catch (err) {
                toast.error('Failed to refresh credits.');
              }
              setIsRefreshing(false);
            }}
            isRefreshing={isRefreshing}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Archive Credit"
        message="Are you sure you want to archive this credit transaction?"
        confirmText="Archive"
        onConfirm={executeDelete}
        onClose={() => {
          setIsConfirmOpen(false);
          setCreditToDelete(null);
        }}
      />
    </div>
  );
};
