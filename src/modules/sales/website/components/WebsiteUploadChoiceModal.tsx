import React from 'react';
import { ShoppingBag, Truck, X, ArrowRight, UploadCloud, Layers } from 'lucide-react';

interface WebsiteUploadChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseShopify: () => void;
  onChooseDelhivery: () => void;
}

export const WebsiteUploadChoiceModal: React.FC<WebsiteUploadChoiceModalProps> = ({
  isOpen,
  onClose,
  onChooseShopify,
  onChooseDelhivery
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 text-white relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-inner">
              <UploadCloud size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Select Upload Format / Source
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose the order file format you wish to import into Website Sales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Two Choices Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
          {/* OPTION 1: SHOPIFY UPLOAD */}
          <div
            onClick={() => {
              onClose();
              onChooseShopify();
            }}
            className="group relative p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/40 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-lg hover:shadow-purple-500/10 active:scale-[0.98]"
          >
            <div className="space-y-3.5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <ShoppingBag size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                    Shopify Upload
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider border border-purple-500/30">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Import Shopify standard orders export spreadsheets (CSV/XLSX). Consolidates line items, customers, pricing, and syncs directly into Logistics.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-purple-400 group-hover:text-purple-300">
              <span>Open Shopify Uploader</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* OPTION 2: DELHIVERY ONE UPLOAD */}
          <div
            onClick={() => {
              onClose();
              onChooseDelhivery();
            }}
            className="group relative p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-800/40 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-lg hover:shadow-orange-500/10 active:scale-[0.98]"
          >
            <div className="space-y-3.5">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <Truck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white group-hover:text-orange-300 transition-colors">
                    Delhivery One Upload
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold uppercase tracking-wider border border-orange-500/30">
                    Config Later
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Import carrier dispatch manifests, waybill records, and delivery scan reports directly from Delhivery One logistics portal.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-orange-400 group-hover:text-orange-300">
              <span>Select Delhivery One</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-400" />
            <span>Multiple formats supported without cross-contamination.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
