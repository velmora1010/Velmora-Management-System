import React, { useState, useRef, useEffect } from 'react';
import { PackageCheck, ChevronDown, Check, X } from 'lucide-react';

interface WebsiteFulfillmentDropdownProps {
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
}

const FULFILLMENT_OPTIONS = [
  { id: 'Fulfilled', label: 'Fulfilled', description: 'Order fulfilled in sales' },
  { id: 'Unfulfilled', label: 'Unfulfilled', description: 'Awaiting sales fulfillment' }
];

export const WebsiteFulfillmentDropdown: React.FC<WebsiteFulfillmentDropdownProps> = ({
  selectedStatuses,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleStatus = (id: string) => {
    if (selectedStatuses.includes(id)) {
      onChange(selectedStatuses.filter(s => s !== id));
    } else {
      onChange([...selectedStatuses, id]);
    }
  };

  const isSelected = (id: string) => selectedStatuses.includes(id);

  const buttonLabel = 
    selectedStatuses.length === 0
      ? 'Fulfillment Status'
      : selectedStatuses.length === 1
      ? selectedStatuses[0]
      : `Fulfillment (${selectedStatuses.length})`;

  const isActive = selectedStatuses.length > 0;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-9 px-3 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm select-none ${
          isActive
            ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-indigo-950/40'
            : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
        }`}
        title="Filter by Fulfillment Status"
      >
        <PackageCheck size={14} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
        <span>{buttonLabel}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-xl bg-[#0b1220] border border-slate-800 shadow-2xl z-50 p-2.5 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <span className="text-xs font-bold text-slate-200">Fulfillment Status</span>
            {selectedStatuses.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1 pt-0.5">
            {FULFILLMENT_OPTIONS.map(opt => {
              const active = isSelected(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleStatus(opt.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left select-none ${
                    active
                      ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      active ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-900'
                    }`}>
                      {active && <Check size={12} strokeWidth={3} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-100">{opt.label}</span>
                      <span className="text-[10px] text-slate-400">{opt.description}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
