import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ListTree, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from '../components/system/ErrorBoundary';

export const FinanceLayout = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('financeSidebarCollapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('financeSidebarCollapsed', String(newState));
      return newState;
    });
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Sub-sidebar for Finance */}
      <aside 
        className={`border-r border-border bg-card hidden md:flex flex-col shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative
          ${isCollapsed ? 'w-[68px]' : 'w-56'}
        `}
      >
        <div className="p-4 border-b border-border flex items-center justify-between min-h-[57px] overflow-hidden">
          <h2 className={`text-sm font-semibold text-muted tracking-wider uppercase transition-opacity duration-300 whitespace-nowrap ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
            Finance
          </h2>
          <button 
            onClick={toggleCollapse}
            className={`p-1.5 text-muted hover:text-main bg-background rounded-lg border border-border/50 hover:border-border transition-colors z-10 flex shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          <Link
            to="/finance/management"
            title={isCollapsed ? "Finance Management" : undefined}
            className={`flex items-center px-3 py-2.5 rounded-xl transition-all text-[15px] ${
              location.pathname.startsWith('/finance/management')
                ? 'bg-primary/10 text-primary font-medium shadow-sm' 
                : 'text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-main'
            } ${isCollapsed ? 'justify-center w-11 h-11 mx-auto px-0' : 'gap-3 w-full'}`}
          >
            <Receipt size={20} className={`shrink-0 ${location.pathname.startsWith('/finance/management') ? 'text-primary' : 'text-muted'}`} />
            <span className={`whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100 block'}`}>
              Finance Management
            </span>
          </Link>
          <Link
            to="/finance/categories"
            title={isCollapsed ? "Finance Category" : undefined}
            className={`flex items-center px-3 py-2.5 rounded-xl transition-all text-[15px] ${
              location.pathname.startsWith('/finance/categories')
                ? 'bg-primary/10 text-primary font-medium shadow-sm' 
                : 'text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-main'
            } ${isCollapsed ? 'justify-center w-11 h-11 mx-auto px-0' : 'gap-3 w-full'}`}
          >
            <ListTree size={20} className={`shrink-0 ${location.pathname.startsWith('/finance/categories') ? 'text-primary' : 'text-muted'}`} />
            <span className={`whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100 block'}`}>
              Finance Category
            </span>
          </Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
