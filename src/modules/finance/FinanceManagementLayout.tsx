import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export const FinanceManagementLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const primaryNav = [
    { name: 'Bills', path: '/finance/management/bills' },
    { name: 'Expense', path: '/finance/management/expense' },
    { name: 'Purchase Order', path: '/finance/management/purchase-order' },
    { name: 'PO History', path: '/finance/management/po-history' },
    { name: 'Bank Account', path: '/finance/management/bank-account' },
    { name: 'Analytics', path: '/finance/management/analytics' },
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto fade-in">
      {/* Top Bar matching Vanilla UI */}
      <div className="flex flex-col items-start gap-4 mb-6">
        <h2 className="text-2xl font-bold text-main tracking-tight">Finance Management</h2>
        
        {/* Primary Nav (Horizontal Tabs) */}
        <div className="flex flex-wrap gap-2.5">
          {primaryNav.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            
            // In Vanilla, active tabs use btn-primary and inactive use btn-secondary.
            // btn-primary: primary background, white text.
            // btn-secondary: background border, main text.
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110' 
                    : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {item.name}
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
