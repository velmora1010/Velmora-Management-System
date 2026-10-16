import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  ArrowDownLeft,
  ShoppingCart,
  History,
  BarChart3
} from 'lucide-react';

export const FinanceManagementLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const primaryNav = [
    { name: 'Overview', path: '/finance/management/overview', icon: LayoutDashboard },
    { name: 'Bills', path: '/finance/management/bills', icon: Receipt },
    { name: 'Expense', path: '/finance/management/expense', icon: CreditCard },
    { name: 'Credit', path: '/finance/management/credit', icon: ArrowDownLeft },
    { name: 'Purchase Order', path: '/finance/management/purchase-order', icon: ShoppingCart },
    { name: 'PO History', path: '/finance/management/po-history', icon: History },
    { name: 'Analytics', path: '/finance/management/analytics', icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto fade-in">
      {/* Top Bar matching Campaign Management UI */}
      <div className="flex flex-col items-start gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Finance Management</h2>

        {/* Primary Nav (Horizontal Tabs) */}
        <div className="flex flex-wrap gap-2">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isOverview = item.name === 'Overview' && (
              location.pathname === '/finance/management' ||
              location.pathname === '/finance/management/' ||
              location.pathname.startsWith('/finance/management/overview')
            );
            const isActive = isOverview || (item.name !== 'Overview' && location.pathname.startsWith(item.path));

            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold'
                    : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area where Sub-tabs render */}
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>
    </div>
  );
};
