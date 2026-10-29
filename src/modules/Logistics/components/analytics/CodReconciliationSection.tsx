import React, { useMemo } from 'react';
import { 
  IndianRupee, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  AlertTriangle, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  Building,
  FileCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  PieChart, 
  Pie, 
  Legend,
  CartesianGrid
} from 'recharts';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { 
  getCanonicalStatus, 
  formatINR, 
  isCodOrder 
} from '../../utils/logisticsAnalyticsUtils';
import { isDispatchedOrder, parseOrderAmount } from '../../../../utils/logisticsOrderUtils';

interface CodReconciliationSectionProps {
  orders: UnifiedLogisticsOrder[];
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
}

export const CodReconciliationSection: React.FC<CodReconciliationSectionProps> = ({
  orders,
  onDrillDown
}) => {
  // Aggregate all COD financial and reconciliation metrics
  const codStats = useMemo(() => {
    let totalCodOrders = 0;
    let totalCodVal = 0;
    let codExpected = 0;
    let codCollected = 0;
    let codPendingCollection = 0;
    let codPendingRemittance = 0;
    let codRemitted = 0;
    let partialCodCollected = 0;
    let remainingCodReceivable = 0;
    let codRtoCount = 0;
    let codRtoVal = 0;
    let codDeliveredCount = 0;

    let prepaidTotalCount = 0;
    let prepaidDeliveredCount = 0;
    let prepaidRtoCount = 0;

    orders.forEach(o => {
      const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;
      const type = (o.orderType || '').toUpperCase();
      const isCod = type.includes('COD');
      const isPartial = type.includes('PARTIAL');
      const canonical = getCanonicalStatus(o);
      const isDisp = isDispatchedOrder(o);

      if (isCod) {
        totalCodOrders++;
        totalCodVal += amt;

        if (isPartial) {
          // If partial COD, assume ~₹200-500 advance or 20% advance if not separately specified
          const estAdvance = Math.round(amt * 0.2);
          partialCodCollected += estAdvance;
          remainingCodReceivable += (amt - estAdvance);
        } else {
          remainingCodReceivable += amt;
        }

        if (isDisp && canonical !== 'Cancelled' && !canonical.includes('RTO')) {
          codExpected += amt;
        }

        if (canonical === 'Delivered') {
          codDeliveredCount++;
          codCollected += amt;
          // Check financial status for courier remittance
          if (o.financialStatus === 'paid' || (o.remarks || '').toLowerCase().includes('remit')) {
            codRemitted += amt;
          } else {
            codPendingRemittance += amt;
          }
        } else if (canonical === 'In Transit' || canonical === 'Out for Delivery' || canonical === 'Delivery Attempt Failed' || canonical === 'Pending Tracking Update') {
          codPendingCollection += amt;
        } else if (canonical.includes('RTO')) {
          codRtoCount++;
          codRtoVal += amt;
        }
      } else {
        prepaidTotalCount++;
        if (canonical === 'Delivered') {
          prepaidDeliveredCount++;
        } else if (canonical.includes('RTO')) {
          prepaidRtoCount++;
        }
      }
    });

    const reconciliationMismatch = Math.max(0, codExpected - codCollected - codPendingCollection);

    // Delivery success comparison: Prepaid vs COD
    const prepaidConcluded = prepaidDeliveredCount + prepaidRtoCount;
    const prepaidSuccessRate = prepaidConcluded > 0
      ? Math.round((prepaidDeliveredCount / prepaidConcluded) * 100)
      : 0;

    const codConcluded = codDeliveredCount + codRtoCount;
    const codSuccessRate = codConcluded > 0
      ? Math.round((codDeliveredCount / codConcluded) * 100)
      : 0;

    return {
      totalCodOrders,
      totalCodVal,
      codExpected,
      codCollected,
      codPendingCollection,
      codPendingRemittance,
      codRemitted,
      partialCodCollected,
      remainingCodReceivable,
      reconciliationMismatch,
      codRtoCount,
      codRtoVal,
      codDeliveredCount,
      prepaidSuccessRate,
      codSuccessRate,
      prepaidTotalCount
    };
  }, [orders]);

  const comparisonBarData = [
    {
      channel: 'Prepaid Delivery Success',
      successRate: codStats.prepaidSuccessRate,
      fill: '#8b5cf6'
    },
    {
      channel: 'COD Delivery Success',
      successRate: codStats.codSuccessRate,
      fill: '#06b6d4'
    }
  ];

  const breakdownDonutData = [
    { name: 'COD Collected (Delivered)', value: codStats.codCollected, color: '#10b981' },
    { name: 'COD Pending Collection (In Transit)', value: codStats.codPendingCollection, color: '#f59e0b' },
    { name: 'COD Lost to RTO', value: codStats.codRtoVal, color: '#f43f5e' }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-4">
      {/* SECTION HEADER */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <IndianRupee size={18} className="text-cyan-400" />
              <span>COD & Financial Reconciliation Analytics</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live cash collections, pending doorstep receivables, courier remittance, and delivery performance comparison
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span className="text-slate-300">
              COD Orders Count: <strong className="text-white font-mono">{codStats.totalCodOrders.toLocaleString('en-IN')}</strong>
            </span>
          </div>
        </div>

        {/* 6 KEY COD FINANCIAL CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* Card 1: Total COD Value */}
          <div 
            onClick={() => onDrillDown('Total COD Orders', 'All Cash on Delivery orders', o => isCodOrder(o))}
            className="bg-[#0e1626] border border-slate-800 hover:border-cyan-600/50 rounded-xl p-3.5 cursor-pointer transition-all group"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total COD Value</div>
            <div className="text-xl font-black font-mono text-cyan-400">{formatINR(codStats.totalCodVal)}</div>
            <p className="text-[10px] text-slate-500 mt-1">All COD orders</p>
          </div>

          {/* Card 2: Expected COD */}
          <div 
            onClick={() => onDrillDown('Expected COD Collection', 'Active dispatched COD shipments', o => isCodOrder(o) && isDispatchedOrder(o) && !getCanonicalStatus(o).includes('RTO'))}
            className="bg-[#0e1626] border border-slate-800 hover:border-cyan-600/50 rounded-xl p-3.5 cursor-pointer transition-all group"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Expected Collection</div>
            <div className="text-xl font-black font-mono text-white">{formatINR(codStats.codExpected)}</div>
            <p className="text-[10px] text-slate-500 mt-1">Dispatched non-RTO</p>
          </div>

          {/* Card 3: COD Collected (Doorstep Confirmed) */}
          <div 
            onClick={() => onDrillDown('COD Collected (Delivered)', 'COD orders confirmed delivered', o => isCodOrder(o) && getCanonicalStatus(o) === 'Delivered')}
            className="bg-[#0e1626] border border-slate-800 hover:border-emerald-600/50 rounded-xl p-3.5 cursor-pointer transition-all group"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>COD Collected</span>
              <CheckCircle2 size={13} className="text-emerald-400" />
            </div>
            <div className="text-xl font-black font-mono text-emerald-400">{formatINR(codStats.codCollected)}</div>
            <p className="text-[10px] text-slate-500 mt-1">Doorstep received</p>
          </div>

          {/* Card 4: Pending Collection (In-Transit) */}
          <div 
            onClick={() => onDrillDown('COD Pending Collection', 'In-transit COD orders awaiting delivery', o => isCodOrder(o) && isDispatchedOrder(o) && getCanonicalStatus(o) !== 'Delivered' && !getCanonicalStatus(o).includes('RTO'))}
            className="bg-[#0e1626] border border-slate-800 hover:border-amber-600/50 rounded-xl p-3.5 cursor-pointer transition-all group"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Pending Collection</span>
              <Clock size={13} className="text-amber-400" />
            </div>
            <div className="text-xl font-black font-mono text-amber-400">{formatINR(codStats.codPendingCollection)}</div>
            <p className="text-[10px] text-slate-500 mt-1">In-transit shipments</p>
          </div>

          {/* Card 5: Pending Remittance */}
          <div 
            onClick={() => onDrillDown('COD Pending Courier Remittance', 'Delivered COD orders pending bank payout', o => isCodOrder(o) && getCanonicalStatus(o) === 'Delivered' && o.financialStatus !== 'paid')}
            className="bg-[#0e1626] border border-slate-800 hover:border-purple-600/50 rounded-xl p-3.5 cursor-pointer transition-all group"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Pending Remittance</span>
              <Building size={13} className="text-purple-400" />
            </div>
            <div className="text-xl font-black font-mono text-purple-400">{formatINR(codStats.codPendingRemittance)}</div>
            <p className="text-[10px] text-slate-500 mt-1">Awaiting carrier deposit</p>
          </div>

          {/* Card 6: COD Lost to RTO */}
          <div 
            onClick={() => onDrillDown('COD RTO Losses', 'COD orders returned to seller', o => isCodOrder(o) && getCanonicalStatus(o).includes('RTO'))}
            className="bg-[#0e1626] border border-slate-800 hover:border-rose-600/50 rounded-xl p-3.5 cursor-pointer transition-all group"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>COD RTO Loss</span>
              <RotateCcw size={13} className="text-rose-400" />
            </div>
            <div className="text-xl font-black font-mono text-rose-400">{formatINR(codStats.codRtoVal)}</div>
            <p className="text-[10px] text-slate-500 mt-1">{codStats.codRtoCount} orders returned</p>
          </div>

        </div>
      </div>

      {/* CHARTS: PREPAID VS COD SUCCESS COMPARISON & COD REVENUE SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* CHART 1: Prepaid vs COD Delivery Success Rate Comparison */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard size={15} className="text-purple-400" />
                Delivery Success Comparison: Prepaid vs COD
              </h4>
              <p className="text-xs text-slate-400">Doorstep realization rate comparing payment types</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonBarData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="channel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any) => [`${val}% success rate`, 'Rate']}
                />
                <Bar dataKey="successRate" radius={[8, 8, 0, 0]} maxBarSize={60}>
                  {comparisonBarData.map((e, idx) => (
                    <Cell key={`bar-${idx}`} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="bg-[#0e1626] p-2.5 rounded-xl">
              <span className="text-slate-400 block text-[11px]">Prepaid Success Rate</span>
              <span className="text-base font-bold font-mono text-purple-400">{codStats.prepaidSuccessRate}%</span>
            </div>
            <div className="bg-[#0e1626] p-2.5 rounded-xl">
              <span className="text-slate-400 block text-[11px]">COD Success Rate</span>
              <span className="text-base font-bold font-mono text-cyan-400">{codStats.codSuccessRate}%</span>
            </div>
          </div>
        </div>

        {/* CHART 2: COD Financial Status Breakdown (Donut) */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChartIcon size={15} className="text-cyan-400" />
                COD Pipeline Financial Breakdown
              </h4>
              <p className="text-xs text-slate-400">Proportion of collected, in-transit, and returned COD value</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {breakdownDonutData.length === 0 ? (
              <div className="text-xs text-slate-500">No COD orders in current dataset</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownDonutData}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {breakdownDonutData.map((e, idx) => (
                      <Cell key={`donut-${idx}`} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: any) => [formatINR(Number(val)), 'Value']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="text-[11px] text-slate-400 bg-[#0e1626] p-3 rounded-xl border border-slate-800/80">
            <strong>Reconciliation Status:</strong> {codStats.reconciliationMismatch === 0 ? (
              <span className="text-emerald-400 font-semibold"> Fully balanced. All dispatched COD amounts accounted for across collected, in-transit, and RTO stages.</span>
            ) : (
              <span className="text-amber-400 font-semibold"> ₹{codStats.reconciliationMismatch.toLocaleString('en-IN')} pending courier reconciliation report verification.</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
