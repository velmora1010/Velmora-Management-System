import React, { useState, useEffect } from 'react';
import db from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { analyticsService } from '../../services/analyticsService';
import { type StateMetrics } from '../../utils/analyticsCalculations';
import { Search, RefreshCw, Download, FileBarChart, Clock, Truck, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const PALETTE = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a855f7'];

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => {
  return (
    <div className="space-y-1 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-100 tracking-tight leading-tight">{title}</h3>
          <p className="text-[10px] text-slate-500 font-semibold">{subtitle}</p>
        </div>
      </div>
      <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-border/5 to-transparent mt-2"></div>
    </div>
  );
};

export const LogisticsAnalytics: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [metrics, setMetrics] = useState<Record<string, StateMetrics>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      setRefreshTrigger(prev => prev + 1);
      const summary = await analyticsService.getLogisticsStateSummary();
      setMetrics(summary);
      setLastUpdated(new Date().toLocaleTimeString());
      toast.success('Logistics analytics refreshed.');
    } catch (err: any) {
      toast.error(`Error loading analytics: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Query visual dashboard/analytics statistics dynamically in a reactive live query
  const stats = useLiveQuery(async () => {
    // 1. Read only logistics_orders where stage = "tracking"
    const allOrders = await db.logistics_orders.where('stage').equals('tracking').toArray();

    // 2. Group by unique Order ID before counting (no double counting)
    const uniqueOrdersMap = new Map<string, any>();
    for (const order of allOrders) {
      if (!order.orderId) continue;
      const cleanId = String(order.orderId).trim().toLowerCase();
      if (!uniqueOrdersMap.has(cleanId)) {
        uniqueOrdersMap.set(cleanId, order);
      }
    }
    const trackingList = Array.from(uniqueOrdersMap.values());

    let inTransit = 0;
    let trackingDelivered = 0;
    let trackingRTO = 0;
    let trackingYet = 0;

    // Courier performance accumulator
    const courierSnapshotMap: Record<string, number> = {
      'ST Courier': 0,
      'Amazon': 0,
      'Delhivery': 0,
      'Ekart': 0,
      'Other': 0
    };

    for (const o of trackingList) {
      const status = String(o.status || '').trim();
      const statusLower = status.toLowerCase();

      // Category Splitting
      if (statusLower.includes('in transit')) {
        inTransit++;
      } else if (statusLower.includes('delivered')) {
        trackingDelivered++;
      } else if (statusLower.includes('rto') || statusLower.includes('returned') || statusLower.includes('return to origin')) {
        trackingRTO++;
      } else if (
        status === '' || 
        statusLower.includes('unable to fetch') || 
        statusLower.includes('sync not available') || 
        statusLower.includes('failed') || 
        statusLower.includes('pending') || 
        statusLower.includes('error') || 
        statusLower.includes('unknown')
      ) {
        trackingYet++;
      } else {
        trackingYet++;
      }

      // Courier Splits
      const rawCourier = (o.courier || '').trim();
      if (rawCourier === 'ST Courier') {
        courierSnapshotMap['ST Courier']++;
      } else if (rawCourier === 'Amazon') {
        courierSnapshotMap['Amazon']++;
      } else if (rawCourier === 'Delhivery') {
        courierSnapshotMap['Delhivery']++;
      } else if (rawCourier === 'Ekart') {
        courierSnapshotMap['Ekart']++;
      } else {
        courierSnapshotMap['Other']++;
      }
    }

    return {
      inTransit,
      trackingDelivered,
      trackingRTO,
      trackingYet,
      courierSt: courierSnapshotMap['ST Courier'],
      courierAmazon: courierSnapshotMap['Amazon'],
      courierDelhivery: courierSnapshotMap['Delhivery'],
      courierEkart: courierSnapshotMap['Ekart'],
      courierUnknown: courierSnapshotMap['Other']
    };
  }, [refreshTrigger]);

  const statesOrder = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Others'];

  const totals = {
    prepaidTotal: 0,
    codTotal: 0,
    totalOrder: 0,
    codDelivered: 0,
    prepaidDelivered: 0,
    codYet: 0,
    prepaidYet: 0,
    prepaidRTO: 0,
    codRTO: 0,
    totalRTO: 0
  };

  statesOrder.forEach(st => {
    const val = metrics[st] || {
      prepaidTotal: 0,
      codTotal: 0,
      totalOrder: 0,
      codDelivered: 0,
      prepaidDelivered: 0,
      codYet: 0,
      prepaidYet: 0,
      prepaidRTO: 0,
      codRTO: 0,
      totalRTO: 0
    };
    totals.prepaidTotal += val.prepaidTotal;
    totals.codTotal += val.codTotal;
    totals.totalOrder += val.totalOrder;
    totals.codDelivered += val.codDelivered;
    totals.prepaidDelivered += val.prepaidDelivered;
    totals.codYet += val.codYet;
    totals.prepaidYet += val.prepaidYet;
    totals.prepaidRTO += val.prepaidRTO;
    totals.codRTO += val.codRTO;
    totals.totalRTO += val.totalRTO;
  });

  const filteredStates = statesOrder.filter(st => 
    st.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const handleExport = () => {
    try {
      const headers = [
        'State',
        'Prepaid',
        'COD',
        'Total Order',
        'COD Delivered',
        'Prepaid Delivered',
        'COD Yet to Delivered',
        'Prepaid Yet to Delivered',
        'Prepaid RTO',
        'COD RTO',
        'Total RTO'
      ];

      const rows = statesOrder.map(st => {
        const val = metrics[st] || {
          prepaidTotal: 0,
          codTotal: 0,
          totalOrder: 0,
          codDelivered: 0,
          prepaidDelivered: 0,
          codYet: 0,
          prepaidYet: 0,
          prepaidRTO: 0,
          codRTO: 0,
          totalRTO: 0
        };
        return [
          st,
          val.prepaidTotal,
          val.codTotal,
          val.totalOrder,
          val.codDelivered,
          val.prepaidDelivered,
          val.codYet,
          val.prepaidYet,
          val.prepaidRTO,
          val.codRTO,
          val.totalRTO
        ];
      });

      rows.push([
        'Total',
        totals.prepaidTotal,
        totals.codTotal,
        totals.totalOrder,
        totals.codDelivered,
        totals.prepaidDelivered,
        totals.codYet,
        totals.prepaidYet,
        totals.prepaidRTO,
        totals.codRTO,
        totals.totalRTO
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Logistics_State_Analytics_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV Export initiated successfully!');
    } catch (e: any) {
      toast.error(`Export failed: ${e.message || String(e)}`);
    }
  };

  const trackingSummaryData = [
    { name: 'In Transit', value: stats?.inTransit || 0 },
    { name: 'Delivered', value: stats?.trackingDelivered || 0 },
    { name: 'Pending/Error', value: stats?.trackingYet || 0 },
    { name: 'RTO', value: stats?.trackingRTO || 0 }
  ];

  const courierSplitData = [
    { name: 'ST Courier', value: stats?.courierSt || 0 },
    { name: 'Amazon', value: stats?.courierAmazon || 0 },
    { name: 'Delhivery', value: stats?.courierDelhivery || 0 },
    { name: 'Ekart', value: stats?.courierEkart || 0 },
    { name: 'Other', value: stats?.courierUnknown || 0 }
  ].filter(c => c.value > 0);

  const fixedCouriersList = [
    { name: 'ST Courier', value: stats?.courierSt || 0 },
    { name: 'Amazon', value: stats?.courierAmazon || 0 },
    { name: 'Delhivery', value: stats?.courierDelhivery || 0 },
    { name: 'Ekart', value: stats?.courierEkart || 0 },
    { name: 'Other', value: stats?.courierUnknown || 0 }
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto max-h-full pr-1 custom-scrollbar pb-6 space-y-5 animate-in fade-in duration-300">
      
      {/* Controls Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-[22px] font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <FileBarChart size={20} className="text-primary" /> Analytics Summary
          </h2>
          <p className="text-muted text-[11px] mt-1">Real-time logistics performance and courier tracking insights.</p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-[10px] text-slate-500 font-semibold shadow-inner">
              <Clock size={12} />
              <span>Synced {lastUpdated}</span>
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="h-9 flex items-center gap-1.5 bg-slate-855 hover:bg-slate-800 disabled:opacity-50 text-slate-200 border border-slate-700/80 px-4 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            title="Refresh calculations from database"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-primary' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExport}
            className="h-9 flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-primary/15 cursor-pointer"
            title="Download CSV report"
          >
            <Download size={13} />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Grid of 2 Visual Analytics cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 shrink-0">
        
        {/* 1. Tracking Analytics */}
        <div className="bg-slate-900/40 border border-border/10 rounded-xl p-5 space-y-4 flex flex-col justify-between h-[270px]">
          <SectionHeader 
            icon={<Truck size={15} />} 
            title="Tracking Analytics" 
            subtitle="Current shipment movement and delivery status." 
          />
          <div className="flex items-center gap-6 flex-1 min-h-0">
            <div className="w-1/2 h-full relative flex justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trackingSummaryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {trackingSummaryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[(index + 2) % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 flex flex-col gap-2 justify-center text-xs">
              <div className="bg-slate-950/40 border border-slate-800/80 p-1.5 rounded-xl flex justify-between items-center shadow-inner">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> In Transit
                </span>
                <span className="text-white font-mono font-bold">{stats?.inTransit || 0}</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/80 p-1.5 rounded-xl flex justify-between items-center shadow-inner">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Delivered
                </span>
                <span className="text-white font-mono font-bold">{stats?.trackingDelivered || 0}</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/80 p-1.5 rounded-xl flex justify-between items-center shadow-inner">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span> Pending/Err
                </span>
                <span className="text-white font-mono font-bold">{stats?.trackingYet || 0}</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/80 p-1.5 rounded-xl flex justify-between items-center shadow-inner">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span> RTO
                </span>
                <span className="text-white font-mono font-bold">{stats?.trackingRTO || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Courier Analytics */}
        <div className="bg-slate-900/40 border border-border/10 rounded-xl p-5 space-y-4 flex flex-col justify-between h-[270px]">
          <SectionHeader 
            icon={<BarChart3 size={15} />} 
            title="Courier Analytics" 
            subtitle="Courier partner split based on tracking AWB." 
          />
          <div className="flex items-center gap-6 flex-1 min-h-0">
            <div className="w-1/2 h-full relative flex justify-center items-center">
              {courierSplitData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={courierSplitData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {courierSplitData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PALETTE[(index + 1) % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-slate-600 text-xs italic">No active couriers</span>
              )}
            </div>
             <div className="w-1/2 grid grid-cols-1 gap-1.5 text-[11px] justify-center">
              {fixedCouriersList.map((c, index) => (
                <div key={index} className="flex justify-between items-center border-b border-border/5 last:border-b-0 pb-0.5 last:pb-0">
                  <span className="text-slate-400 font-semibold truncate">{c.name}</span>
                  <span className="text-white font-mono font-bold">{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Filter Options */}
      <div className="bg-slate-900/40 p-4 rounded-xl border border-border/10 shrink-0 mt-2">
        <div className="relative max-w-sm">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by State..."
            className="h-9 w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 text-xs text-slate-200 focus:outline-none focus:border-primary placeholder:text-slate-600 shadow-sm"
          />
          <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
        </div>
      </div>

      {/* Table Data */}
      <div className="flex-1 min-h-[300px] bg-slate-950/40 border border-border/10 rounded-xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs table-auto min-w-[1000px]">
            <thead className="bg-slate-900/80 sticky top-0 z-10 shadow-sm border-b border-border/20">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900" style={{ width: '150px' }}>State</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900">Prepaid</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900">COD</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900 font-black text-slate-200" style={{ width: '120px' }}>Total Order</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900 text-emerald-400">COD Delivered</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900 text-emerald-400">Prepaid Delivered</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900 text-sky-400">COD Yet to Delivered</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900 text-sky-400">Prepaid Yet to Delivered</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900 text-red-400">Prepaid RTO</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900 text-red-400">COD RTO</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center bg-slate-900 font-black text-red-400">Total RTO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {filteredStates.length > 0 ? (
                filteredStates.map((st) => {
                  const val = metrics[st] || {
                    prepaidTotal: 0,
                    codTotal: 0,
                    totalOrder: 0,
                    codDelivered: 0,
                    prepaidDelivered: 0,
                    codYet: 0,
                    prepaidYet: 0,
                    prepaidRTO: 0,
                    codRTO: 0,
                    totalRTO: 0
                  };
                  return (
                    <tr 
                      key={st} 
                      className={`hover:bg-slate-900/25 transition-colors border-b border-border/5 ${
                        st === 'Tamil Nadu'
                          ? 'bg-blue-950/10 text-blue-200 border-blue-950/20'
                          : st === 'Kerala'
                          ? 'bg-emerald-950/10 text-emerald-200 border-emerald-950/20'
                          : st === 'Karnataka'
                          ? 'bg-amber-950/10 text-amber-200 border-amber-950/20'
                          : st === 'Andhra Pradesh'
                          ? 'bg-rose-950/10 text-rose-200 border-rose-950/20'
                          : st === 'Telangana'
                          ? 'bg-fuchsia-950/10 text-fuchsia-200 border-fuchsia-950/20'
                          : 'bg-slate-950/5 text-slate-400 border-slate-900/5'
                      }`}
                    >
                      <td className="px-4 py-2 font-semibold text-slate-200">{st}</td>
                      <td className="px-4 py-2 text-center font-mono font-medium">{val.prepaidTotal}</td>
                      <td className="px-4 py-2 text-center font-mono font-medium">{val.codTotal}</td>
                      <td className="px-4 py-2 text-center font-mono font-bold bg-slate-950/10">{val.totalOrder}</td>
                      <td className="px-4 py-2 text-center font-mono font-medium text-emerald-500/80">{val.codDelivered}</td>
                      <td className="px-4 py-2 text-center font-mono font-medium text-emerald-500/80">{val.prepaidDelivered}</td>
                      <td className="px-4 py-2 text-center font-mono font-medium text-sky-500/80">{val.codYet}</td>
                      <td className="px-4 py-2 text-center font-mono font-medium text-sky-500/80">{val.prepaidYet}</td>
                      <td className="px-4 py-2 text-center font-mono font-medium text-red-500/80">{val.prepaidRTO}</td>
                      <td className="px-4 py-2 text-center font-mono font-medium text-red-500/80">{val.codRTO}</td>
                      <td className="px-4 py-2 text-center font-mono font-bold bg-red-500/5 text-red-400">{val.totalRTO}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="text-center py-6 text-slate-500 italic">
                    No matching normalized states found.
                  </td>
                </tr>
              )}

              {/* Total Summary Row */}
              <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700">
                <td className="px-4 py-2 text-xs">Total</td>
                <td className="px-4 py-2 text-center font-mono text-xs">{totals.prepaidTotal}</td>
                <td className="px-4 py-2 text-center font-mono text-xs">{totals.codTotal}</td>
                <td className="px-4 py-2 text-center font-mono text-xs bg-slate-950/20">{totals.totalOrder}</td>
                <td className="px-4 py-2 text-center font-mono text-xs text-emerald-400">{totals.codDelivered}</td>
                <td className="px-4 py-2 text-center font-mono text-xs text-emerald-400">{totals.prepaidDelivered}</td>
                <td className="px-4 py-2 text-center font-mono text-xs text-sky-400">{totals.codYet}</td>
                <td className="px-4 py-2 text-center font-mono text-xs text-sky-400">{totals.prepaidYet}</td>
                <td className="px-4 py-2 text-center font-mono text-xs text-red-400">{totals.prepaidRTO}</td>
                <td className="px-4 py-2 text-center font-mono text-xs text-red-400">{totals.codRTO}</td>
                <td className="px-4 py-2 text-center font-mono text-xs bg-red-950/30 text-red-400">{totals.totalRTO}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
