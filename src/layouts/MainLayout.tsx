import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, CheckSquare, Archive, Settings, Menu } from 'lucide-react';
import { ErrorBoundary } from '../components/system/ErrorBoundary';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isHome = location.pathname === '/';

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Task', href: '/tasks', icon: CheckSquare },
    { name: 'Archive', href: '/archive', icon: Archive },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Vanilla-style Rounded Sidebar (Slide-in on Mobile, Static on Desktop) */}
      <aside className={`
        fixed lg:static top-0 left-0 z-50
        w-[240px] bg-sidebar 
        rounded-r-[20px] lg:rounded-[20px] 
        m-0 lg:m-4 
        shadow-[0_0_40px_rgba(0,0,0,0.3)] lg:shadow-velmora 
        flex flex-col p-6 shrink-0 
        h-full lg:h-[calc(100vh-2rem)] 
        border-r lg:border border-border/10
        transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        
        {/* Back Button Space (always takes up space to prevent layout shift) */}
        <div className="h-10 mb-6 flex justify-between items-center">
          {!isHome ? (
            <button 
              onClick={() => {
                navigate(-1);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 bg-slate-200 dark:bg-slate-800 text-main px-3.5 py-2 rounded-xl text-sm font-medium transition-colors hover:brightness-95 dark:hover:brightness-110 w-fit"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <div /> // Spacer
          )}
        </div>

        {/* Brand */}
        <div className="flex items-center gap-3 px-2 pb-5 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span className="text-lg font-bold text-main tracking-tight">Velmora</span>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              // Exact match for Home (/), otherwise startsWith for nested routes
              const isActive = item.href === '/' 
                ? location.pathname === '/' 
                : location.pathname.startsWith(item.href);
              
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[15px] font-medium transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary to-[#9FA8FF] text-white shadow-lg shadow-primary/30' 
                      : 'text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-main'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-white' : ''} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile and Theme Toggle */}
        <div className="mt-auto px-2 pt-4 border-t border-border/10">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
               A
             </div>
             <div className="min-w-0 flex-1">
               <div className="text-sm font-semibold text-main truncate">Admin</div>
               <div className="text-xs text-muted truncate">Workspace</div>
             </div>
             <div className="shrink-0 ml-auto">
               <ThemeToggle />
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="lg:hidden p-4 border-b border-border bg-card flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-muted hover:text-main rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-main tracking-tight">Velmora</h1>
          </div>
          {!isHome && (
            <button onClick={() => navigate(-1)} className="text-muted hover:text-main p-2 -mr-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
