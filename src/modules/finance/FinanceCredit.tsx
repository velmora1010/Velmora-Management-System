import { useState, useMemo, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { UploadCredit } from './UploadCredit';
import { useCredits, type FinanceCredit as FinanceCreditType } from '../../hooks/finance/useCredits';
import { FinanceInfoCard } from '../../components/ui/FinanceInfoCard';
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

  return (
    <div className="flex flex-col h-full fade-in text-slate-200">
      {/* Finance Sub Navigation */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'upload'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Upload Credit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('view')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'view'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          View Credit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Credit Analytics
        </button>
      </div>

      {activeTab === 'view' && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Search credits..."
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
            <option value="all">All Main Categories</option>
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
            <option value="all">All Sub Categories 1</option>
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
            className="ml-auto w-full sm:w-auto flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/20 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-primary/20 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
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
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredCredits.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border/50 shadow-sm mt-4">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl mb-4">
                  💳
                </div>
                <h3 className="text-xl font-semibold text-main mb-2">No credits found</h3>
                <p className="text-muted max-w-md">
                  {searchQuery || selectedDeptFilter !== 'all' || selectedSectionFilter !== 'all' 
                    ? "Try adjusting your search or filters." 
                    : "Click 'Upload Credit' to import your first credit statement."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8 pb-8">
                {groupedCredits.map(group => (
                  <div key={group.date} className="flex flex-col gap-5">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-border/50 flex-1"></div>
                      <h4 className="text-sm font-medium text-muted uppercase tracking-wider">{group.date}</h4>
                      <div className="h-px bg-border/50 flex-1"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 items-start">
                      {group.items.map(credit => (
                        <FinanceInfoCard
                          key={credit.id}
                          title={credit.main_category || '-'}
                          subtitle={`${credit.sub_category1 || '-'}${credit.sub_category2 ? ` › ${credit.sub_category2}` : ''}`}
                          badges={[credit.source || 'No Source']}
                          onEdit={() => handleEdit(credit)}
                          onDelete={() => credit.id && handleDelete(credit.id)}
                          editTooltip="Edit Credit"
                          deleteTooltip="Archive Credit"
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
                          fields={[
                            { label: "Amount", value: `₹${credit.amount ?? '-'}` },
                            { label: "Payment Mode", value: credit.payment_mode || '-' },
                            { label: "Bank Account", value: credit.bank_account || '-' },
                            { 
                              label: "Notes", 
                              value: credit.notes ? (
                                <div className="line-clamp-3 relative group/notes cursor-help" title={credit.notes}>
                                  {credit.notes}
                                </div>
                              ) : '-' 
                            },
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
