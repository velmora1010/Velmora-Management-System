import React, { useState, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  Search,
  X,
  RefreshCw,
  Receipt,
  DollarSign,
  CreditCard,
  Layers,
  UploadCloud,
  Calendar,
  ArrowUpDown,
  CheckSquare,
  Square,
  User,
  Building2,
  Tag,
  Inbox,
  Filter,
} from 'lucide-react';
import { useRecycleBin, type RecycleBinItem, type RecycleBinItemType } from '../../hooks/finance/useRecycleBin';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

type CategoryFilter = 'all' | 'bill' | 'expense' | 'credit' | 'po' | 'file';
type FileSourceFilter = 'all' | 'credit' | 'expense';
type SortOption = 'newest' | 'oldest' | 'amount-desc' | 'amount-asc';

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  isDestructive: boolean;
  action: () => Promise<void>;
}

export const BillsRecycleBin: React.FC = () => {
  const {
    items,
    isLoading,
    error,
    counts,
    refresh,
    restoreItem,
    permanentlyDeleteItem,
    restoreBulk,
    permanentlyDeleteBulk,
  } = useRecycleBin();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [fileSourceFilter, setFileSourceFilter] = useState<FileSourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    isDestructive: true,
    action: async () => {},
  });

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refresh();
      toast.success('Recycle bin refreshed successfully.');
    } catch (err) {
      console.error('Failed to refresh recycle bin:', err);
      toast.error('Failed to refresh recycle bin.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setFileSourceFilter('all');
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Category tab filter
      if (activeCategory !== 'all' && item.type !== activeCategory) {
        return false;
      }

      // 2. Files source filter (Credit vs Expense vs All)
      if (activeCategory === 'file' && fileSourceFilter !== 'all') {
        const source = item.fileSource || item.raw?.fileCategory || (item.source === 'Credit Statement' ? 'credit' : 'expense');
        if (source !== fileSourceFilter) {
          return false;
        }
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchVendor = (item.vendorOrSource || '').toLowerCase().includes(q);
        const matchModule = (item.module || '').toLowerCase().includes(q);
        const matchHierarchy = (item.categoryHierarchy || '').toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        const matchSource = (item.source || '').toLowerCase().includes(q);
        const matchAmount = item.amount != null && String(item.amount).includes(q);
        const matchDeletedBy = (item.deletedBy || '').toLowerCase().includes(q);

        return (
          matchTitle ||
          matchVendor ||
          matchModule ||
          matchHierarchy ||
          matchNotes ||
          matchSource ||
          matchAmount ||
          matchDeletedBy
        );
      }

      return true;
    });
  }, [items, activeCategory, fileSourceFilter, searchQuery]);

  // Sort items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        const dateB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        const dateA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        const dateB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === 'amount-desc') {
        const amtA = a.amount ?? -Infinity;
        const amtB = b.amount ?? -Infinity;
        return amtB - amtA;
      }
      if (sortBy === 'amount-asc') {
        const amtA = a.amount ?? Infinity;
        const amtB = b.amount ?? Infinity;
        return amtA - amtB;
      }
      return 0;
    });
    return list;
  }, [filteredItems, sortBy]);

  // Multi-select helpers
  const isAllSelected = sortedItems.length > 0 && sortedItems.every((i) => selectedIds.has(i.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedItems.map((i) => i.id)));
    }
  };

  // Restore handlers
  const handleOpenRestoreSingle = (item: RecycleBinItem) => {
    const targetLabel = item.type === 'file' ? 'active Import History' : `active ${item.module}`;
    setConfirmModal({
      isOpen: true,
      title: 'Restore Record',
      message: `Are you sure you want to restore "${item.title}" back to ${targetLabel}?`,
      confirmText: 'Restore',
      isDestructive: false,
      action: async () => {
        const res = await restoreItem(item);
        if (res.success) {
          toast.success(`Restored "${item.title}" successfully.`);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        } else {
          toast.error(res.error || 'Failed to restore item.');
        }
      },
    });
  };

  const handleOpenRestoreBulk = () => {
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: `Restore ${selectedItems.length} Items`,
      message: `Are you sure you want to restore these ${selectedItems.length} items back to their active modules / import histories?`,
      confirmText: 'Restore All',
      isDestructive: false,
      action: async () => {
        const res = await restoreBulk(selectedItems);
        if (res.success) {
          toast.success(`Successfully restored ${res.count} items.`);
          setSelectedIds(new Set());
        } else {
          toast.error(res.error || 'Failed to restore items.');
        }
      },
    });
  };

  // Delete handlers
  const handleOpenDeleteSingle = (item: RecycleBinItem) => {
    const isFile = item.type === 'file';
    setConfirmModal({
      isOpen: true,
      title: isFile ? 'Permanently Delete Statement' : 'Permanently Delete Record',
      message: isFile
        ? `Are you sure you want to permanently delete "${item.title}"? This will permanently delete the uploaded file record and its associated imported transactions from the database. This action is irreversible.`
        : `Are you sure you want to permanently delete "${item.title}"? This action is irreversible and the record will be completely removed from the database.`,
      confirmText: 'Delete Permanently',
      isDestructive: true,
      action: async () => {
        const res = await permanentlyDeleteItem(item);
        if (res.success) {
          toast.success(`Permanently deleted "${item.title}".`);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        } else {
          toast.error(res.error || 'Failed to permanently delete item.');
        }
      },
    });
  };

  const handleOpenDeleteBulk = () => {
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: `Permanently Delete ${selectedItems.length} Items`,
      message: `Are you sure you want to permanently delete these ${selectedItems.length} items? This action is irreversible and all selected records and statement imports will be permanently erased.`,
      confirmText: 'Delete Permanently',
      isDestructive: true,
      action: async () => {
        const res = await permanentlyDeleteBulk(selectedItems);
        if (res.success) {
          toast.success(`Successfully permanently deleted ${res.count} records.`);
          setSelectedIds(new Set());
        } else {
          toast.error(res.error || 'Failed to permanently delete records.');
        }
      },
    });
  };

  const formatAmount = (val: number | null) => {
    if (val === null || val === undefined) return null;
    return (
      '₹' +
      Number(val).toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderTypeBadge = (type: RecycleBinItemType) => {
    switch (type) {
      case 'bill':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Receipt size={12} />
            Bill
          </span>
        );
      case 'expense':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <DollarSign size={12} />
            Expense
          </span>
        );
      case 'credit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CreditCard size={12} />
            Credit
          </span>
        );
      case 'po':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Layers size={12} />
            PO History
          </span>
        );
      case 'file':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
            <UploadCloud size={12} />
            File
          </span>
        );
      default:
        return null;
    }
  };

  const tabs: { key: CategoryFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Items', count: counts.total },
    { key: 'bill', label: 'Bills', count: counts.bills },
    { key: 'expense', label: 'Expenses', count: counts.expenses },
    { key: 'credit', label: 'Credit', count: counts.credits },
    { key: 'po', label: 'PO History', count: counts.po },
    { key: 'file', label: 'Files', count: counts.files },
  ];

  return (
    <div className="flex flex-col h-full fade-in text-slate-200">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/10">
            <Trash2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Recycle Bin</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-300">
                {counts.total} {counts.total === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Manage deleted financial records and uploaded files.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="h-[40px] inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-4 text-xs font-semibold text-slate-200 transition-colors hover:border-purple-500/50 hover:bg-slate-700/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:opacity-50"
            title="Refresh Recycle Bin"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-purple-400' : 'text-slate-400'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        {/* Total Deleted Items */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:border-slate-600/80 transition-all">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Total Deleted Items
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              {counts.total}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              Across all finance modules
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Trash2 size={22} />
          </div>
        </div>

        {/* Deleted Records */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:border-slate-600/80 transition-all">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Deleted Records
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              {counts.records}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              Bills, expenses, credits &amp; POs
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Receipt size={22} />
          </div>
        </div>

        {/* Deleted Files */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:border-slate-600/80 transition-all">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Deleted Files
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              {counts.files}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              Imported statements &amp; documents
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <UploadCloud size={22} />
          </div>
        </div>
      </div>

      {/* 3. Category Navigation Tabs (6 exact tabs) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeCategory === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveCategory(tab.key);
                if (tab.key !== 'file') {
                  setFileSourceFilter('all');
                }
              }}
              className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
                  : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-700/80 text-slate-400 group-hover:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Search and Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search deleted items by title, source, amount, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 text-slate-100 text-xs sm:text-sm rounded-xl pl-10 pr-9 py-2.5 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
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

        {/* Sort & Count & Clear */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Filter by Source dropdown (active on Files tab) */}
          {activeCategory === 'file' && (
            <div className="relative shrink-0">
              <select
                value={fileSourceFilter}
                onChange={(e) => setFileSourceFilter(e.target.value as FileSourceFilter)}
                aria-label="Filter by Source"
                title="Filter by Source"
                className="h-[42px] appearance-none bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs font-semibold rounded-xl pl-9 pr-8 py-2.5 hover:border-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-slate-100">All Sources</option>
                <option value="credit" className="bg-slate-900 text-slate-100">Credit</option>
                <option value="expense" className="bg-slate-900 text-slate-100">Expense</option>
              </select>
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-[42px] appearance-none bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs font-semibold rounded-xl pl-9 pr-8 py-2.5 hover:border-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all cursor-pointer"
            >
              <option value="newest" className="bg-slate-900 text-slate-100">Newest Deleted First</option>
              <option value="oldest" className="bg-slate-900 text-slate-100">Oldest Deleted First</option>
              <option value="amount-desc" className="bg-slate-900 text-slate-100">Amount: High to Low</option>
              <option value="amount-asc" className="bg-slate-900 text-slate-100">Amount: Low to High</option>
            </select>
            <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Item count badge */}
          <span className="h-[42px] shrink-0 inline-flex items-center px-3.5 rounded-xl text-xs font-medium bg-slate-800/80 border border-slate-700/80 text-slate-400 whitespace-nowrap">
            {sortedItems.length} {sortedItems.length === 1 ? 'item' : 'items'}
            {(searchQuery || activeCategory !== 'all' || (activeCategory === 'file' && fileSourceFilter !== 'all')) && ` of ${items.length}`}
          </span>

          {/* Clear filters button */}
          {(searchQuery || activeCategory !== 'all' || fileSourceFilter !== 'all') && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-[42px] shrink-0 px-3.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Clear all filters"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* 5. Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-800/95 border border-purple-500/40 backdrop-blur-md rounded-2xl p-3 sm:px-4 sm:py-3 shadow-xl shadow-purple-900/10 flex flex-wrap items-center justify-between gap-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              {isAllSelected ? (
                <CheckSquare size={16} className="text-purple-400" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              <span>{isAllSelected ? 'Deselect All' : `Select All (${sortedItems.length})`}</span>
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <span className="text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">
              {selectedIds.size} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenRestoreBulk}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 transition-all"
            >
              <RotateCcw size={14} />
              <span>Restore Selected ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={handleOpenDeleteBulk}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white shadow-sm shadow-rose-600/30 transition-all"
            >
              <Trash2 size={14} />
              <span>Delete Permanently ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Main Content / List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10">
        {isLoading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/20 border-t-purple-500"></div>
            <span className="text-xs text-slate-400">Loading recycle bin records...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-rose-500/5 rounded-2xl border border-rose-500/20 shadow-sm mt-4">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center text-2xl mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-semibold text-rose-200 mb-1">Failed to load recycle bin</h3>
            <p className="text-slate-400 text-xs max-w-md mb-4">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          /* Empty state: 0 items in recycle bin */
          <div className="flex flex-col items-center justify-center p-12 sm:p-16 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
            <div className="w-16 h-16 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm shadow-purple-500/10">
              <Inbox size={28} />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-1.5">Recycle Bin is Empty</h3>
            <p className="text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
              No deleted financial records or uploaded files found. When items are archived or removed from Bills, Expenses, Credit, PO History, or Uploads, they will appear here.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 transition-all"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        ) : sortedItems.length === 0 ? (
          /* Empty state: filter/search matches 0 items */
          <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 shadow-sm mt-4 fade-in">
            <div className="w-14 h-14 bg-slate-800 text-slate-400 border border-slate-700 rounded-2xl flex items-center justify-center text-2xl mb-3">
              <Search size={22} />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">No matching deleted items</h3>
            <p className="text-slate-400 text-xs max-w-md mb-4">
              {activeCategory === 'file' && fileSourceFilter !== 'all'
                ? 'Try adjusting your search query, source filter, or selecting a different category tab.'
                : 'Try adjusting your search query or selecting a different category tab.'}
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
          /* List of Deleted Items */
          <div className="flex flex-col gap-3">
            {sortedItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const formattedAmt = formatAmount(item.amount);

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`bg-slate-800/40 hover:bg-slate-800/70 border ${
                    isSelected ? 'border-purple-500/60 bg-purple-500/5' : 'border-slate-700/60'
                  } rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}
                >
                  {/* Left: Checkbox & Info */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleSelect(item.id)}
                      className="mt-1 shrink-0 text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                      aria-label={isSelected ? 'Deselect item' : 'Select item'}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-purple-400" />
                      ) : (
                        <Square size={18} className="text-slate-500" />
                      )}
                    </button>

                    {/* Metadata details */}
                    <div className="min-w-0 flex-1">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {renderTypeBadge(item.type)}

                        {item.categoryHierarchy && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 rounded-lg truncate max-w-xs">
                            <Building2 size={11} className="text-slate-500 shrink-0" />
                            <span className="truncate">{item.categoryHierarchy}</span>
                          </span>
                        )}

                        {item.deletedAt && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded-lg">
                            <Calendar size={11} className="text-slate-500" />
                            {formatDate(item.deletedAt)}
                          </span>
                        )}
                      </div>

                      {/* Main Title */}
                      <h4 className="text-sm sm:text-base font-semibold text-slate-100 truncate mb-1">
                        {item.title}
                      </h4>

                      {/* Details row: Source, Deleted By, Notes */}
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400">
                        {item.source && (
                          <span className="inline-flex items-center gap-1">
                            <Tag size={11} className="text-slate-500" />
                            <span>Source: <strong className="text-slate-300 font-normal">{item.source}</strong></span>
                          </span>
                        )}

                        {item.deletedBy && (
                          <span className="inline-flex items-center gap-1">
                            <User size={11} className="text-slate-500" />
                            <span>By: <strong className="text-slate-300 font-normal">{item.deletedBy}</strong></span>
                          </span>
                        )}

                        {item.notes && (
                          <span className="text-slate-400 truncate max-w-sm italic">
                            &quot;{item.notes}&quot;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-3 md:pt-0 border-t border-slate-700/40 md:border-t-0">
                    {/* Amount */}
                    <div className="text-left md:text-right">
                      {formattedAmt ? (
                        <div className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                          {formattedAmt}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-medium">
                          {item.type === 'file' ? (item.categoryHierarchy || 'Statement Batch') : '-'}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenRestoreSingle(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 transition-all shadow-sm"
                        title="Restore record"
                      >
                        <RotateCcw size={13} className="text-emerald-400" />
                        <span>Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDeleteSingle(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-all shadow-sm"
                        title="Permanently delete from database"
                      >
                        <Trash2 size={13} className="text-rose-400" />
                        <span>Delete Permanently</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText="Cancel"
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.action}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
