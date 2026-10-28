import React from 'react';
import { 
  FileText, 
  Package, 
  Truck, 
  RotateCcw, 
  CheckCircle2, 
  Layers, 
  XCircle,
  Clock
} from 'lucide-react';
import type { LogisticsSection } from '../types/logisticsFilters';

export interface LogisticsSectionSidebarProps {
  activeSection: LogisticsSection;
  onSelectSection: (section: LogisticsSection) => void;
  counts: Record<LogisticsSection, number>;
}

export interface SectionItem {
  id: LogisticsSection;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const SECTIONS: SectionItem[] = [
  { id: 'all_shipments', label: 'All Shipments', icon: Layers },
  { id: 'pending_awb', label: 'Pending AWB', icon: Clock },
  { id: 'ready_to_ship', label: 'Ready to Ship', icon: Package },
  { id: 'ready_for_pickup', label: 'Ready for Pickup', icon: FileText },
  { id: 'in_transit', label: 'In Transit', icon: Truck },
  { id: 'rto_in_transit', label: 'RTO - In Transit', icon: RotateCcw },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  { id: 'cancelled_orders', label: 'Cancelled Orders', icon: XCircle }
];

export const LogisticsSectionSidebar: React.FC<LogisticsSectionSidebarProps> = ({
  activeSection,
  onSelectSection,
  counts
}) => {
  return (
    <div className="flex flex-col gap-2 w-full shrink-0">
      
      {/* Orders Heading & Total Count Badge */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-extrabold text-white tracking-tight">Orders</h2>
          <span className="text-[11px] font-mono text-purple-400 bg-purple-950/70 border border-purple-800/60 px-2.5 py-0.5 rounded-full font-bold shadow-sm">
            {(counts.all_shipments || 0).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Horizontal Shipment Status Navigation Row (8 Items Side-by-Side on Desktop) */}
      <div className="w-full overflow-x-auto custom-scrollbar pb-1">
        <div className="grid grid-cols-8 gap-2 min-w-[980px] w-full">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const isSelected = activeSection === item.id;
            const count = counts[item.id] || 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none border min-w-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30 font-bold'
                    : 'bg-[#0e1626] border-slate-800/90 text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-700'
                }`}
                title={`${item.label} (${count.toLocaleString('en-IN')})`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon 
                    size={14} 
                    className={`shrink-0 ${
                      isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`} 
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {count.toLocaleString('en-IN')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export const LogisticsSectionNavbar = LogisticsSectionSidebar;
