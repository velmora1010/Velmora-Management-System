import React from 'react';
import { Truck, X, Info, Clock, AlertCircle } from 'lucide-react';

interface DelhiveryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DelhiveryUploadModal: React.FC<DelhiveryUploadModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-white relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
              <Truck size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Delhivery One Upload</h2>
              <p className="text-xs text-slate-400">Logistics manifests & dispatch file importer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Clock size={32} className="animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">
              Upload format configuration will be added later.
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              The Delhivery One parser and data ingestion pipeline are currently reserved. Dedicated format templates, courier tracking column mappings, and auto-sync will be configured in a subsequent update.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-left flex items-start gap-3 text-xs text-slate-400">
            <Info size={16} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-slate-300 font-semibold">Strict Data Separation</p>
              <p className="text-[11px] text-slate-400 leading-normal">
                Files selected here will not be routed through the Shopify order parser, ensuring your order financials and item mappings remain clean and accurate.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
