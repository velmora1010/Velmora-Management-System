import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Ticket, ListTodo, CheckCircle2, LayoutDashboard, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from '../components/system/ErrorBoundary';

export const CustomerTicketsLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [openCount, setOpenCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);

  const fetchCounts = async () => {
    try {
      const { count: open } = await supabase
        .from('customer_tickets')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'Resolved');

      const { count: resolved } = await supabase
        .from('customer_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Resolved');

      setOpenCount(open || 0);
      setResolvedCount(resolved || 0);
    } catch (err) {
      console.error('Failed to fetch ticket counts from Supabase:', err);
    }
  };

  useEffect(() => {
    fetchCounts();

    // Subscribe to changes on customer_tickets table to update counts in real time
    const channel = supabase
      .channel('customer-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_tickets',
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/tickets/dashboard', icon: LayoutDashboard },
    { 
      name: 'Open Tickets', 
      href: '/tickets/open', 
      icon: ListTodo, 
      count: openCount, 
      badgeColor: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
    },
    { 
      name: 'Resolved Tickets', 
      href: '/tickets/resolved', 
      icon: CheckCircle2, 
      count: resolvedCount, 
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden animate-in fade-in duration-300">
      {/* Top Header & Navigation Bar */}
      <header className="bg-card border-b border-border px-4 md:px-6 pt-4 pb-2 shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
              <Ticket size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Tickets
              </h1>
              <p className="text-xs text-muted">Manage and track all customer tickets</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border/70 text-muted hover:text-white hover:border-border transition-colors text-sm font-medium"
            title="Go Back Home"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pt-1">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500 shadow-sm font-semibold'
                    : 'text-muted border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-rose-400' : 'text-muted'} />
                <span>{item.name}</span>
                {item.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.badgeColor}`}>
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
};
