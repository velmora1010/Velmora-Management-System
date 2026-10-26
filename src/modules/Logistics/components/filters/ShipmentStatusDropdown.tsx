import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { CANONICAL_SHIPMENT_STATUSES, getOrderShipmentStatus } from '../../types/logisticsFilters';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';

interface ShipmentStatusDropdownProps {
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
  orders?: UnifiedLogisticsOrder[];
}

export const ShipmentStatusDropdown: React.FC<ShipmentStatusDropdownProps> = ({
  selectedStatuses,
  onChange,
  orders = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState<string[]>(selectedStatuses);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync draft when opened
  useEffect(() => {
    if (isOpen) {
      setDraft(selectedStatuses);
      setSearchTerm('');
    }
  }, [isOpen, selectedStatuses]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Calculate live count per status
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    CANONICAL_SHIPMENT_STATUSES.forEach(st => { map[st] = 0; });
    orders.forEach(order => {
      const canonical = getOrderShipmentStatus(order);
      if (map[canonical] !== undefined) {
        map[canonical]++;
      }
    });
    return map;
  }, [orders]);

  const filteredStatuses = useMemo(() => {
    if (!searchTerm.trim()) return CANONICAL_SHIPMENT_STATUSES;
    const q = searchTerm.toLowerCase();
    return CANONICAL_SHIPMENT_STATUSES.filter(s => s.toLowerCase().includes(q));
  }, [searchTerm]);

  const toggleStatus = (st: string) => {
    setDraft(prev => 
      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
    );
  };

  const handleApply = () => {
    onChange(draft);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setDraft(selectedStatuses);
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraft([]);
  };

  const isActive = selectedStatuses.length > 0;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
          isActive
            ? 'bg-purple-950/70 border-purple-600 text-purple-200 shadow-sm'
            : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
        }`}
      >
        <span>Shipment status</span>
        {isActive && (
          <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-bold">
            {selectedStatuses.length}
          </span>
        )}
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          
          {/* Header & Search */}
          <div className="p-2.5 border-b border-slate-800/80 bg-[#0b1220]/60">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search shipment status"
                className="w-full h-8 pl-8 pr-7 bg-[#111c30] border border-slate-700/70 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-200"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Status List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {filteredStatuses.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No matching statuses
              </div>
            ) : (
              filteredStatuses.map(st => {
                const checked = draft.includes(st);
                const count = statusCounts[st] || 0;
                return (
                  <label
                    key={st}
                    onClick={() => toggleStatus(st)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs select-none transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          checked
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'border-slate-600 bg-[#0b1220]'
                        }`}
                      >
                        {checked && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span className={checked ? 'text-purple-200 font-semibold' : 'text-slate-300'}>
                        {st}
                      </span>
                    </div>
                    {count > 0 && (
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400">
                        {count}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-2 border-t border-slate-800/80 bg-[#0b1220]/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded transition-colors"
            >
              Clear
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCancel}
                className="h-7 px-2.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="h-7 px-3 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
