import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { FinanceBill } from '../../hooks/finance/useBills';

interface BillAnalyticsProps {
  bills: FinanceBill[];
}

const PALETTE_MAIN = [
  '#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#a855f7', '#f97316', '#06b6d4',
  '#84cc16', '#e11d48', '#8b5cf6', '#10b981'
];

const PALETTE_L2 = [
  '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16',
  '#e11d48', '#a855f7', '#3b82f6', '#f59e0b', '#22c55e',
  '#ec4899', '#6366f1', '#10b981', '#ef4444'
];

const PALETTE_L3 = [
  '#f43f5e', '#0ea5e9', '#d946ef', '#eab308', '#22d3ee',
  '#a3e635', '#fb923c', '#818cf8', '#2dd4bf', '#f472b6',
  '#38bdf8', '#facc15', '#c084fc', '#34d399'
];

const PALETTE_L4 = [
  '#e879f9', '#67e8f9', '#fbbf24', '#a78bfa', '#34d399',
  '#fb7185', '#38bdf8', '#bef264', '#f9a8d4', '#5eead4',
  '#fca5a5', '#93c5fd', '#d9f99d', '#c4b5fd'
];

const formatINR = (val: number) => '₹' + Number(val).toLocaleString('en-IN');

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; count: number } }>;
  total: number;
}

const CustomTooltip = ({ active, payload, total }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0.0';
    return (
      <div className="bg-black/90 text-white p-3 rounded-lg shadow-xl text-sm border border-white/10 z-50 relative">
        <div className="font-semibold mb-1">{data.name}</div>
        <div>{formatINR(data.value)} ({pct}%)</div>
        <div className="text-white/60 text-xs mt-1">{data.count} Bill{data.count !== 1 ? 's' : ''}</div>
      </div>
    );
  }
  return null;
};

export const BillAnalytics = ({ bills }: BillAnalyticsProps) => {
  // Cascading Selection State
  const [selectedMain, setSelectedMain] = useState<string | null>(null);
  const [selectedSub1, setSelectedSub1] = useState<string | null>(null);
  const [selectedSub2, setSelectedSub2] = useState<string | null>(null);

  // LEVEL 1: Main Category
  const mainData = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    bills.forEach(b => {
      const cat = b.main_category || 'Uncategorized';
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(b.amount || 0);
      map[cat].count += 1;
    });
    return Object.keys(map).map(name => ({
      name, value: map[name].amount, count: map[name].count
    })).sort((a, b) => b.value - a.value);
  }, [bills]);

  const activeMain = selectedMain || (mainData.length > 0 ? mainData[0].name : null);
  const mainTotal = mainData.reduce((sum, item) => sum + item.value, 0);

  // LEVEL 2: Sub Category 1
  const sub1Data = useMemo(() => {
    if (!activeMain) return [];
    const filtered = bills.filter(b => (b.main_category || 'Uncategorized') === activeMain);
    const map: Record<string, { amount: number; count: number }> = {};
    filtered.forEach(b => {
      const cat = b.sub_category1 || 'Other';
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(b.amount || 0);
      map[cat].count += 1;
    });
    return Object.keys(map).map(name => ({
      name, value: map[name].amount, count: map[name].count
    })).sort((a, b) => b.value - a.value);
  }, [bills, activeMain]);

  const activeSub1 = selectedSub1 || (sub1Data.length > 0 ? sub1Data[0].name : null);
  const sub1Total = sub1Data.reduce((sum, item) => sum + item.value, 0);

  // LEVEL 3: Sub Category 2
  const sub2Data = useMemo(() => {
    if (!activeMain || !activeSub1) return [];
    const filtered = bills.filter(b => 
      (b.main_category || 'Uncategorized') === activeMain &&
      (b.sub_category1 || 'Other') === activeSub1
    );
    const map: Record<string, { amount: number; count: number }> = {};
    filtered.forEach(b => {
      const cat = b.sub_category2?.trim() || 'Other';
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(b.amount || 0);
      map[cat].count += 1;
    });
    return Object.keys(map).map(name => ({
      name, value: map[name].amount, count: map[name].count
    })).sort((a, b) => b.value - a.value);
  }, [bills, activeMain, activeSub1]);

  const activeSub2 = selectedSub2 || (sub2Data.length > 0 ? sub2Data[0].name : null);
  const sub2Total = sub2Data.reduce((sum, item) => sum + item.value, 0);

  // LEVEL 4: Sub Category 3
  const sub3Data = useMemo(() => {
    if (!activeMain || !activeSub1 || !activeSub2) return [];
    const filtered = bills.filter(b => 
      (b.main_category || 'Uncategorized') === activeMain &&
      (b.sub_category1 || 'Other') === activeSub1 &&
      (b.sub_category2?.trim() || 'Other') === activeSub2
    );
    const map: Record<string, { amount: number; count: number }> = {};
    filtered.forEach(b => {
      const cat = b.sub_category3?.trim();
      if (!cat) return; // Legacy explicitly ignores empty sub_category3
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(b.amount || 0);
      map[cat].count += 1;
    });
    return Object.keys(map).map(name => ({
      name, value: map[name].amount, count: map[name].count
    })).sort((a, b) => b.value - a.value);
  }, [bills, activeMain, activeSub1, activeSub2]);

  const sub3Total = sub3Data.reduce((sum, item) => sum + item.value, 0);

  // Handlers
  const handleMainClick = (name: string) => {
    setSelectedMain(name);
    setSelectedSub1(null);
    setSelectedSub2(null);
  };

  const handleSub1Click = (name: string) => {
    setSelectedSub1(name);
    setSelectedSub2(null);
  };

  const handleSub2Click = (name: string) => {
    setSelectedSub2(name);
  };

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted">
        <div className="text-4xl mb-4">📊</div>
        <p>No bill data available for analytics.</p>
      </div>
    );
  }

  // Reusable Chart Component Helper
  const renderChartCard = (
    title: string, 
    data: any[], 
    total: number, 
    palette: string[], 
    activeItem: string | null,
    onClick: (name: string) => void,
    emptyMessage: string
  ) => (
    <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-100 mb-6">{title}</h3>
      
      {data.length === 0 || (data.length === 1 && data[0].name === 'Other' && total === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm text-center">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 flex-1">
          {/* Top Half: Donut Chart */}
          <div className="relative w-full h-48 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={0}
                  dataKey="value"
                  onClick={(e) => { if(e && e.name) onClick(e.name); }}
                  cursor="pointer"
                  stroke="none" // To perfectly match legacy UI (no white borders)
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
              <span className="text-xl font-bold text-white tracking-tight">{formatINR(total)}</span>
              <span className="text-[9px] text-slate-400 font-semibold tracking-widest uppercase mt-0.5">TOTAL</span>
            </div>
          </div>

          {/* Bottom Half: Legend List */}
          <div className="w-full flex flex-col gap-2 overflow-y-auto max-h-48 custom-scrollbar">
            {data.map((item, index) => (
              <button
                key={item.name}
                onClick={() => onClick(item.name)}
                className={`flex items-center justify-between p-2.5 rounded-lg transition-colors text-left w-full group ${
                  activeItem === item.name 
                    ? 'bg-slate-700 border-l-2 border-l-purple-500' 
                    : 'bg-[#252d41] hover:bg-slate-700/80 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: palette[index % palette.length] }} 
                  />
                  <span className={`text-xs font-medium truncate ${activeItem === item.name ? 'text-white' : 'text-slate-300'}`}>
                    {item.name}
                  </span>
                </div>
                <div className="text-right shrink-0 ml-3 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100">{formatINR(item.value)}</span>
                  <div className="h-3 w-px bg-slate-600 mx-1"></div>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{item.count} Bill{item.count !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pb-12">
      {/* 1. Main Category */}
      {renderChartCard(
        'Main Category Total Bills',
        mainData,
        mainTotal,
        PALETTE_MAIN,
        activeMain,
        handleMainClick,
        'No bill data available'
      )}

      {/* 2. Sub Category 1 (Operations) */}
      {renderChartCard(
        activeMain ? `${activeMain} Breakdown` : 'Operations Breakdown',
        sub1Data,
        sub1Total,
        PALETTE_L2,
        activeSub1,
        handleSub1Click,
        activeMain ? `No breakdown data available for ${activeMain}.` : 'Select a main category'
      )}

      {/* 3. Sub Category 2 (Infrastructure) */}
      {renderChartCard(
        activeSub1 ? `${activeSub1} Breakdown` : 'Infrastructure Breakdown',
        sub2Data,
        sub2Total,
        PALETTE_L3,
        activeSub2,
        handleSub2Click,
        activeSub1 ? `No deeper breakdown available for ${activeSub1}.` : 'Select a sub-category'
      )}

      {/* 4. Sub Category 3 (Rent Details) */}
      {renderChartCard(
        activeSub2 ? `${activeSub2} Details` : 'Rent Details',
        sub3Data,
        sub3Total,
        PALETTE_L4,
        null, // Level 4 doesn't have an active selection since there is no deeper level
        () => {}, // No click action for Level 4
        activeSub2 ? `No deeper breakdown available for ${activeSub2}.` : 'Select a sub-category'
      )}
    </div>
  );
};
