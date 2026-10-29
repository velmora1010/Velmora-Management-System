import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CreditCard, ChevronDown, Check } from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { calculateOrderPaymentMode } from '../../types/logisticsFilters';

interface PaymentModeDropdownProps {
  selectedModes: string[];
  onChange: (modes: string[]) => void;
  orders?: UnifiedLogisticsOrder[];
}

export const PaymentModeDropdown: React.FC<PaymentModeDropdownProps> = ({
  selectedModes,
  onChange,
  orders = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<string[]>(selectedModes);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftSelected(selectedModes);
  }, [selectedModes, isOpen]);

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

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      COD: 0,
      Prepaid: 0,
      Pickup: 0,
      Replacement: 0
    };
    orders.forEach(o => {
      const mode = calculateOrderPaymentMode(o);
      if (map[mode] !== undefined) map[mode]++;
    });
    return map;
  }, [orders]);

  const toggleOption = (mode: string) => {
    setDraftSelected(prev => 
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );
  };

  const handleApply = () => {
    onChange(draftSelected);
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraftSelected([]);
    onChange([]);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-9 px-3 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
          selectedModes.length > 0
            ? 'bg-emerald-950/70 border-emerald-500/80 text-white font-semibold'
            : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
        }`}
        title="Filter by Payment Mode"
      >
        <CreditCard size={13} className={selectedModes.length > 0 ? 'text-emerald-400' : 'text-slate-400'} />
        <span>
          {selectedModes.length === 0
            ? 'Payment mode'
            : selectedModes.length === 1
            ? selectedModes[0]
            : `Payment (${selectedModes.length})`}
        </span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-[#0b1220] border border-slate-800 shadow-2xl z-50 p-2.5 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <span className="text-xs font-bold text-slate-200">Payment mode</span>
            {draftSelected.length > 0 && (
              <button
                type="button"
                onClick={() => setDraftSelected([])}
                className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1 py-0.5">
            {[
              { id: 'COD', label: 'Cash on Delivery (COD)', count: counts.COD },
              { id: 'Prepaid', label: 'Prepaid', count: counts.Prepaid },
              { id: 'Pickup', label: 'Pickup', count: counts.Pickup },
              { id: 'Replacement', label: 'Replacement', count: counts.Replacement }
            ].map(item => {
              const isChecked = draftSelected.includes(item.id);
              return (
                <label
                  key={item.id}
                  onClick={() => toggleOption(item.id)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/70 cursor-pointer text-xs select-none transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'border-slate-700 bg-slate-900/60'
                    }`}>
                      {isChecked && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className={isChecked ? 'text-white font-medium' : 'text-slate-300'}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                    {item.count}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
