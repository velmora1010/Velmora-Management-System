import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, CheckSquare, Archive, Settings, Menu, LogOut, Activity, UserCheck } from 'lucide-react';
import { ErrorBoundary } from '../components/system/ErrorBoundary';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { AiAssistantPanel } from '../components/ai/AiAssistantPanel';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getNavigationState, saveNavigationState, saveDepartmentNavigation } from '../utils/navigationPersistence';
import toast from 'react-hot-toast';

const SWITCHABLE_ACCOUNTS = [
  'admin@velmora.com',
  'admin@velmora1.com',
  'admin@velmora2.com',
  'admin@velmora3.com',
];

export const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  // Switch User Modal states
  const [isSwitchUserOpen, setIsSwitchUserOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    const path = location.pathname;
    const firstSegment = path.split('/')[1];
    if (firstSegment && firstSegment !== 'login' && firstSegment !== 'archive' && firstSegment !== 'settings' && path !== '/') {
      let deptName = firstSegment;
      if (firstSegment === 'tickets') {
        deptName = 'customer-tickets';
      }
      saveDepartmentNavigation(deptName, path);
    }
  }, [location.pathname]);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSwitchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !switchPassword) return;

    setIsSwitching(true);
    setSwitchError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: selectedAccount.trim().toLowerCase(),
        password: switchPassword,
      });

      if (error) {
        setSwitchError(error.message || 'Invalid login credentials');
        toast.error(error.message || 'Invalid password');
      } else {
        toast.success(`Switched account to ${selectedAccount}`);
        setIsSwitchUserOpen(false);
        setSwitchPassword('');
        setSelectedAccount('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to switch user';
      setSwitchError(msg);
      toast.error(msg);
    } finally {
      setIsSwitching(false);
    }
  };
  
  const isHome = location.pathname === '/';
  const isAdmin = user?.email === 'admin@velmora.com';

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Task', href: '/tasks', icon: CheckSquare },
    ...(isAdmin ? [{ name: 'Activity', href: '/activity-history', icon: Activity }] : []),
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
        <div className="flex items-center gap-3 px-2 pb-5 mb-4 border-b border-border/10">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-bold text-main tracking-tight leading-none mb-1">Velmora</span>
            <span className="text-[11px] text-primary font-semibold truncate">{user?.email || 'admin@velmora.com'}</span>
          </div>
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
                <div key={item.name} className="flex flex-col w-full">
                  <div className="flex items-center w-full">
                    <Link
                      to={item.href}
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        if (item.href === '/') {
                          const navState = getNavigationState();
                          navState.lastActiveDepartment = null;
                          saveNavigationState(navState);
                        }
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[15px] font-medium transition-all ${
                        isActive 
                          ? 'bg-gradient-to-r from-primary to-[#9FA8FF] text-white shadow-lg shadow-primary/30' 
                          : 'text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-main'
                      }`}
                    >
                      <Icon size={20} className={isActive ? 'text-white' : ''} />
                      <span className="flex-1">{item.name}</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Profile and Controls */}
        <div className="mt-auto pt-4 pb-2 border-t border-border/10">
          
          {/* Row 1: Avatar + Full Email & Role (Clickable to switch user) */}
          <div 
            onClick={() => {
              setSelectedAccount(user?.email || 'admin@velmora.com');
              setIsSwitchUserOpen(true);
            }}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors group mb-2"
            title="Click to Switch User"
          >
            <div className="w-9 h-9 rounded-full bg-primary/20 group-hover:bg-primary/30 text-primary font-bold text-sm flex items-center justify-center shrink-0 uppercase transition-colors border border-primary/30">
              {user?.email?.charAt(0) || 'A'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-main group-hover:text-primary transition-colors leading-tight break-all">
                {user?.email || 'admin@velmora.com'}
              </div>
              <div className="text-[11px] text-muted font-medium mt-0.5">
                {user?.email === 'admin@velmora.com' ? 'Main Admin' : 'User'}
              </div>
            </div>
          </div>

          {/* Row 2: Action Controls (Switch Button, Notification, Logout, Theme) */}
          <div className="flex items-center justify-between px-1 pt-2 border-t border-border/10">
            <button 
              onClick={() => {
                setSelectedAccount(user?.email || 'admin@velmora.com');
                setIsSwitchUserOpen(true);
              }} 
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted hover:text-primary transition-colors rounded-lg hover:bg-primary/10 font-medium" 
              title="Switch User Account"
            >
              <UserCheck size={14} />
              <span>Switch</span>
            </button>

            <div className="flex items-center gap-1">
              <NotificationCenter />
              <button 
                onClick={handleLogout} 
                className="p-1.5 text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10" 
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
              <ThemeToggle />
            </div>
          </div>

        </div>
      </aside>

      {/* Switch User Modal */}
      {isSwitchUserOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 text-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Switch User Account</h3>
                  <p className="text-xs text-slate-400">Current: <span className="text-purple-300 font-semibold">{user?.email}</span></p>
                </div>
              </div>
              <button 
                onClick={() => { setIsSwitchUserOpen(false); setSwitchPassword(''); setSwitchError(null); }}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSwitchUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Select Account</label>
                <div className="space-y-2">
                  {SWITCHABLE_ACCOUNTS.map(accEmail => {
                    const isCurrent = user?.email === accEmail;
                    const isSelected = selectedAccount === accEmail;
                    return (
                      <div
                        key={accEmail}
                        onClick={() => {
                          setSelectedAccount(accEmail);
                          setSwitchError(null);
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-950/40 border-purple-500 text-white shadow-md'
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-purple-400 bg-purple-500' : 'border-slate-600'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm font-medium">{accEmail}</span>
                        </div>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                            Active
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedAccount && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Password for {selectedAccount}
                  </label>
                  <input
                    type="password"
                    required
                    value={switchPassword}
                    onChange={(e) => setSwitchPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block p-3 transition-colors"
                    placeholder="Enter password"
                    autoFocus
                  />
                </div>
              )}

              {switchError && (
                <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-300 text-xs">
                  ⚠️ {switchError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsSwitchUserOpen(false); setSwitchPassword(''); setSwitchError(null); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedAccount || !switchPassword || isSwitching}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSwitching ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                      Signing in...
                    </>
                  ) : (
                    'Switch Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-2">
            <NotificationCenter />
            {!isHome && (
              <button onClick={() => navigate(-1)} className="text-muted hover:text-main p-2 -mr-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <ArrowLeft size={20} />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <AiAssistantPanel />
      </div>
    </div>
  );
};
