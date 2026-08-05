import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart } from 'lucide-react';

export const AmazonSales: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 p-6 lg:p-8 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Amazon</h1>
            <p className="text-sm text-slate-400">Amazon marketplace sales channel</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/sales')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer font-medium text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <ArrowLeft size={16} /> Back to Sales
        </button>
      </div>

      {/* PLACEHOLDER CONTENT */}
      <div className="flex flex-col items-center justify-center py-20 bg-slate-900/60 border border-slate-800 rounded-2xl text-center p-8 space-y-4 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
          <ShoppingCart size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">Amazon</h2>
        <p className="text-slate-400 max-w-md">
          This sales channel module will be implemented in the next phase.
        </p>
        <button
          onClick={() => navigate('/sales')}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-medium rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <ArrowLeft size={16} /> Back to Sales
        </button>
      </div>
    </div>
  );
};
