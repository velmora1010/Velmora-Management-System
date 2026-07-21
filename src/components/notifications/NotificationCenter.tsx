import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { notificationService } from '../../services/notificationService';
import type { AppNotification, NotificationFilters, NotificationType } from '../../types/notification';
import { ALL_MODULES } from '../../config/rbacDefaults';
import { Bell, Check, CheckCheck, Trash2, Search, X, ChevronLeft, ChevronRight, ExternalLink, Info, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch Unread Count
  const loadUnreadCount = useCallback(async () => {
    const count = await notificationService.getUnreadCount(user?.id || null);
    setUnreadCount(count);
  }, [user]);

  // Fetch Paginated Notifications
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: NotificationFilters = {
        search: search.trim() || undefined,
        module: selectedModule || undefined,
        type: selectedType || undefined,
      };

      const result = await notificationService.getNotifications(user?.id || null, filters, page, 10);
      setNotifications(result.data);
      setTotalPages(result.totalPages);
      await loadUnreadCount();
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, search, selectedModule, selectedType, page, loadUnreadCount]);

  useEffect(() => {
    loadUnreadCount();
    const unsubscribe = notificationService.subscribeToNotifications(user?.id || null, (newNotif) => {
      setUnreadCount(prev => prev + 1);
      toast((t) => (
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Bell size={16} className="text-indigo-400 animate-bounce" />
          <div>
            <div className="font-bold text-main">{newNotif.title}</div>
            <div className="text-muted text-[11px] font-normal">{newNotif.message}</div>
          </div>
        </div>
      ), { duration: 4000 });
    });
    return () => unsubscribe();
  }, [user, loadUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await notificationService.markAsRead(id);
    if (success) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(prev - 1, 0));
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await notificationService.markAllAsRead(user?.id || null);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await notificationService.deleteNotification(id);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      loadUnreadCount();
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.is_read) {
      notificationService.markAsRead(notif.id);
      setUnreadCount(prev => Math.max(prev - 1, 0));
    }
    if (notif.route) {
      setIsOpen(false);
      navigate(notif.route);
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={16} className="text-emerald-400" />;
      case 'warning': return <AlertTriangle size={16} className="text-amber-400" />;
      case 'error': return <AlertCircle size={16} className="text-rose-400" />;
      default: return <Info size={16} className="text-blue-400" />;
    }
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative p-2 text-muted hover:text-main rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Interactive Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
          
          {/* Popover Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-900/60">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-indigo-400" />
              <h3 className="font-bold text-sm text-main">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1.5 text-xs text-indigo-400 hover:text-indigo-300 rounded-lg hover:bg-indigo-500/10 transition-colors flex items-center gap-1 font-medium"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                onClick={loadNotifications}
                className="p-1.5 text-muted hover:text-main rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-muted hover:text-main rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-slate-900/40 border-b border-border space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search notifications..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-main focus:outline-none focus:border-indigo-500"
              />
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>

            <div className="flex gap-2">
              <select
                value={selectedModule}
                onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
                className="w-1/2 bg-slate-900 border border-slate-700 text-main rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-indigo-500 capitalize"
              >
                <option value="">All Modules</option>
                {ALL_MODULES.map(m => (
                  <option key={m} value={m}>{m.replace('_', ' ')}</option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
                className="w-1/2 bg-slate-900 border border-slate-700 text-main rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-indigo-500 capitalize"
              >
                <option value="">All Types</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40 custom-scrollbar max-h-[350px]">
            {isLoading ? (
              <div className="flex justify-center items-center py-12 text-muted text-xs gap-2">
                <RefreshCw className="animate-spin" size={16} />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted space-y-1">
                <Bell size={24} className="mx-auto opacity-30" />
                <p className="text-xs font-medium">No notifications found.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                    notif.is_read ? 'opacity-70 bg-transparent hover:bg-slate-800/30' : 'bg-indigo-500/5 hover:bg-indigo-500/10'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {getTypeIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-xs text-main truncate leading-tight">
                        {notif.title}
                      </div>
                      <span className="text-[10px] text-muted shrink-0 font-mono">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span className="capitalize text-indigo-400/80 font-medium">
                        {String(notif.module).replace('_', ' ')}
                      </span>
                      {notif.route && (
                        <span className="flex items-center gap-0.5 text-muted group-hover:text-indigo-400 transition-colors">
                          Open <ExternalLink size={10} />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notif.is_read && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Mark as read"
                      >
                        <Check size={12} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-t border-border text-[11px] text-muted">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="p-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  className="p-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
