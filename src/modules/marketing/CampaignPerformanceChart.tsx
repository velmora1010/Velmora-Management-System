import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PerformanceChartProps {
  metrics: {
    diyCount: number;
    spongeCount: number;
    diyVideos: number;
    spongeVideos: number;
    diyBudget: number;
    spongeBudget: number;
  };
}

export const CampaignPerformanceChart: React.FC<PerformanceChartProps> = ({ metrics }) => {
  // We need to scale down budget so it doesn't break the chart visually compared to small counts like videos
  // We will divide budget by 1000 and label it "Budget (in K)"
  const data = [
    {
      name: 'Influencers',
      DIY: metrics.diyCount,
      Sponge: metrics.spongeCount,
    },
    {
      name: 'Videos',
      DIY: metrics.diyVideos,
      Sponge: metrics.spongeVideos,
    },
    {
      name: 'Budget (in K)',
      DIY: Math.round(metrics.diyBudget / 1000),
      Sponge: Math.round(metrics.spongeBudget / 1000),
    }
  ];

  return (
    <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 flex flex-col h-full min-h-[400px]">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-100">Performance Bar Chart</h3>
        <p className="text-slate-400 text-sm">DIY vs Sponge metrics comparison</p>
      </div>
      
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: '#334155', opacity: 0.4 }}
              contentStyle={{ backgroundColor: '#1e2536', borderColor: '#334155', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="DIY" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
            <Bar dataKey="Sponge" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
