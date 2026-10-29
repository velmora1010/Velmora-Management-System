import React, { useMemo, useState } from 'react';
import { 
  MapPin, 
  Search, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertTriangle, 
  Timer, 
  IndianRupee, 
  BarChart3, 
  TrendingUp,
  X,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { 
  getCanonicalStatus, 
  checkDeliverySla, 
  formatINR, 
  isCodOrder 
} from '../../utils/logisticsAnalyticsUtils';
import { normalizeState, resolveCustomerLocationDisplay, parseOrderAmount } from '../../../../utils/logisticsOrderUtils';

interface GeographicLogisticsSectionProps {
  orders: UnifiedLogisticsOrder[];
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
}

export const GeographicLogisticsSection: React.FC<GeographicLogisticsSectionProps> = ({
  orders,
  onDrillDown
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'states' | 'cities'>('states');
  const [sortField, setSortField] = useState<'volume' | 'success' | 'rto' | 'speed'>('volume');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Group by State and City
  const { stateList, cityList } = useMemo(() => {
    const stateMap = new Map<string, {
      name: string;
      total: number;
      delivered: number;
      rto: number;
      delayed: number;
      codCount: number;
      prepaidCount: number;
      totalDays: number;
      deliveredWithDays: number;
      totalAmount: number;
    }>();

    const cityMap = new Map<string, {
      name: string;
      state: string;
      total: number;
      delivered: number;
      rto: number;
      delayed: number;
      codCount: number;
      prepaidCount: number;
      totalDays: number;
      deliveredWithDays: number;
      totalAmount: number;
    }>();

    orders.forEach(o => {
      const stateName = normalizeState(o.state) || 'Other / Unspecified';
      const cityName = (o.city || o.shippingCity || '').trim() || 'Unknown City';
      const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;
      const canonical = getCanonicalStatus(o);
      const sla = checkDeliverySla(o);
      const isCod = isCodOrder(o);

      // State record
      if (!stateMap.has(stateName)) {
        stateMap.set(stateName, {
          name: stateName,
          total: 0,
          delivered: 0,
          rto: 0,
          delayed: 0,
          codCount: 0,
          prepaidCount: 0,
          totalDays: 0,
          deliveredWithDays: 0,
          totalAmount: 0
        });
      }
      const st = stateMap.get(stateName)!;
      st.total++;
      st.totalAmount += amt;
      if (isCod) st.codCount++; else st.prepaidCount++;
      if (canonical === 'Delivered') {
        st.delivered++;
        if (sla.deliveryDays !== null && sla.deliveryDays >= 0) {
          st.totalDays += sla.deliveryDays;
          st.deliveredWithDays++;
        }
      } else if (canonical.includes('RTO')) {
        st.rto++;
      }
      if (sla.isLate || sla.isOverdue) {
        st.delayed++;
      }

      // City record
      if (cityName !== 'Unknown City') {
        const cityKey = `${cityName}__${stateName}`;
        if (!cityMap.has(cityKey)) {
          cityMap.set(cityKey, {
            name: cityName,
            state: stateName,
            total: 0,
            delivered: 0,
            rto: 0,
            delayed: 0,
            codCount: 0,
            prepaidCount: 0,
            totalDays: 0,
            deliveredWithDays: 0,
            totalAmount: 0
          });
        }
        const ct = cityMap.get(cityKey)!;
        ct.total++;
        ct.totalAmount += amt;
        if (isCod) ct.codCount++; else ct.prepaidCount++;
        if (canonical === 'Delivered') {
          ct.delivered++;
          if (sla.deliveryDays !== null && sla.deliveryDays >= 0) {
            ct.totalDays += sla.deliveryDays;
            ct.deliveredWithDays++;
          }
        } else if (canonical.includes('RTO')) {
          ct.rto++;
        }
        if (sla.isLate || sla.isOverdue) {
          ct.delayed++;
        }
      }
    });

    const formatList = (map: Map<string, any>) => {
      return Array.from(map.values()).map(item => {
        const concluded = item.delivered + item.rto;
        const successRate = concluded > 0
          ? Math.round((item.delivered / concluded) * 100)
          : (item.total > 0 ? Math.round((item.delivered / item.total) * 100) : 0);

        const rtoRate = concluded > 0
          ? parseFloat(((item.rto / concluded) * 100).toFixed(1))
          : 0;

        const avgDays = item.deliveredWithDays > 0
          ? parseFloat((item.totalDays / item.deliveredWithDays).toFixed(1))
          : null;

        const isHighException = (rtoRate >= 15 && concluded >= 5) || (item.delayed >= 5 && item.total >= 10);

        return {
          ...item,
          successRate,
          rtoRate,
          avgDays,
          isHighException
        };
      });
    };

    return {
      stateList: formatList(stateMap),
      cityList: formatList(cityMap)
    };
  }, [orders]);

  // Current list based on active tab and search
  const currentList = activeTab === 'states' ? stateList : cityList;

  const filteredList = useMemo(() => {
    let list = currentList;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(item => 
        item.name.toLowerCase().includes(q) || 
        (item.state && item.state.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortField === 'volume') diff = b.total - a.total;
      else if (sortField === 'success') diff = b.successRate - a.successRate;
      else if (sortField === 'rto') diff = a.rtoRate - b.rtoRate;
      else if (sortField === 'speed') diff = (a.avgDays || 999) - (b.avgDays || 999);

      return sortAsc ? -diff : diff;
    });
  }, [currentList, searchTerm, sortField, sortAsc]);

  // Chart: Top 8 States by Volume
  const topVolumeChartData = useMemo(() => {
    return [...stateList]
      .filter(s => s.name !== 'Other / Unspecified')
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [stateList]);

  // Chart: Top States by RTO Rate
  const topRtoChartData = useMemo(() => {
    return [...stateList]
      .filter(s => s.total >= 10 && s.name !== 'Other / Unspecified' && s.rto > 0)
      .sort((a, b) => b.rtoRate - a.rtoRate)
      .slice(0, 8);
  }, [stateList]);

  const toggleSort = (field: 'volume' | 'success' | 'rto' | 'speed') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* SECTION HEADER */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin size={18} className="text-cyan-400" />
            <span>Geographic Logistics Intelligence</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Regional fulfillment density, delivery turnaround speeds, and destination return risks
          </p>
        </div>

        {/* Tab Toggle: States vs Cities */}
        <div className="flex items-center bg-[#0e1626] border border-slate-800 rounded-xl p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('states')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'states' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            States ({stateList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cities')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'cities' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cities ({cityList.length})
          </button>
        </div>
      </div>

      {/* TWO CHARTS: TOP VOLUME LOCATIONS & HIGHEST RTO LOCATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* CHART 1: Top States by Volume */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 size={15} className="text-cyan-400" />
                Top Destination States by Volume
              </h4>
              <p className="text-xs text-slate-400">Total orders processed per destination state</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVolumeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={10} 
                  angle={-20} 
                  textAnchor="end"
                  tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any, name: any, item: any) => [
                    `${val} orders (${item.payload.delivered} delivered, ${formatINR(item.payload.totalAmount)})`,
                    'Orders'
                  ]}
                />
                <Bar
                  dataKey="total"
                  fill="#06b6d4"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) => {
                    if (entry && entry.name) {
                      onDrillDown(
                        `Orders in ${entry.name}`,
                        `All shipments delivered to ${entry.name}`,
                        o => normalizeState(o.state) === entry.name
                      );
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Highest RTO Rate States */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-400" />
                Highest RTO Rates by State
              </h4>
              <p className="text-xs text-slate-400">States with min. 10 shipments ranked by RTO %</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {topRtoChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No high-RTO states with sufficient volume
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRtoChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={10} 
                    angle={-20} 
                    textAnchor="end"
                    tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                  />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val}% RTO rate (${item.payload.rto} of ${item.payload.total} orders)`,
                      'RTO Rate'
                    ]}
                  />
                  <Bar
                    dataKey="rtoRate"
                    fill="#f43f5e"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(entry) => {
                      if (entry && entry.name) {
                        onDrillDown(
                          `RTO Orders in ${entry.name}`,
                          `Returned shipments in ${entry.name}`,
                          o => normalizeState(o.state) === entry.name && getCanonicalStatus(o).includes('RTO')
                        );
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* SEARCHABLE REGIONAL PERFORMANCE TABLE */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">
              {activeTab === 'states' ? 'State Performance Table' : 'City Performance Table'}
            </h4>
            <span className="text-[11px] font-mono text-slate-400 bg-[#0e1626] border border-slate-800 px-2 py-0.5 rounded">
              {filteredList.length} records
            </span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeTab === 'states' ? 'state' : 'city'}...`}
              className="w-full bg-[#0e1626] border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar max-h-96">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0e1626] text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5">{activeTab === 'states' ? 'State' : 'City & State'}</th>
                <th 
                  onClick={() => toggleSort('volume')}
                  className="px-4 py-3.5 text-center cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Volume</span>
                    <ArrowUpDown size={11} className={sortField === 'volume' ? 'text-cyan-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('success')}
                  className="px-4 py-3.5 text-center text-emerald-400 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Success Rate</span>
                    <ArrowUpDown size={11} className={sortField === 'success' ? 'text-emerald-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('rto')}
                  className="px-4 py-3.5 text-center text-rose-400 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>RTO Rate</span>
                    <ArrowUpDown size={11} className={sortField === 'rto' ? 'text-rose-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('speed')}
                  className="px-4 py-3.5 text-center text-blue-400 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Avg Delivery Time</span>
                    <ArrowUpDown size={11} className={sortField === 'speed' ? 'text-blue-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center text-yellow-400">Delayed Shipments</th>
                <th className="px-4 py-3.5 text-center">COD vs Prepaid</th>
                <th className="px-4 py-3.5 text-right">Order Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-500">
                    No matching location records found
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr 
                    key={`${item.name}-${idx}`}
                    onClick={() => onDrillDown(
                      `Orders in ${item.name}`,
                      `All shipments for ${item.name}`,
                      o => activeTab === 'states' 
                        ? normalizeState(o.state) === item.name
                        : (o.city || o.shippingCity || '').toLowerCase() === item.name.toLowerCase()
                    )}
                    className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="group-hover:text-cyan-300 transition-colors">{item.name}</span>
                        {item.state && <span className="text-[10px] text-slate-500 font-normal">({item.state})</span>}
                        {item.isHighException && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/50">
                            High Return Risk
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-300">
                      {item.total.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                        {item.successRate}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-rose-400">
                      {item.rto} ({item.rtoRate}%)
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-300">
                      {item.avgDays ? `${item.avgDays}d` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-yellow-400">
                      {item.delayed > 0 ? item.delayed : '0'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-[11px] text-slate-400">
                      <span className="text-cyan-400">{item.codCount} COD</span> / <span className="text-purple-400">{item.prepaidCount} Pre</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300 font-bold">
                      {formatINR(item.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
