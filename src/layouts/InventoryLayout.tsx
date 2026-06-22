import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Factory, Database, Barcode, Layers, Settings, CheckSquare } from 'lucide-react';
import { ErrorBoundary } from '../components/system/ErrorBoundary';

export const InventoryLayout = () => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/inventory/dashboard', icon: LayoutDashboard },
    { name: 'Raw Material', href: '/inventory/raw-material', icon: Package },
    { name: 'Product', href: '/inventory/production', icon: Factory },
    { name: 'Combos', href: '/inventory/combos', icon: Layers },
    { name: 'Inventory Room', href: '/inventory/inventory-room', icon: Database },
    { name: 'View Barcode', href: '/inventory/view-barcode', icon: Barcode },
    { name: 'Quality Check', href: '/inventory/quality-check', icon: CheckSquare },
    { name: 'System', href: '/inventory/system', icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-[100vh] w-full overflow-x-hidden">
      {/* Top horizontal navigation */}
      <div 
        style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 100, 
          background: 'rgba(15, 23, 42, 0.85)', 
          backdropFilter: 'blur(12px)', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
        }}
        className="w-full shrink-0 mb-6"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-medium text-sm transition-all border ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                      : 'bg-black/20 border-border text-gray-400 hover:text-white hover:border-gray-600 hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} className={`transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

        </div>
      </div>

      <div className="flex-1 flex flex-col w-full">
        <div className="max-w-7xl mx-auto w-full h-full">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};
