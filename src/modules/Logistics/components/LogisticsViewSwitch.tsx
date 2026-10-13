import React from 'react';
import { Users, Package } from 'lucide-react';

export type LogisticsMainView = 'customers' | 'orders';

interface LogisticsViewSwitchProps {
  currentView: LogisticsMainView;
  onViewChange: (view: LogisticsMainView) => void;
  customerCount?: number;
  orderCount?: number;
}

export const LogisticsViewSwitch: React.FC<LogisticsViewSwitchProps> = ({
  currentView,
  onViewChange,
  customerCount,
  orderCount
}) => {
  return (
    <div 
      role="tablist"
      aria-label="Logistics View Switch"
      className="inline-flex items-center p-1 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-inner backdrop-blur-md"
    >
      {/* Customers Tab */}
      <button
        role="tab"
        aria-selected={currentView === 'customers'}
        type="button"
        onClick={() => onViewChange('customers')}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer select-none ${
          currentView === 'customers'
            ? 'bg-purple-600 text-white border border-purple-500 shadow-md shadow-purple-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
      >
        <Users size={15} className={currentView === 'customers' ? 'text-white' : 'text-slate-400'} />
        <span>Customers</span>
        {customerCount !== undefined && (
          <span
            className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full leading-none transition-colors ${
              currentView === 'customers'
                ? 'bg-purple-950 text-white border border-purple-400/40'
                : 'bg-slate-800 text-slate-300 border border-slate-700/60'
            }`}
          >
            {customerCount.toLocaleString()}
          </span>
        )}
      </button>

      {/* Orders Tab */}
      <button
        role="tab"
        aria-selected={currentView === 'orders'}
        type="button"
        onClick={() => onViewChange('orders')}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer select-none ${
          currentView === 'orders'
            ? 'bg-purple-600 text-white border border-purple-500 shadow-md shadow-purple-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
      >
        <Package size={15} className={currentView === 'orders' ? 'text-white' : 'text-slate-400'} />
        <span>Orders</span>
        {orderCount !== undefined && (
          <span
            className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full leading-none transition-colors ${
              currentView === 'orders'
                ? 'bg-purple-950 text-white border border-purple-400/40'
                : 'bg-slate-800 text-slate-300 border border-slate-700/60'
            }`}
          >
            {orderCount.toLocaleString()}
          </span>
        )}
      </button>
    </div>
  );
};
