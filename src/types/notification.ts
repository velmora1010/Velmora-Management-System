import type { AppModule } from './rbac';

export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  module: AppModule | string;
  type: NotificationType;
  record_id: string | null;
  record_type: string | null;
  route: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationFilters {
  module?: string;
  type?: NotificationType | string;
  is_read?: boolean;
  search?: string;
}

export interface PaginatedNotificationResult {
  data: AppNotification[];
  totalCount: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
