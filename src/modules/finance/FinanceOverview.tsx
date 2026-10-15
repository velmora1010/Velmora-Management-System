import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Wallet,
  ArrowDownLeft,
  ShoppingCart,
  History,
  BarChart3,
  RefreshCw,
  Plus,
  UploadCloud,
  FolderTree,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Zap,
  LayoutGrid
} from 'lucide-react';
import { useBills } from '../../hooks/finance/useBills';
import { useExpenses } from '../../hooks/finance/useExpenses';
import { useCredits } from '../../hooks/finance/useCredits';
import { usePOHistory } from '../../hooks/analytics/usePOHistory';

type ActivityTab = 'bills' | 'expenses' | 'credits' | 'pos';

export const FinanceOverview: React.FC = () => {
  const navigate = useNavigate();

  // 1. Existing Data Hooks
  const { bills, isLoading: isBillsLoading, refreshBills } = useBills();
  const { expenses, isLoading: isExpensesLoading, refreshExpenses } = useExpenses();
  const { credits, isLoading: isCreditsLoading, refreshCredits } = useCredits();
  const { data: poRecords, totalCount: poCount, isLoading: isPOLoading, fetchHistory: refreshPO } = usePOHistory(5);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeActivityTab, setActiveActivityTab] = useState<ActivityTab>('bills');

  // 2. Computed Summaries from real data
  const totalBillAmount = useMemo(() => {
    return bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [bills]);

  const pendingBillsCount = useMemo(() => {
    return bills.filter(b => {
      const s = (b.bill_status || '').toLowerCase();
      return s === 'pending' || s === 'unpaid';
    }).length;
  }, [bills]);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const totalCreditAmount = useMemo(() => {
    return credits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [credits]);

  const totalPOCount = poCount || 0;

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshBills(),
        refreshExpenses(),
        refreshCredits(),
        refreshPO()
      ]);
    } catch (err) {
      console.error('Failed to refresh finance overview:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Finance modules configuration for Quick Navigation cards
  const financeModules = [
    {
      title: 'Bills',
      description: 'Manage upcoming and recurring bills, due dates, billing cycles, and payment statuses.',
      path: '/finance/management/bills',
      icon: Receipt,
      countLabel: `${bills.length} Bills`,
      actionLabel: 'View Bills',
      color: 'purple'
    },
    {
      title: 'Expense',
      description: 'Record day-to-day business operational expenses, statement imports, and department costs.',
      path: '/finance/management/expense',
      icon: Wallet,
      countLabel: `${expenses.length} Expenses`,
      actionLabel: 'View Expenses',
      color: 'purple'
    },
    {
      title: 'Credit',
      description: 'Track incoming funds, statement credits, automated classification rules, and bank accounts.',
      path: '/finance/management/credit',
      icon: ArrowDownLeft,
      countLabel: `${credits.length} Credits`,
      actionLabel: 'View Credits',
      color: 'purple'
    },
    {
      title: 'Purchase Order',
      description: 'Create and authorize formal vendor purchase orders with itemized products and tax calculations.',
      path: '/finance/management/purchase-order',
      icon: ShoppingCart,
      countLabel: 'New PO',
      actionLabel: 'Create PO',
      color: 'purple'
    },
    {
      title: 'PO History',
      description: 'Audit past purchase orders, track vendor deliveries, inspect status logs, and export PDFs.',
      path: '/finance/management/po-history',
      icon: History,
      countLabel: `${totalPOCount} POs`,
      actionLabel: 'Browse History',
      color: 'purple'
    },
    {
      title: 'Analytics',
      description: 'In-depth KPI metrics, departmental expense breakdowns, trend charts, and financial analytics.',
      path: '/finance/management/analytics',
      icon: BarChart3,
      countLabel: 'KPIs & Trends',
      actionLabel: 'Open Analytics',
      color: 'purple'
    }
  ];

  return (
    <div className="flex flex-col w-full text-slate-200 animate-in fade-in duration-200 space-y-6">

      {/* 1. Header Banner */}
      <div className="bg-slate-800/80 p-4 sm:p-5 rounded-xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">Finance Overview</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live
            </span>
          </div>
          <span className="hidden sm:inline-block text-slate-600">•</span>
          <p className="text-slate-400 text-xs sm:text-sm">
            Unified financial control center for bills, expenses, credits, and purchase orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 sm:flex-initial px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            title="Refresh Finance Data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-purple-400' : 'text-slate-400'} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => navigate('/finance/management/analytics')}
            className="flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition-all"
          >
            <BarChart3 size={15} />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards Row (Inspired by Campaign Management) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1: Bills */}
        <div className="bg-slate-800/50 p-4 sm:p-5 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 text-xs sm:text-sm font-medium">Total Active Bills</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Receipt size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-100">
            {isBillsLoading ? (
              <span className="text-slate-500 text-lg">Loading...</span>
            ) : (
              formatCurrency(totalBillAmount)
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="text-purple-400 font-semibold">{bills.length}</span> active bills
            {pendingBillsCount > 0 && (
              <span className="text-amber-400/90 font-medium">({pendingBillsCount} pending)</span>
            )}
          </div>
        </div>

        {/* Card 2: Expenses */}
        <div className="bg-slate-800/50 p-4 sm:p-5 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 text-xs sm:text-sm font-medium">Recorded Expenses</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Wallet size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-100">
            {isExpensesLoading ? (
              <span className="text-slate-500 text-lg">Loading...</span>
            ) : (
              formatCurrency(totalExpenseAmount)
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="text-purple-400 font-semibold">{expenses.length}</span> total expense entries
          </div>
        </div>

        {/* Card 3: Credits */}
        <div className="bg-slate-800/50 p-4 sm:p-5 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 text-xs sm:text-sm font-medium">Recorded Credits</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-100">
            {isCreditsLoading ? (
              <span className="text-slate-500 text-lg">Loading...</span>
            ) : (
              formatCurrency(totalCreditAmount)
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="text-purple-400 font-semibold">{credits.length}</span> credit transactions
          </div>
        </div>

        {/* Card 4: Purchase Orders */}
        <div className="bg-slate-800/50 p-4 sm:p-5 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 text-xs sm:text-sm font-medium">Purchase Orders</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShoppingCart size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-100">
            {isPOLoading ? (
              <span className="text-slate-500 text-lg">Loading...</span>
            ) : (
              totalPOCount.toLocaleString('en-IN')
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="text-purple-400 font-semibold">{poRecords.length}</span> recent records available
          </div>
        </div>

      </div>

      {/* 3. Quick Actions Ribbon */}
      <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-300 font-medium text-xs sm:text-sm">
          <Zap size={16} className="text-purple-400 shrink-0" />
          <span>Quick Actions:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/finance/management/bills')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} />
            <span>Add Bill</span>
          </button>

          <button
            onClick={() => navigate('/finance/management/expense')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-purple-500/40 flex items-center gap-1.5 transition-colors"
          >
            <UploadCloud size={13} />
            <span>Upload Expense</span>
          </button>

          <button
            onClick={() => navigate('/finance/management/credit')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-purple-500/40 flex items-center gap-1.5 transition-colors"
          >
            <UploadCloud size={13} />
            <span>Upload Credit</span>
          </button>

          <button
            onClick={() => navigate('/finance/management/purchase-order')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-purple-500/40 flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} />
            <span>New PO</span>
          </button>

          <button
            onClick={() => navigate('/finance/categories')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-purple-500/40 flex items-center gap-1.5 transition-colors"
          >
            <FolderTree size={13} />
            <span>Categories</span>
          </button>
        </div>
      </div>

      {/* 4. Quick Navigation - Finance Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-purple-400" />
            <h2 className="text-base sm:text-lg font-semibold text-slate-100">Finance Modules</h2>
          </div>
          <span className="text-xs text-slate-400">Direct access to core workflows</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {financeModules.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.title}
                onClick={() => navigate(module.path)}
                className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/70 hover:border-purple-500/50 rounded-xl p-5 transition-all duration-200 cursor-pointer group flex flex-col justify-between hover:shadow-[0_0_20px_rgba(168,85,247,0.12)] hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition-transform">
                      <Icon size={20} />
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 border border-slate-600/50">
                      {module.countLabel}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 group-hover:text-purple-300 transition-colors mb-1.5">
                    {module.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                    {module.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs font-medium text-purple-400 group-hover:text-purple-300">
                  <span>{module.actionLabel}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Recent Finance Activity Section */}
      <div className="bg-slate-800/40 border border-slate-700/70 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-purple-400" />
            <h2 className="text-base sm:text-lg font-semibold text-slate-100">Recent Activity</h2>
          </div>

          {/* Activity Sub-Tabs */}
          <div className="flex flex-wrap gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-700/60">
            <button
              onClick={() => setActiveActivityTab('bills')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeActivityTab === 'bills'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Recent Bills ({bills.length})
            </button>
            <button
              onClick={() => setActiveActivityTab('expenses')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeActivityTab === 'expenses'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Recent Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveActivityTab('credits')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeActivityTab === 'credits'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Recent Credits ({credits.length})
            </button>
            <button
              onClick={() => setActiveActivityTab('pos')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeActivityTab === 'pos'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Recent POs ({poRecords.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="overflow-x-auto">
          {activeActivityTab === 'bills' && (
            <div>
              {bills.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Receipt size={32} className="mx-auto mb-2 text-slate-500 opacity-60" />
                  <p className="text-sm">No active bills found.</p>
                  <button
                    onClick={() => navigate('/finance/management/bills')}
                    className="mt-3 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                  >
                    Add your first bill
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase text-slate-400 px-3 py-2 border-b border-slate-700/60">
                    <span className="col-span-3">Due Date</span>
                    <span className="col-span-3">Category</span>
                    <span className="col-span-2">Payment Type</span>
                    <span className="col-span-2 text-right">Amount</span>
                    <span className="col-span-2 text-right">Status</span>
                  </div>
                  {bills.slice(0, 5).map((b) => (
                    <div
                      key={b.id || Math.random()}
                      onClick={() => navigate('/finance/management/bills')}
                      className="grid grid-cols-12 gap-2 text-xs text-slate-300 items-center px-3 py-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 transition-colors cursor-pointer"
                    >
                      <span className="col-span-3 text-slate-200 font-medium">{formatDate(b.due_date)}</span>
                      <span className="col-span-3 truncate text-slate-300">{b.main_category || '-'}</span>
                      <span className="col-span-2 text-slate-400">{b.payment_type || '-'}</span>
                      <span className="col-span-2 text-right font-semibold text-slate-100">
                        {formatCurrency(Number(b.amount) || 0)}
                      </span>
                      <span className="col-span-2 text-right">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                          (b.bill_status || '').toLowerCase() === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {b.bill_status || 'Active'}
                        </span>
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 text-right">
                    <button
                      onClick={() => navigate('/finance/management/bills')}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
                    >
                      <span>View all {bills.length} bills</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeActivityTab === 'expenses' && (
            <div>
              {expenses.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Wallet size={32} className="mx-auto mb-2 text-slate-500 opacity-60" />
                  <p className="text-sm">No expenses recorded yet.</p>
                  <button
                    onClick={() => navigate('/finance/management/expense')}
                    className="mt-3 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                  >
                    Record an expense
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase text-slate-400 px-3 py-2 border-b border-slate-700/60">
                    <span className="col-span-3">Date</span>
                    <span className="col-span-3">Category / Vendor</span>
                    <span className="col-span-2">Payment Mode</span>
                    <span className="col-span-2 text-right">Amount</span>
                    <span className="col-span-2 text-right">Status</span>
                  </div>
                  {expenses.slice(0, 5).map((e) => (
                    <div
                      key={e.id || Math.random()}
                      onClick={() => navigate('/finance/management/expense')}
                      className="grid grid-cols-12 gap-2 text-xs text-slate-300 items-center px-3 py-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 transition-colors cursor-pointer"
                    >
                      <span className="col-span-3 text-slate-200 font-medium">{formatDate(e.transaction_date || e.created_at)}</span>
                      <span className="col-span-3 truncate text-slate-300">{e.main_category || e.vendor || '-'}</span>
                      <span className="col-span-2 text-slate-400">{e.payment_mode || '-'}</span>
                      <span className="col-span-2 text-right font-semibold text-slate-100">
                        {formatCurrency(Number(e.amount) || 0)}
                      </span>
                      <span className="col-span-2 text-right">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-700 text-slate-300 border border-slate-600/50">
                          {e.status || 'Active'}
                        </span>
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 text-right">
                    <button
                      onClick={() => navigate('/finance/management/expense')}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
                    >
                      <span>View all {expenses.length} expenses</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeActivityTab === 'credits' && (
            <div>
              {credits.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <ArrowDownLeft size={32} className="mx-auto mb-2 text-slate-500 opacity-60" />
                  <p className="text-sm">No credit transactions recorded yet.</p>
                  <button
                    onClick={() => navigate('/finance/management/credit')}
                    className="mt-3 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                  >
                    Upload credit statement
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase text-slate-400 px-3 py-2 border-b border-slate-700/60">
                    <span className="col-span-3">Date</span>
                    <span className="col-span-3">Source / Category</span>
                    <span className="col-span-2">Account</span>
                    <span className="col-span-2 text-right">Amount</span>
                    <span className="col-span-2 text-right">Status</span>
                  </div>
                  {credits.slice(0, 5).map((c) => (
                    <div
                      key={c.id || Math.random()}
                      onClick={() => navigate('/finance/management/credit')}
                      className="grid grid-cols-12 gap-2 text-xs text-slate-300 items-center px-3 py-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 transition-colors cursor-pointer"
                    >
                      <span className="col-span-3 text-slate-200 font-medium">{formatDate(c.transaction_date || c.created_at)}</span>
                      <span className="col-span-3 truncate text-slate-300">{c.source || c.main_category || '-'}</span>
                      <span className="col-span-2 text-slate-400">{c.bank_account || '-'}</span>
                      <span className="col-span-2 text-right font-semibold text-emerald-400">
                        {formatCurrency(Number(c.amount) || 0)}
                      </span>
                      <span className="col-span-2 text-right">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {c.status || 'Active'}
                        </span>
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 text-right">
                    <button
                      onClick={() => navigate('/finance/management/credit')}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
                    >
                      <span>View all {credits.length} credits</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeActivityTab === 'pos' && (
            <div>
              {poRecords.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <ShoppingCart size={32} className="mx-auto mb-2 text-slate-500 opacity-60" />
                  <p className="text-sm">No purchase orders found.</p>
                  <button
                    onClick={() => navigate('/finance/management/purchase-order')}
                    className="mt-3 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                  >
                    Create a purchase order
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase text-slate-400 px-3 py-2 border-b border-slate-700/60">
                    <span className="col-span-3">PO Number</span>
                    <span className="col-span-3">Vendor</span>
                    <span className="col-span-2">Date</span>
                    <span className="col-span-2 text-right">Grand Total</span>
                    <span className="col-span-2 text-right">Action</span>
                  </div>
                  {poRecords.slice(0, 5).map((po) => (
                    <div
                      key={po.id}
                      onClick={() => navigate(`/finance/management/purchase-order?view=${po.id}`)}
                      className="grid grid-cols-12 gap-2 text-xs text-slate-300 items-center px-3 py-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 transition-colors cursor-pointer"
                    >
                      <span className="col-span-3 font-semibold text-purple-300">{po.po_number || 'PO-UNKNOWN'}</span>
                      <span className="col-span-3 truncate text-slate-200">{po.vendor_name || '-'}</span>
                      <span className="col-span-2 text-slate-400">{formatDate(po.date)}</span>
                      <span className="col-span-2 text-right font-semibold text-slate-100">
                        {formatCurrency(Number(po.grand_total) || 0)}
                      </span>
                      <span className="col-span-2 text-right text-purple-400 hover:underline">
                        View Details
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 text-right">
                    <button
                      onClick={() => navigate('/finance/management/po-history')}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
                    >
                      <span>View all {totalPOCount} purchase orders in history</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
