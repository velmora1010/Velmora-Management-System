import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { departmentService } from '../../services/departmentService';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import type { Department, DepartmentSection } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return a non-negative finite number; fallback to 0 for NaN / negative / undefined */
const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

// ── Public Types ──────────────────────────────────────────────────────────────

export interface ExecKPIs {
  totalDepartments: number;
  totalSections: number;
  activeCampaigns: number;
  totalTasks: number;
  pendingTasks: number;
  totalExpenses: number;
  totalPurchaseOrders: number;
  totalVendors: number;
  totalProducts: number;
  inventoryValue: number;
  productionBatches: number;
  qcPending: number;
  qcPassed: number;
  todaysDispatches: number;
}

export interface ExecChartData {
  campaignStatus: { name: string; value: number }[];
  monthlyExpense: { month: string; amount: number }[];
  poByMonth: { month: string; count: number }[];
  stockLevels: { name: string; quantity: number }[];
  dailyProduction: { date: string; batches: number }[];
  qcPassFail: { name: string; value: number }[];
  taskStatus: { name: string; value: number }[];
}

export interface RecentActivityItem {
  id: string;
  type: 'task' | 'po' | 'campaign' | 'production' | 'qc' | 'expense';
  title: string;
  subtitle: string;
  status: string;
  date: string;
}

export interface ExecutiveDashboardData {
  kpis: ExecKPIs;
  charts: ExecChartData;
  recentActivity: RecentActivityItem[];
  departments: Department[];
  sections: DepartmentSection[];
}

// ── Default State ─────────────────────────────────────────────────────────────

export const EXEC_DEFAULT_DATA: ExecutiveDashboardData = {
  kpis: {
    totalDepartments: 0, totalSections: 0, activeCampaigns: 0,
    totalTasks: 0, pendingTasks: 0, totalExpenses: 0,
    totalPurchaseOrders: 0, totalVendors: 0, totalProducts: 0,
    inventoryValue: 0, productionBatches: 0, qcPending: 0,
    qcPassed: 0, todaysDispatches: 0,
  },
  charts: {
    campaignStatus: [], monthlyExpense: [], poByMonth: [],
    stockLevels: [], dailyProduction: [], qcPassFail: [], taskStatus: [],
  },
  recentActivity: [],
  departments: [],
  sections: [],
};

// ── Module-level Cache ────────────────────────────────────────────────────────

const _cache = new Map<string, { data: ExecutiveDashboardData; ts: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useExecutiveDashboard
 *
 * THE single source of truth for all Executive Dashboard data.
 * - All 10 Supabase queries run in one Promise.all()
 * - LocalStorage reads happen synchronously after the parallel fetch
 * - Results cached 3 min by `${departmentId}|${sectionId}` key
 * - Abort-safe: in-flight fetch is cancelled on unmount / filter change
 */
export const useExecutiveDashboard = (departmentId: string, sectionId: string) => {
  const [data, setData] = useState<ExecutiveDashboardData>(EXEC_DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  /** Bust the cache entry for the current filter combo and re-fetch */
  const refresh = useCallback(() => {
    _cache.delete(`${departmentId}|${sectionId}`);
    setRefreshKey(k => k + 1);
  }, [departmentId, sectionId]);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const cacheKey = `${departmentId}|${sectionId}`;
    const cached = _cache.get(cacheKey);

    // Serve stale-while-revalidate from cache
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData(cached.data);
      setIsLoading(false);
      return () => ctrl.abort();
    }

    setIsLoading(true);
    setError('');

    (async () => {
      try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const currentYear = today.getFullYear();
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(today.getDate() - 13);
        fourteenDaysAgo.setHours(0, 0, 0, 0);

        // ── Build Supabase Queries ─────────────────────────────────────────

        // Campaigns (no dept column — campaign-scoped)
        const campaignQ = supabase
          .from('influencer_create_campaigns_rows')
          .select('id, campaign_name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(500);

        // Tasks — department field (not department_id)
        let tasksQ = supabase
          .from(SUPABASE_TABLES.tasks)
          .select('id, title, status, department, created_at')
          .neq('status', 'archived')
          .order('created_at', { ascending: false })
          .limit(500);
        if (departmentId) tasksQ = tasksQ.eq('department', departmentId);

        // Expenses — dept in main_category, sec in sub_category1
        let expQ = supabase
          .from(SUPABASE_TABLES.expenses)
          .select('id, amount, main_category, sub_category1, created_at, payment_type')
          .order('created_at', { ascending: false })
          .limit(500);
        if (departmentId) expQ = expQ.eq('main_category', departmentId);
        if (sectionId) expQ = expQ.eq('sub_category1', sectionId);

        // Purchase Orders
        let poQ = supabase
          .from(SUPABASE_TABLES.purchaseOrders)
          .select('id, vendor_name, subtotal, gst_total, status, department_id, section_id, created_at')
          .order('created_at', { ascending: false })
          .limit(500);
        if (departmentId) poQ = poQ.eq('department_id', departmentId);
        if (sectionId) poQ = poQ.eq('section_id', sectionId);

        // Vendors — count only for performance
        let vendorQ = supabase
          .from(SUPABASE_TABLES.vendors)
          .select('id', { count: 'exact', head: true });
        if (departmentId) vendorQ = vendorQ.eq('department_id', departmentId);
        if (sectionId) vendorQ = vendorQ.eq('section_id', sectionId);

        // Product barcodes — count only
        let productQ = supabase
          .from(SUPABASE_TABLES.productBarcodes)
          .select('id', { count: 'exact', head: true });
        if (departmentId) productQ = productQ.eq('department_id', departmentId);

        // Finished goods inventory — for value KPI + stock chart
        let invQ = supabase
          .from('finished_goods_inventory')
          .select('id, quantity, unit_price, product_name, department_id')
          .limit(200);
        if (departmentId) invQ = invQ.eq('department_id', departmentId);

        // Today's dispatches (marketing module — no dept column)
        const dispatchQ = supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id, influencer_name, dispatched_date, dispatch_status, created_at')
          .order('created_at', { ascending: false })
          .limit(200);

        // Departments & Sections (shared lookup)
        const deptServiceQ = departmentService.getAllDepartments();
        const secQ = supabase.from('department_sections').select('*');

        // ── Single Parallel Fetch (10 queries) ───────────────────────────

        const [
          deptRes, secRes, campaignRes, tasksRes,
          expRes, poRes, vendorRes, productRes,
          invRes, dispatchRes,
        ] = await Promise.all([
          deptServiceQ, secQ, campaignQ, tasksQ,
          expQ, poQ, vendorQ, productQ,
          invQ, dispatchQ,
        ]);

        if (ctrl.signal.aborted) return;

        // ── Safe Data Extraction ──────────────────────────────────────────

        const departments: Department[] = deptRes.data ?? [];
        const sections: DepartmentSection[] = (secRes.data ?? []) as DepartmentSection[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const campaigns: any[] = campaignRes.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tasks: any[] = tasksRes.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expenses: any[] = expRes.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pos: any[] = poRes.data ?? [];
        const vendorCount = vendorRes.count ?? 0;
        const productCount = productRes.count ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inventory: any[] = invRes.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dispatches: any[] = dispatchRes.data ?? [];

        // ── LocalStorage Reads (synchronous — no extra async) ─────────────

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let productionBatches: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let qcBarcodes: any[] = [];
        try {
          const rawProd = localStorage.getItem('inventory_production');
          if (rawProd) productionBatches = JSON.parse(rawProd);
          const rawQC = localStorage.getItem('quality_check_barcodes');
          if (rawQC) qcBarcodes = JSON.parse(rawQC);
        } catch {
          /* ignore corrupt localStorage */
        }

        // Apply dept/section filter to localStorage data
        if (departmentId) {
          productionBatches = productionBatches.filter(b => String(b.department_id) === departmentId);
          qcBarcodes = qcBarcodes.filter(b => String(b.department_id) === departmentId);
        }
        if (sectionId) {
          productionBatches = productionBatches.filter(b => String(b.section_id) === sectionId);
          qcBarcodes = qcBarcodes.filter(b => String(b.section_id) === sectionId);
        }

        // ── KPI Aggregation ───────────────────────────────────────────────

        const activeCampaigns = campaigns.filter(c =>
          !['completed', 'archived', 'done'].includes(String(c.status ?? '').toLowerCase())
        ).length;

        const pendingTasks = tasks.filter(t =>
          !['completed', 'done', 'archived'].includes(String(t.status ?? '').toLowerCase())
        ).length;

        const totalExpenses = expenses.reduce((s, e) => s + safeNum(e.amount), 0);

        const inventoryValue = inventory.reduce(
          (s, i) => s + safeNum(i.quantity) * safeNum(i.unit_price ?? i.price ?? 0),
          0
        );

        const qcPassed = qcBarcodes.filter(b => {
          const st = String(b.currentStage ?? '').toUpperCase();
          return st.includes('PASS') || st.includes('COMPLETE') || st.includes('OUT');
        }).length;

        const qcPending = qcBarcodes.filter(b => {
          const st = String(b.currentStage ?? '').toUpperCase();
          return st === '' || st.includes('READY') || st.includes('PENDING') || st.includes('_IN');
        }).length;

        const todaysDispatches = dispatches.filter(d => {
          const ds = String(d.dispatched_date ?? d.created_at ?? '').split('T')[0];
          return ds === todayStr;
        }).length;

        // ── Chart: Campaign Status (Pie) ──────────────────────────────────

        const csMap = new Map<string, number>();
        campaigns.forEach(c => {
          const s = String(c.status ?? 'draft');
          csMap.set(s, (csMap.get(s) ?? 0) + 1);
        });
        const campaignStatus = Array.from(csMap.entries()).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        }));

        // ── Chart: Monthly Expense (Area) ─────────────────────────────────

        const expByMonth: number[] = new Array(12).fill(0);
        expenses.forEach(e => {
          const d = new Date(e.created_at ?? '');
          if (Number.isFinite(d.getTime()) && d.getFullYear() === currentYear) {
            expByMonth[d.getMonth()] += safeNum(e.amount);
          }
        });
        const monthlyExpense = expByMonth.map((amount, i) => ({ month: MONTH_LABELS[i], amount }));

        // ── Chart: POs by Month (Bar) ─────────────────────────────────────

        const poByMonthArr: number[] = new Array(12).fill(0);
        pos.forEach(po => {
          const d = new Date(po.created_at ?? '');
          if (Number.isFinite(d.getTime()) && d.getFullYear() === currentYear) {
            poByMonthArr[d.getMonth()]++;
          }
        });
        const poByMonth = poByMonthArr.map((count, i) => ({ month: MONTH_LABELS[i], count }));

        // ── Chart: Stock Levels (Horizontal Bar, top 8) ───────────────────

        const stockMap = new Map<string, number>();
        inventory.forEach(i => {
          const name = String(i.product_name ?? i.productName ?? i.name ?? 'Item');
          stockMap.set(name, (stockMap.get(name) ?? 0) + safeNum(i.quantity));
        });
        const stockLevels = Array.from(stockMap.entries())
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 8);

        // ── Chart: Daily Production (Line, last 14 days) ──────────────────

        const prodDayMap = new Map<string, number>();
        productionBatches.forEach(b => {
          const d = new Date(b.created_at ?? b.startedAt ?? '');
          if (Number.isFinite(d.getTime()) && d >= fourteenDaysAgo) {
            const k = d.toISOString().split('T')[0];
            prodDayMap.set(k, (prodDayMap.get(k) ?? 0) + 1);
          }
        });
        const dailyProduction: { date: string; batches: number }[] = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const k = d.toISOString().split('T')[0];
          dailyProduction.push({
            date: `${d.getDate()}/${d.getMonth() + 1}`,
            batches: prodDayMap.get(k) ?? 0,
          });
        }

        // ── Chart: QC Pass/Fail (Pie) ─────────────────────────────────────

        const qcOther = Math.max(0, qcBarcodes.length - qcPassed - qcPending);
        const qcPassFail = [
          { name: 'Passed', value: qcPassed },
          { name: 'Pending', value: qcPending },
          ...(qcOther > 0 ? [{ name: 'Other', value: qcOther }] : []),
        ].filter(d => d.value > 0);

        // ── Chart: Task Status (Donut) ────────────────────────────────────

        const tsMap = new Map<string, number>();
        tasks.forEach(t => {
          const s = String(t.status ?? 'pending');
          tsMap.set(s, (tsMap.get(s) ?? 0) + 1);
        });
        const taskStatus = Array.from(tsMap.entries()).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        }));

        // ── Recent Activity (last 15 cross-module events) ─────────────────

        const isValidDate = (s: string) =>
          Boolean(s) && s !== 'undefined' && s !== 'null' && !isNaN(Date.parse(s));

        const recentActivity: RecentActivityItem[] = [
          ...tasks.slice(0, 4).map(t => ({
            id: String(t.id ?? ''),
            type: 'task' as const,
            title: String(t.title ?? t.task_name ?? t.task_title ?? 'Task'),
            subtitle: String(t.status ?? ''),
            status: String(t.status ?? 'pending'),
            date: String(t.created_at ?? ''),
          })),
          ...pos.slice(0, 3).map(po => ({
            id: String(po.id ?? ''),
            type: 'po' as const,
            title: `PO — ${String(po.vendor_name ?? 'Vendor')}`,
            subtitle: `₹${(safeNum(po.subtotal) + safeNum(po.gst_total)).toLocaleString('en-IN')}`,
            status: String(po.status ?? 'pending'),
            date: String(po.created_at ?? ''),
          })),
          ...campaigns.slice(0, 3).map(c => ({
            id: String(c.id ?? ''),
            type: 'campaign' as const,
            title: String(c.campaign_name ?? 'Campaign'),
            subtitle: String(c.status ?? ''),
            status: String(c.status ?? 'draft'),
            date: String(c.created_at ?? ''),
          })),
          ...productionBatches.slice(0, 2).map(b => ({
            id: String(b.id ?? ''),
            type: 'production' as const,
            title: String(b.productName ?? b.product_name ?? 'Batch'),
            subtitle: `${safeNum(b.totalUnits ?? b.targetUnits)} units`,
            status: String(b.status ?? 'in-progress'),
            date: String(b.created_at ?? b.startedAt ?? ''),
          })),
          ...expenses.slice(0, 3).map(e => ({
            id: String(e.id ?? ''),
            type: 'expense' as const,
            title: `Expense — ₹${safeNum(e.amount).toLocaleString('en-IN')}`,
            subtitle: String(e.payment_type ?? ''),
            status: 'paid',
            date: String(e.created_at ?? ''),
          })),
        ]
          .filter(a => isValidDate(a.date))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 15);

        // ── Compose & Cache ───────────────────────────────────────────────

        const result: ExecutiveDashboardData = {
          kpis: {
            totalDepartments: departments.length,
            totalSections: sections.length,
            activeCampaigns,
            totalTasks: tasks.length,
            pendingTasks,
            totalExpenses,
            totalPurchaseOrders: pos.length,
            totalVendors: safeNum(vendorCount),
            totalProducts: safeNum(productCount),
            inventoryValue,
            productionBatches: productionBatches.length,
            qcPending,
            qcPassed,
            todaysDispatches,
          },
          charts: {
            campaignStatus, monthlyExpense, poByMonth,
            stockLevels, dailyProduction, qcPassFail, taskStatus,
          },
          recentActivity,
          departments,
          sections,
        };

        _cache.set(cacheKey, { data: result, ts: Date.now() });

        if (!ctrl.signal.aborted) {
          setData(result);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ctrl.signal.aborted) {
          const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
          console.error('[useExecutiveDashboard]', msg);
          setError(msg);
          setIsLoading(false);
        }
      }
    })();

    return () => ctrl.abort();
  }, [departmentId, sectionId, refreshKey]);

  return { data, isLoading, error, refresh };
};
