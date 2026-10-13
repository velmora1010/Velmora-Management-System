import React from 'react';
import { 
  Users, 
  Package, 
  Truck, 
  AlertTriangle, 
  RotateCcw,
  Clock
} from 'lucide-react';
import type { UnifiedWorkflowStage, LogisticsSummaryCounts } from '../../../types/unifiedLogistics';

interface LogisticsWorkflowFiltersProps {
  currentStage: UnifiedWorkflowStage;
  onSelectStage: (stage: UnifiedWorkflowStage) => void;
  counts: LogisticsSummaryCounts;
  selectedCourier: string;
  onSelectCourier: (courier: string) => void;
  courierList: string[];
}

export const LogisticsWorkflowFilters: React.FC<LogisticsWorkflowFiltersProps> = ({
  currentStage,
  onSelectStage,
  counts,
  selectedCourier,
  onSelectCourier,
  courierList
}) => {
  const stagePills: Array<{
    id: UnifiedWorkflowStage;
    label: string;
    count: number;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      id: 'all',
      label: 'All Orders',
      count: counts.totalOrders,
      icon: <Package size={13} />,
      color: 'blue'
    },
    {
      id: 'imported',
      label: 'Imported',
      count: counts.imported,
      icon: <Clock size={13} />,
      color: 'purple'
    },
    {
      id: 'ready_to_dispatch',
      label: 'Ready to Dispatch',
      count: counts.readyToDispatch,
      icon: <Truck size={13} />,
      color: 'purple'
    },
    {
      id: 'in_transit',
      label: 'In Transit',
      count: counts.inTransit,
      icon: <Truck size={13} />,
      color: 'amber'
    },
    {
      id: 'out_for_delivery',
      label: 'Out for Delivery',
      count: counts.outForDelivery,
      icon: <Truck size={13} />,
      color: 'sky'
    },
    {
      id: 'delivered',
      label: 'Delivered',
      count: counts.delivered,
      icon: <Package size={13} />,
      color: 'emerald'
    },
    {
      id: 'exceptions',
      label: 'Exceptions',
      count: counts.exceptions,
      icon: <AlertTriangle size={13} />,
      color: 'rose'
    },
    {
      id: 'rto',
      label: 'RTO / Returned',
      count: counts.rto,
      icon: <RotateCcw size={13} />,
      color: 'rose'
    }
  ];

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Workflow Stage Pills Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {stagePills.map((pill) => {
          const isActive = currentStage === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => onSelectStage(pill.id)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 transition-all cursor-pointer border select-none ${
                isActive
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                  : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-400'}>
                {pill.icon}
              </span>
              <span>{pill.label}</span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                  isActive
                    ? 'bg-purple-950 text-white border border-purple-400/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                }`}
              >
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Courier Filter Chips (if any couriers detected) */}
      {courierList.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar text-xs">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Courier:
          </span>
          <button
            type="button"
            onClick={() => onSelectCourier('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 border transition-colors cursor-pointer ${
              selectedCourier === 'all'
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Couriers
          </button>
          {courierList.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onSelectCourier(c)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 border transition-colors cursor-pointer ${
                selectedCourier === c
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
