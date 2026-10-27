import React, { useState, useRef, useEffect } from 'react';
import { CreditCard, ChevronDown, Check, X } from 'lucide-react';

interface WebsitePaymentDropdownProps {
  selectedModes: string[];
  onChange: (modes: string[]) => void;
}

const PAYMENT_OPTIONS = [
  { id: 'Prepaid', label: 'Prepaid', badge: 'Full Paid', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'COD', label: 'COD', badge: 'Full COD', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'Partial COD', label: 'Partial COD', badge: 'Advance + COD', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' }
];

export const WebsitePaymentDropdown: React.FC<WebsitePaymentDropdownProps> = ({
  selectedModes,
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

  const toggleMode = (id: string) => {
    if (selectedModes.includes(id)) {
      onChange(selectedModes.filter(m => m !== id));
    } else {
      onChange([...selectedModes, id]);
    }
  };

  const isSelected = (id: string) => selectedModes.includes(id);

  const buttonLabel = 
    selectedModes.length === 0
      ? 'Payment Mode'
      : selectedModes.length === 1
      ? selectedModes[0]
      : `Payment (${selectedModes.length})`;

  const isActive = selectedModes.length > 0;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-9 px-3 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm select-none ${
          isActive
            ? 'bg-purple-950/80 border-purple-500 text-white shadow-purple-950/40'
            : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
        }`}
        title="Filter by Payment Mode"
      >
        <CreditCard size={14} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
        <span>{buttonLabel}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-[#0b1220] border border-slate-800 shadow-2xl z-50 p-2.5 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <span className="text-xs font-bold text-slate-200">Payment Mode</span>
            {selectedModes.length > 0 && (
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
            {PAYMENT_OPTIONS.map(opt => {
              const active = isSelected(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleMode(opt.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left select-none ${
                    active
                      ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      active ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 bg-slate-900'
                    }`}>
                      {active && <Check size={12} strokeWidth={3} />}
                    </div>
                    <span className="font-semibold text-slate-100">{opt.label}</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${opt.color}`}>
                    {opt.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
