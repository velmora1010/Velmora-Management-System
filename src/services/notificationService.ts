import { supabase } from '../lib/supabase';
import { NOTIFICATION_TYPES, type NotificationType, type AppNotification, type NotificationFilters, type PaginatedNotificationResult } from '../types/notification';
import type { AppModule } from '../types/rbac';

interface CreateNotificationParams {
  userId?: string | null;
  title: string;
  message: string;
  module: AppModule | string;
  type?: NotificationType;
  recordId?: string | null;
  recordType?: string | null;
  route?: string | null;
}

// In-Memory Deduplication map to prevent repeated notifications for the same record in a 10s window
const recentNotificationCache = new Map<string, number>();

export const notificationService = {
  // Low-level Non-Blocking Notification Creation
  createNotification(params: CreateNotificationParams): void {
    const performCreate = async () => {
      try {
        const type = params.type || NOTIFICATION_TYPES.INFO;
        const dedupKey = `${params.userId || 'system'}:${params.module}:${params.recordId || ''}:${type}:${params.title}`;
        const now = Date.now();

        // 10 second deduplication check
        if (recentNotificationCache.has(dedupKey)) {
          const lastTime = recentNotificationCache.get(dedupKey)!;
          if (now - lastTime < 10000) {
            return; // Skip duplicate notification
          }
        }
        recentNotificationCache.set(dedupKey, now);

        const payload = {
          user_id: params.userId || null,
          title: params.title,
          message: params.message,
          module: params.module,
          type,
          record_id: params.recordId ? String(params.recordId) : null,
          record_type: params.recordType || params.module,
          route: params.route || null,
          is_read: false,
          created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('notifications').insert([payload]);
        if (error) {
          console.warn('Notification insert failed (non-fatal):', error.message);
        }
      } catch (err) {
        console.warn('Unexpected error in notificationService.createNotification (non-fatal):', err);
      }
    };

    performCreate();
  },

  // Specialized Helper Notification Builders
  notifyTaskAssigned(userId: string, taskTitle: string, taskId: string) {
    this.createNotification({
      userId,
      title: 'New Task Assigned',
      message: `You have been assigned to task: "${taskTitle}"`,
      module: 'tasks',
      type: NOTIFICATION_TYPES.INFO,
      recordId: taskId,
      recordType: 'Task_row',
      route: '/tasks'
    });
  },

  notifyCampaignCreated(campaignName: string, campaignId: string) {
    this.createNotification({
      userId: null, // System-wide
      title: 'Campaign Created',
      message: `New marketing campaign "${campaignName}" has been initialized.`,
      module: 'marketing',
      type: NOTIFICATION_TYPES.SUCCESS,
      recordId: campaignId,
      recordType: 'influencer_create_campaigns_rows',
      route: '/marketing'
    });
  },

  notifyPOApproved(poNumber: string, poId: string) {
    this.createNotification({
      userId: null,
      title: 'Purchase Order Approved',
      message: `PO #${poNumber} was approved and is ready for dispatch.`,
      module: 'purchase_orders',
      type: NOTIFICATION_TYPES.SUCCESS,
      recordId: poId,
      recordType: 'purchase_orders_rows',
      route: '/purchase-orders'
    });
  },

  notifyLowStock(materialName: string, currentQty: number) {
    this.createNotification({
      userId: null,
      title: 'Low Stock Alert',
      message: `Raw material "${materialName}" stock is low (${currentQty} units remaining).`,
      module: 'inventory',
      type: NOTIFICATION_TYPES.WARNING,
      recordId: materialName,
      recordType: 'raw_materials',
      route: '/inventory/dashboard'
    });
  },

  notifyQCFailed(barcode: string, qcId: string) {
    this.createNotification({
      userId: null,
      title: 'QC Inspection Failed',
      message: `Inspection for barcode "${barcode}" failed Quality Control inspection.`,
      module: 'quality_control',
      type: NOTIFICATION_TYPES.ERROR,
      recordId: qcId,
      recordType: 'qc_barcodes',
      route: '/inventory/quality-check'
    });
  },

  // Server-side Paginated Notifications Query
  async getNotifications(
    userId: string | null,
    filters: NotificationFilters = {},
    page: number = 1,
    pageSize: number = 15
  ): Promise<PaginatedNotificationResult> {
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Fetch user-specific OR system-wide (null) notifications
      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      if (filters.module) {
        query = query.eq('module', filters.module);
      }
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.is_read !== undefined) {
        query = query.eq('is_read', filters.is_read);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query.range(from, to);

      if (error) {
        console.warn('Error querying notifications:', error.message);
        return { data: [], totalCount: 0, unreadCount: 0, page, pageSize, totalPages: 0 };
      }

      let records = (data || []).map((n: any) => ({
        id: n.id,
        user_id: n.user_id || null,
        title: n.title,
        message: n.message,
        module: n.module || 'system',
        type: (n.type as NotificationType) || NOTIFICATION_TYPES.INFO,
        record_id: n.record_id || null,
        record_type: n.record_type || null,
        route: n.route || null,
        is_read: Boolean(n.is_read),
        created_at: n.created_at || new Date().toISOString()
      })) as AppNotification[];

      if (filters.search && filters.search.trim() !== '') {
        const term = filters.search.toLowerCase().trim();
        records = records.filter(n =>
          n.title.toLowerCase().includes(term) ||
          n.message.toLowerCase().includes(term) ||
          String(n.module).toLowerCase().includes(term)
        );
      }

      const unreadCount = records.filter(n => !n.is_read).length;
      const total = count !== null ? count : records.length;
      const totalPages = Math.ceil(total / pageSize) || 1;

      return {
        data: records,
        totalCount: total,
        unreadCount,
        page,
        pageSize,
        totalPages
      };
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      return { data: [], totalCount: 0, unreadCount: 0, page, pageSize, totalPages: 0 };
    }
  },

  // Fast server-side Unread Count Lookup
  async getUnreadCount(userId: string | null): Promise<number> {
    try {
      let query = supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);

      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { count, error } = await query;
      if (!error && count !== null) {
        return count;
      }
    } catch (e) {
      console.warn('Error fetching unread notification count:', e);
    }
    return 0;
  },

  // Mark single notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // Mark all notifications as read
  async markAllAsRead(userId: string | null): Promise<boolean> {
    try {
      let query = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { error } = await query;
      return !error;
    } catch (e) {
      return false;
    }
  },

  // Delete single notification
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // Real-Time Subscription Support
  subscribeToNotifications(userId: string | null, onNewNotification: (notification: AppNotification) => void) {
    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload: any) => {
          const newNotif = payload.new as AppNotification;
          if (!newNotif.user_id || newNotif.user_id === userId) {
            onNewNotification(newNotif);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
