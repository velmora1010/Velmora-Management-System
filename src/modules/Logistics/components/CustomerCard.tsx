import React from 'react';
import { 
  User, 
  Phone, 
  MapPin, 
  Package, 
  IndianRupee, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck
} from 'lucide-react';
import type { UnifiedCustomer } from '../../../types/unifiedLogistics';

interface CustomerCardProps {
  customer: UnifiedCustomer;
  onViewCustomer: (customer: UnifiedCustomer) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onViewCustomer
}) => {
  // Status badge style helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Delivered':
        return {
          bg: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
          icon: <CheckCircle2 size={11} className="text-emerald-400" />
        };
      case 'In Transit':
      case 'Out for Delivery':
        return {
          bg: 'bg-sky-950/60 text-sky-300 border-sky-700/60',
          icon: <Truck size={11} className="text-sky-400" />
        };
      case 'Delivery Exception':
      case 'Failed Attempt':
      case 'RTO':
        return {
          bg: 'bg-rose-950/60 text-rose-300 border-rose-700/60',
          icon: <AlertTriangle size={11} className="text-rose-400" />
        };
      default:
        return {
          bg: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
          icon: <Clock size={11} className="text-slate-400" />
        };
    }
  };

  const badge = getStatusBadge(customer.latestStatus);

  return (
    <div 
      onClick={() => onViewCustomer(customer)}
      className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800/90 hover:border-purple-500/60 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between group"
    >
      <div>
        {/* Top Header: Name and Status Badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-300 shrink-0 group-hover:border-purple-500 transition-colors">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                {customer.name || 'Unnamed Customer'}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                <Phone size={11} className="text-slate-500 shrink-0" />
                <span className="font-mono">{customer.phoneNumber || 'No phone'}</span>
              </div>
            </div>
          </div>

          {/* Latest Status Pill */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badge.bg}`}>
            {badge.icon}
            <span className="truncate max-w-[85px]">{customer.latestStatus}</span>
          </div>
        </div>

        {/* Location Info */}
        {(customer.city || customer.state) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2 bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-slate-800/60">
            <MapPin size={12} className="text-purple-400 shrink-0" />
            <span className="truncate">
              {[customer.city, customer.state].filter(Boolean).join(', ')}
              {customer.pincode ? ` - ${customer.pincode}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Metrics Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {/* Total Orders */}
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-medium">Orders</span>
            <div className="flex items-center gap-1 font-bold text-slate-200 mt-0.5">
              <Package size={12} className="text-indigo-400" />
              <span>{customer.totalOrders}</span>
            </div>
          </div>

          {/* Lifetime Spend */}
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-medium">Lifetime Spend</span>
            <div className="flex items-center gap-0.5 font-bold text-emerald-400 mt-0.5">
              <IndianRupee size={11} />
              <span>{Math.round(customer.totalSpent).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Exceptions if any */}
          {customer.exceptionOrders > 0 && (
            <div>
              <span className="text-[10px] text-rose-400/80 block uppercase font-medium">Issues</span>
              <div className="flex items-center gap-1 font-bold text-rose-400 mt-0.5">
                <AlertTriangle size={11} />
                <span>{customer.exceptionOrders}</span>
              </div>
            </div>
          )}
        </div>

        {/* View History Button */}
        <div className="flex items-center gap-1 text-xs font-semibold text-purple-400 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all">
          <span>History</span>
          <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
};
