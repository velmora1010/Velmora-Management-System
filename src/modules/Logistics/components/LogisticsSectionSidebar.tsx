import React from 'react';
import { 
  FileText, 
  Package, 
  Truck, 
  RotateCcw, 
  CheckCircle2, 
  Layers, 
  ExternalLink,
  Clock
} from 'lucide-react';
import type { LogisticsSection } from '../types/logisticsFilters';

interface LogisticsSectionSidebarProps {
  activeSection: LogisticsSection;
  onSelectSection: (section: LogisticsSection) => void;
  counts: Record<LogisticsSection, number>;
}

interface SectionItem {
  id: LogisticsSection;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const SECTIONS: SectionItem[] = [
  { id: 'pending_awb', label: 'Pending AWB', icon: Clock },
  { id: 'ready_to_ship', label: 'Ready to ship', icon: Package },
  { id: 'ready_for_pickup', label: 'Ready for pickup', icon: FileText },
  { id: 'in_transit', label: 'In transit', icon: Truck },
  { id: 'rto_in_transit', label: 'RTO - In transit', icon: RotateCcw },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  { id: 'all_shipments', label: 'All shipments', icon: Layers },
  { id: 'third_party', label: 'Shipped via third party', icon: ExternalLink }
];

export const LogisticsSectionSidebar: React.FC<LogisticsSectionSidebarProps> = ({
  activeSection,
  onSelectSection,
  counts
}) => {
  return (
    <div className="flex flex-col w-full h-full bg-[#0b1220] border border-slate-800/90 rounded-2xl overflow-hidden shrink-0 shadow-sm">
      
      {/* Sidebar Header */}
      <div className="px-4 py-3.5 border-b border-slate-800/80 bg-[#0e1626]/70 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-white tracking-tight">Orders</h2>
        <span className="text-[11px] font-mono text-purple-400 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-full font-bold">
          {counts.all_shipments.toLocaleString()}
        </span>
      </div>

      {/* Sections List */}
      <div className="p-2 flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1">
        {SECTIONS.map(item => {
          const Icon = item.icon;
          const isSelected = activeSection === item.id;
          const count = counts[item.id] || 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none border ${
                isSelected
                  ? 'bg-purple-600/90 text-white border-purple-500 shadow-md shadow-purple-600/25'
                  : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon 
                  size={14} 
                  className={`shrink-0 ${
                    isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`} 
                />
                <span className="truncate">{item.label}</span>
              </div>

              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-900 text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
};
