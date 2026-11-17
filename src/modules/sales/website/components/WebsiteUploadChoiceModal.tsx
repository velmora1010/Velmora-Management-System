import React from 'react';
import { ShoppingBag, Truck, X, ArrowRight, UploadCloud, Layers, Package, Send, Mail } from 'lucide-react';

interface WebsiteUploadChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseShopify: () => void;
  onChooseDelhivery: () => void;
  onChooseAmazonShipping: () => void;
  onChooseSTCourier: () => void;
  onChooseIndiaPost: () => void;
}

export const WebsiteUploadChoiceModal: React.FC<WebsiteUploadChoiceModalProps> = ({
  isOpen,
  onClose,
  onChooseShopify,
  onChooseDelhivery,
  onChooseAmazonShipping,
  onChooseSTCourier,
  onChooseIndiaPost
}) => {
  if (!isOpen) return null;

  const uploadOptions = [
    {
      id: 'shopify',
      title: 'Shopify Upload',
      description: 'Import Shopify standard orders export spreadsheets (CSV/XLSX). Consolidates line items, customers, pricing, and syncs directly into Logistics.',
      actionText: 'Open Shopify Uploader',
      badge: 'Active',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: <ShoppingBag size={24} />,
      iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      hoverBorder: 'hover:border-purple-500/50 hover:shadow-purple-500/10',
      actionColor: 'text-purple-400 group-hover:text-purple-300',
      onClick: () => {
        onClose();
        onChooseShopify();
      }
    },
    {
      id: 'delhivery',
      title: 'Delhivery One Upload',
      description: 'Import carrier dispatch manifests, waybill tracking numbers, and delivery scan reports directly from Delhivery One portal.',
      actionText: 'Open Delhivery Uploader',
      badge: 'Active',
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      icon: <Truck size={24} />,
      iconBg: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
      hoverBorder: 'hover:border-orange-500/50 hover:shadow-orange-500/10',
      actionColor: 'text-orange-400 group-hover:text-orange-300',
      onClick: () => {
        onClose();
        onChooseDelhivery();
      }
    },
    {
      id: 'amazon_shipping',
      title: 'Amazon Shipping Upload',
      description: 'Import Amazon multi-channel logistics manifests, waybill assignments, and scan reports (CSV). Automatically separates Amazon Shipping & Ekart.',
      actionText: 'Open Amazon Shipping Uploader',
      badge: 'Active',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: <Package size={24} />,
      iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      hoverBorder: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
      actionColor: 'text-amber-400 group-hover:text-amber-300',
      onClick: () => {
        onClose();
        onChooseAmazonShipping();
      }
    },
    {
      id: 'st_courier',
      title: 'ST Courier Upload',
      description: 'Import ST Courier delivery performance reports, consignment numbers, and dispatch records (Excel/CSV) with flexible column mapping.',
      actionText: 'Open ST Courier Uploader',
      badge: 'Active',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: <Send size={24} />,
      iconBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
      hoverBorder: 'hover:border-cyan-500/50 hover:shadow-cyan-500/10',
      actionColor: 'text-cyan-400 group-hover:text-cyan-300',
      onClick: () => {
        onClose();
        onChooseSTCourier();
      }
    },
    {
      id: 'india_post',
      title: 'India Post Upload',
      description: 'Import India Post Speed Post consignment manifests, article tracking registers, and delivery reports (Excel/CSV).',
      actionText: 'Open India Post Uploader',
      badge: 'Active',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      icon: <Mail size={24} />,
      iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      hoverBorder: 'hover:border-rose-500/50 hover:shadow-rose-500/10',
      actionColor: 'text-rose-400 group-hover:text-rose-300',
      onClick: () => {
        onClose();
        onChooseIndiaPost();
      }
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 text-white relative animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-800/80 shrink-0">
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

        {/* Five Choices Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-6 overflow-y-auto flex-1 custom-scrollbar">
          {uploadOptions.map(opt => (
            <div
              key={opt.id}
              onClick={opt.onClick}
              className={`group relative p-5 rounded-2xl bg-slate-950/70 border border-slate-800 ${opt.hoverBorder} hover:bg-slate-800/40 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-lg active:scale-[0.98]`}
            >
              <div className="space-y-3.5">
                <div className={`w-12 h-12 rounded-xl ${opt.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}>
                  {opt.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-purple-200 transition-colors">
                      {opt.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-3">
                    {opt.description}
                  </p>
                </div>
              </div>

              <div className={`mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold ${opt.actionColor}`}>
                <span>{opt.actionText}</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-400" />
            <span>5 dedicated import workflows supported. Enriches existing orders with zero duplication.</span>
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
