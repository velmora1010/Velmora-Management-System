import React from 'react';
import { ShoppingBag, Truck, X, ArrowRight, UploadCloud, Package, Send, Mail } from 'lucide-react';

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
      badge: 'Active',
      badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      icon: <ShoppingBag size={20} />,
      iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      hoverBorder: 'hover:border-purple-500/50 hover:bg-slate-800/40',
      actionColor: 'text-purple-400 group-hover:text-purple-300',
      onClick: () => {
        onClose();
        onChooseShopify();
      }
    },
    {
      id: 'delhivery',
      title: 'Delhivery One',
      badge: 'Active',
      badgeColor: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
      icon: <Truck size={20} />,
      iconBg: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
      hoverBorder: 'hover:border-orange-500/50 hover:bg-slate-800/40',
      actionColor: 'text-orange-400 group-hover:text-orange-300',
      onClick: () => {
        onClose();
        onChooseDelhivery();
      }
    },
    {
      id: 'amazon_shipping',
      title: 'Amazon Shipping',
      badge: 'Active',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: <Package size={20} />,
      iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      hoverBorder: 'hover:border-amber-500/50 hover:bg-slate-800/40',
      actionColor: 'text-amber-400 group-hover:text-amber-300',
      onClick: () => {
        onClose();
        onChooseAmazonShipping();
      }
    },
    {
      id: 'st_courier',
      title: 'ST Courier',
      badge: 'Active',
      badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      icon: <Send size={20} />,
      iconBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
      hoverBorder: 'hover:border-cyan-500/50 hover:bg-slate-800/40',
      actionColor: 'text-cyan-400 group-hover:text-cyan-300',
      onClick: () => {
        onClose();
        onChooseSTCourier();
      }
    },
    {
      id: 'india_post',
      title: 'India Post',
      badge: 'Active',
      badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      icon: <Mail size={20} />,
      iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      hoverBorder: 'hover:border-rose-500/50 hover:bg-slate-800/40',
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
        className="w-full max-w-xl sm:max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-4 sm:p-5 text-white relative animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <UploadCloud size={17} />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Select Upload Format
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Five Choices Grid Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 py-4">
          {uploadOptions.map(opt => (
            <div
              key={opt.id}
              onClick={opt.onClick}
              className={`group relative p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 ${opt.hoverBorder} transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 shadow-sm hover:shadow-md active:scale-[0.98]`}
            >
              {/* Top row: Carrier Icon and ACTIVE indicator */}
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-lg ${opt.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform duration-150`}>
                  {opt.icon}
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border leading-none ${opt.badgeColor}`}>
                  {opt.badge}
                </span>
              </div>

              {/* Bottom row: Upload option name and Selection arrow */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-slate-100 transition-colors truncate">
                  {opt.title}
                </h3>
                <ArrowRight size={14} className={`${opt.actionColor} group-hover:translate-x-0.5 transition-transform shrink-0`} />
              </div>
            </div>
          ))}
        </div>

        {/* Compact Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
