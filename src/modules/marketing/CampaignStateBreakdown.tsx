import React, { useMemo, useState } from 'react';
import type { CampaignInfluencer } from '../../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const STATE_COLOR_MAP: Record<string, string> = {
  'Karnataka': '#b388ff',
  'Tamil Nadu': '#69f0ae',
  'Telangana': '#448aff',
  'Kerala': '#ffab40',
  'Uttar Pradesh': '#ff5252',
  'Andhra Pradesh': '#18ffff',
  'Jharkhand': '#ff4081',
  'Rajasthan': '#ffe57f',
  'Maharashtra': '#64ffda',
  'Delhi': '#8c9eff',
  'New Delhi': '#8c9eff',
  'Gujarat': '#b2ff59',
  'West Bengal': '#ff8a65',
  'Assam': '#ffd740',
  'Bihar': '#40c4ff',
  'Chhattisgarh': '#ff6e40',
  'Goa': '#ff80ab',
  'Haryana': '#76ff03',
  'Himachal Pradesh': '#84ffff',
  'Madhya Pradesh': '#ffd180',
  'Manipur': '#e040fb',
  'Meghalaya': '#1de9b6',
  'Mizoram': '#ffca28',
  'Nagaland': '#ea80fc',
  'Odisha': '#00e676',
  'Punjab': '#ff1744',
  'Sikkim': '#2979ff',
  'Tripura': '#c6ff00',
  'Uttarakhand': '#ff3d00',
  'Arunachal Pradesh': '#b0bec5',
  'Andaman and Nicobar Islands': '#ce93d8',
  'Chandigarh': '#00b8d4',
  'Dadra and Nagar Haveli': '#a7ffeb',
  'Daman and Diu': '#b39ddb',
  'Jammu and Kashmir': '#d84315',
  'Ladakh': '#90caf9',
  'Lakshadweep': '#f48fb1',
  'Puducherry': '#00e5ff',
  'Unknown': '#9e9e9e'
};

export const getStateColor = (stateName: string): string => {
  if (STATE_COLOR_MAP[stateName]) {
    return STATE_COLOR_MAP[stateName];
  }
  let hash = 0;
  for (let i = 0; i < stateName.length; i++) {
    hash = stateName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export const normalizeStateName = (rawState: string | undefined | null): string => {
  if (!rawState) return 'Unknown';
  let state = rawState.trim().toLowerCase().replace(/\s+/g, ' ');

  if (state === 'tamilnadu') state = 'tamil nadu';
  if (state === 'newdelhi') state = 'new delhi';
  if (state === 'uttarpradesh') state = 'uttar pradesh';
  if (state === 'madhyapradesh') state = 'madhya pradesh';
  if (state === 'andhrapradesh') state = 'andhra pradesh';
  if (state === 'himachalpradesh') state = 'himachal pradesh';
  if (state === 'arunachalpradesh') state = 'arunachal pradesh';
  if (state === 'westbengal') state = 'west bengal';
  if (state === 'jammuandkashmir') state = 'jammu and kashmir';
  
  return state.replace(/\b\w/g, l => l.toUpperCase());
};

interface CampaignStateBreakdownProps {
  influencers: CampaignInfluencer[];
}

interface StateMetrics {
  state: string;
  influencersTotal: number;
  influencersDIY: number;
  influencersSponge: number;
  videosTotal: number;
  videosDIY: number;
  videosSponge: number;
  budgetTotal: number;
  budgetDIY: number;
  budgetSponge: number;
  color: string;
}

export const CampaignStateBreakdown: React.FC<CampaignStateBreakdownProps> = ({ influencers }) => {
  const [expanded, setExpanded] = useState(false);

  const activeInfluencers = useMemo(() => influencers.filter(inf => !inf.is_archived), [influencers]);

  const { chartData, stateCards } = useMemo(() => {
    const metricsMap = new Map<string, StateMetrics>();

    activeInfluencers.forEach(inf => {
      const state = normalizeStateName(inf.state);
      
      if (!metricsMap.has(state)) {
        metricsMap.set(state, {
          state,
          influencersTotal: 0,
          influencersDIY: 0,
          influencersSponge: 0,
          videosTotal: 0,
          videosDIY: 0,
          videosSponge: 0,
          budgetTotal: 0,
          budgetDIY: 0,
          budgetSponge: 0,
          color: getStateColor(state)
        });
      }

      const metrics = metricsMap.get(state)!;
      metrics.influencersTotal++;

      const p = inf.pricing;
      if (p) {
        const v1Count = Number(p.video1_count) || 0;
        const v2Count = Number(p.video2_count) || 0;
        const v1Price = Number(p.video1_price) || 0;
        const v2Price = Number(p.video2_price) || 0;

        if (v1Count > 0) metrics.influencersDIY++;
        if (v2Count > 0) metrics.influencersSponge++;

        metrics.videosDIY += v1Count;
        metrics.videosSponge += v2Count;
        metrics.videosTotal += (v1Count + v2Count);

        metrics.budgetDIY += v1Price;
        metrics.budgetSponge += v2Price;
        metrics.budgetTotal += (v1Price + v2Price);
      }
    });

    const cards = Array.from(metricsMap.values()).sort((a, b) => b.influencersTotal - a.influencersTotal);
    
    const chartData = cards.map(c => ({
      name: c.state,
      value: c.influencersTotal,
      color: c.color
    }));

    return { chartData, stateCards: cards };
  }, [activeInfluencers]);

  if (stateCards.length === 0) {
    return (
      <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 flex items-center justify-center min-h-[400px]">
        <span className="text-slate-500">No state data available</span>
      </div>
    );
  }

  const visibleCards = expanded ? stateCards : stateCards.slice(0, 4);

  return (
    <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-100">State Breakdown</h3>
        {stateCards.length > 4 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg border border-slate-700 transition-colors"
          >
            {expanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>

      {/* Doughnut Chart */}
      <div className="h-[250px] w-full mb-8">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              stroke="none"
              dataKey="value"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e2536', borderColor: '#334155', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="square"
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* State Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleCards.map((card, i) => (
          <div key={i} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: card.color }}></div>
              <h4 className="font-semibold text-slate-200 text-sm truncate">{card.state}</h4>
            </div>

            <div className="space-y-4 text-xs text-slate-400">
              
              {/* Influencers */}
              <div className="space-y-2">
                <div className="flex justify-between font-medium border-b border-slate-700 pb-1">
                  <span className="text-slate-300">Influencers</span>
                  <span className="text-slate-100">{card.influencersTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>DIY</span>
                  <span className="text-slate-300">{card.influencersDIY.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sponge</span>
                  <span className="text-slate-300">{card.influencersSponge.toLocaleString()}</span>
                </div>
              </div>

              {/* Videos */}
              <div className="space-y-2">
                <div className="flex justify-between font-medium border-b border-slate-700 pb-1">
                  <span className="text-slate-300">Videos</span>
                  <span className="text-slate-100">{card.videosTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>DIY</span>
                  <span className="text-slate-300">{card.videosDIY.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sponge</span>
                  <span className="text-slate-300">{card.videosSponge.toLocaleString()}</span>
                </div>
              </div>

              {/* Budget */}
              <div className="space-y-2">
                <div className="flex justify-between font-medium border-b border-slate-700 pb-1">
                  <span className="text-slate-300">Budget</span>
                  <span className="text-slate-100">₹{card.budgetTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>DIY</span>
                  <span className="text-slate-300">₹{card.budgetDIY.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sponge</span>
                  <span className="text-slate-300">₹{card.budgetSponge.toLocaleString()}</span>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
