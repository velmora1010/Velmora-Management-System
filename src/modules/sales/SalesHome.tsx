import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ArrowLeft } from 'lucide-react';
import { SALES_CHANNELS } from './salesChannels';
import { SalesChannelCard } from './SalesChannelCard';

export const SalesHome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6 lg:p-8 animate-in fade-in duration-300">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/')}
            className="mt-1 p-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
            title="Back to Home"
            aria-label="Back to Home"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <TrendingUp size={24} />
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Sales Department</h1>
            </div>
            <p className="text-sm text-slate-400 pl-0.5">
              Manage and monitor sales across all channels.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="self-start sm:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-sm rounded-xl border border-slate-700/80 transition-all flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <ArrowLeft size={16} /> Back to Home
        </button>
      </div>

      {/* CHANNEL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {SALES_CHANNELS.map(channel => (
          <SalesChannelCard key={channel.id} channel={channel} />
        ))}
      </div>
    </div>
  );
};
