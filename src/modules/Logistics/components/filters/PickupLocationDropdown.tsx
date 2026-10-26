import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X, MapPin } from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';

interface PickupLocationDropdownProps {
  selectedLocations: string[];
  onChange: (locations: string[]) => void;
  orders?: UnifiedLogisticsOrder[];
}

const DEFAULT_LOCATIONS = [
  'VELMORA CONSUMER B2C Erode 638002',
  'VELMORA MAIN WAREHOUSE Erode',
  'VELMORA DISPATCH HUB Erode 638001'
];

export const PickupLocationDropdown: React.FC<PickupLocationDropdownProps> = ({
  selectedLocations,
  onChange,
  orders = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState<string[]>(selectedLocations);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(selectedLocations);
      setSearchTerm('');
    }
  }, [isOpen, selectedLocations]);

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

  // Extract distinct pickup locations from records + defaults
  const availableLocations = useMemo(() => {
    const set = new Set<string>(DEFAULT_LOCATIONS);
    orders.forEach(o => {
      if (o.pickupLocation && o.pickupLocation.trim()) {
        set.add(o.pickupLocation.trim());
      }
    });
    return Array.from(set);
  }, [orders]);

  // Live count per location
  const locationCounts = useMemo(() => {
    const map: Record<string, number> = {};
    availableLocations.forEach(loc => { map[loc] = 0; });
    orders.forEach(o => {
      const loc = o.pickupLocation?.trim() || 'VELMORA CONSUMER B2C Erode 638002';
      if (map[loc] !== undefined) {
        map[loc]++;
      } else {
        // Find best match
        const found = availableLocations.find(l => loc.toLowerCase().includes(l.toLowerCase()));
        if (found) map[found] = (map[found] || 0) + 1;
      }
    });
    return map;
  }, [availableLocations, orders]);

  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return availableLocations;
    const q = searchTerm.toLowerCase();
    return availableLocations.filter(l => l.toLowerCase().includes(q));
  }, [availableLocations, searchTerm]);

  const toggleLocation = (loc: string) => {
    setDraft(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
  };

  const handleApply = () => {
    onChange(draft);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setDraft(selectedLocations);
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraft([]);
  };

  const isActive = selectedLocations.length > 0;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
          isActive
            ? 'bg-purple-950/70 border-purple-600 text-purple-200 shadow-sm'
            : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
        }`}
      >
        <span>Pickup location</span>
        {isActive && (
          <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-bold">
            {selectedLocations.length}
          </span>
        )}
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          
          {/* Header & Search */}
          <div className="p-2.5 border-b border-slate-800/80 bg-[#0b1220]/60">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search pickup locations"
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

          {/* Location List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {filteredLocations.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No matching pickup locations
              </div>
            ) : (
              filteredLocations.map(loc => {
                const checked = draft.includes(loc);
                const count = locationCounts[loc] || 0;
                return (
                  <label
                    key={loc}
                    onClick={() => toggleLocation(loc)}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs select-none transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                          checked
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'border-slate-600 bg-[#0b1220]'
                        }`}
                      >
                        {checked && <Check size={11} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate ${checked ? 'text-purple-200 font-semibold' : 'text-slate-300'}`}>
                          {loc}
                        </p>
                      </div>
                    </div>
                    {count > 0 && (
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400 shrink-0">
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
