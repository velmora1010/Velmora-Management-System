export type WelfareSelectionStatus =
  | 'not_selected'
  | 'selected'
  | 'prepared'
  | 'distributed'
  | 'received'
  | 'cancelled';

export interface WelfareProduct {
  id: string;
  product_name: string;
  product_image_path: string; // Base64 data URL uploaded by HR/Admin or ''
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WelfareSelection {
  id: string;
  organization_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_id: string;
  department_name: string;
  product_id: string;
  product_name: string;
  welfare_year: number;
  welfare_month: number; // 1 - 12
  selection_status: Exclude<WelfareSelectionStatus, 'not_selected'>;
  selected_at: string;
  prepared_at?: string;
  prepared_by?: string;
  distributed_at?: string;
  distributed_by?: string;
  received_at?: string;
  received_by?: string;
  received_by_admin_override?: boolean;
  cancelled_at?: string;
  cancelled_by?: string;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface WelfareActivityLog {
  id: string;
  welfare_selection_id: string;
  actor_user_id: string;
  actor_name: string;
  action:
    | 'selected'
    | 'changed_selection'
    | 'marked_prepared'
    | 'marked_distributed'
    | 'confirmed_received'
    | 'admin_recorded_receipt'
    | 'cancelled';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export const WELFARE_PRODUCT_NAMES: readonly string[] = [
  'Detergent',
  'Dish Wash',
  'Fabric Wash',
  'Bike Wash',
  'Car Wash',
  'Floor Cleaner',
  'Glass Cleaner',
  'Kitchen Cleaner',
  'Hand Wash',
  'Bamboo Towel',
] as const;

export const WELFARE_MONTH_NAMES: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function getMonthName(monthNumber: number): string {
  return WELFARE_MONTH_NAMES[monthNumber - 1] || 'Unknown';
}

export function getKolkataCurrentYearMonth(): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());
    const yearPart = parts.find((p) => p.type === 'year')?.value;
    const monthPart = parts.find((p) => p.type === 'month')?.value;
    const year = yearPart ? parseInt(yearPart, 10) : new Date().getFullYear();
    const month = monthPart ? parseInt(monthPart, 10) : new Date().getMonth() + 1;
    return { year, month };
  } catch {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
}

export function formatKolkataDateTime(isoString?: string): { date: string; time: string; full: string } {
  if (!isoString) return { date: '—', time: '—', full: '—' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: isoString, time: '', full: isoString };
    const dateStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
    const timeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return { date: dateStr, time: timeStr, full: `${dateStr}, ${timeStr}` };
  } catch {
    return { date: isoString, time: '', full: isoString };
  }
}
