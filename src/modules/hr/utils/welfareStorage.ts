import { Employee } from '../types/hrms';
import {
  WelfareProduct,
  WelfareSelection,
  WelfareActivityLog,
  WelfareSelectionStatus,
  WELFARE_PRODUCT_NAMES,
  getMonthName,
} from '../types/welfare';
import { safeGetItem, safeSetItem } from './storage';

export const WELFARE_STORAGE_KEYS = {
  PRODUCTS: 'hrms_welfare_products_v1',
  SELECTIONS: 'hrms_welfare_selections_v1',
  LOGS: 'hrms_welfare_activity_logs_v1',
};

export const WELFARE_ORGANIZATION_ID = 'org-default';
export const WELFARE_SYNC_EVENT = 'hrms-welfare-storage-sync';

export function emitWelfareSync(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WELFARE_SYNC_EVENT));
  }
}

export function initializeWelfareProducts(): WelfareProduct[] {
  const saved = safeGetItem(WELFARE_STORAGE_KEYS.PRODUCTS);
  const nowIso = new Date().toISOString();
  let existingList: WelfareProduct[] = [];

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        existingList = parsed;
      }
    } catch {
      existingList = [];
    }
  }

  // Ensure the exact 10 products exist without duplicates
  const byName = new Map<string, WelfareProduct>();
  existingList.forEach((p) => {
    if (p && p.product_name) {
      const key = p.product_name.trim().toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, p);
      }
    }
  });

  const catalog: WelfareProduct[] = WELFARE_PRODUCT_NAMES.map((name, idx) => {
    const existing = byName.get(name.toLowerCase());
    if (existing) {
      return {
        ...existing,
        product_name: name,
        is_active: existing.is_active !== false,
      };
    }
    return {
      id: `welfare-prod-${idx + 1}`,
      product_name: name,
      product_image_path: '',
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  safeSetItem(WELFARE_STORAGE_KEYS.PRODUCTS, JSON.stringify(catalog));
  return catalog;
}

export function loadWelfareSelections(): WelfareSelection[] {
  const saved = safeGetItem(WELFARE_STORAGE_KEYS.SELECTIONS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  return [];
}

export function saveWelfareSelections(selections: WelfareSelection[]): void {
  safeSetItem(WELFARE_STORAGE_KEYS.SELECTIONS, JSON.stringify(selections));
  emitWelfareSync();
}

export function loadWelfareLogs(): WelfareActivityLog[] {
  const saved = safeGetItem(WELFARE_STORAGE_KEYS.LOGS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  return [];
}

export function saveWelfareLogs(logs: WelfareActivityLog[]): void {
  safeSetItem(WELFARE_STORAGE_KEYS.LOGS, JSON.stringify(logs));
  emitWelfareSync();
}

export function doesSelectionMatchEmployee(sel: WelfareSelection, emp: Employee): boolean {
  if (!sel || !emp) return false;
  if (
    sel.employee_name &&
    emp.fullName &&
    sel.employee_name.trim().toLowerCase() !== emp.fullName.trim().toLowerCase()
  ) {
    return false;
  }
  if (
    sel.employee_id &&
    emp.id &&
    sel.employee_id.trim().toUpperCase() === emp.id.trim().toUpperCase()
  ) {
    return true;
  }
  if (
    sel.employee_code &&
    emp.employeeCode &&
    sel.employee_code.trim().toUpperCase() === emp.employeeCode.trim().toUpperCase()
  ) {
    return true;
  }
  if (
    sel.employee_id &&
    emp.employeeCode &&
    sel.employee_id.trim().toUpperCase() === emp.employeeCode.trim().toUpperCase()
  ) {
    return true;
  }
  return false;
}

export function getStatusBadgeConfig(status: WelfareSelectionStatus): {
  label: string;
  classes: string;
  dotColor: string;
} {
  switch (status) {
    case 'not_selected':
      return {
        label: 'Not Selected',
        classes: 'bg-slate-100 text-slate-600 border-slate-200',
        dotColor: 'bg-slate-400',
      };
    case 'selected':
      return {
        label: 'Selected',
        classes: 'bg-blue-50 text-[#206DA6] border-blue-200',
        dotColor: 'bg-[#206DA6]',
      };
    case 'prepared':
      return {
        label: 'Prepared',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        dotColor: 'bg-amber-500',
      };
    case 'distributed':
      return {
        label: 'Distributed',
        classes: 'bg-purple-50 text-purple-700 border-purple-200',
        dotColor: 'bg-purple-600',
      };
    case 'received':
      return {
        label: 'Received',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        dotColor: 'bg-rose-500',
      };
  }
}

/**
 * Atomic transaction-like helper that validates and saves an employee's monthly welfare selection
 * in the shared local database, enforcing the strict one-product-per-employee-per-month constraint.
 */
export function submitMonthlyWelfareSelection(params: {
  employee: Employee;
  actorUserId: string;
  actorName: string;
  productId: string;
  year: number;
  month: number;
}):
  | { ok: true; selection: WelfareSelection; product: WelfareProduct }
  | { ok: false; error: string; existingSelection?: WelfareSelection } {
  const { employee, actorUserId, actorName, productId, year, month } = params;

  if (!employee || employee.status === 'terminated') {
    return { ok: false, error: 'Employee is not eligible for monthly welfare benefits.' };
  }

  const products = initializeWelfareProducts();
  const product = products.find((p) => p.id === productId && p.is_active);
  if (!product) {
    return { ok: false, error: 'Selected product is not available in the active catalog.' };
  }

  // Always read fresh from storage to prevent cross-tab or concurrent duplicate submissions
  const currentSelections = loadWelfareSelections();
  const existingRecord = currentSelections.find(
    (s) =>
      s.organization_id === WELFARE_ORGANIZATION_ID &&
      doesSelectionMatchEmployee(s, employee) &&
      s.welfare_year === year &&
      s.welfare_month === month &&
      s.selection_status !== 'cancelled'
  );

  const monthYearLabel = `${getMonthName(month)} ${year}`;

  if (existingRecord) {
    return {
      ok: false,
      error: `You have already selected ${existingRecord.product_name} for ${monthYearLabel}. You can choose a new product next month.`,
      existingSelection: existingRecord,
    };
  }

  const nowIso = new Date().toISOString();
  const newSelection: WelfareSelection = {
    id: `wsel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    organization_id: WELFARE_ORGANIZATION_ID,
    employee_id: employee.id,
    employee_code: employee.employeeCode,
    employee_name: employee.fullName,
    department_id: employee.departmentId,
    department_name: employee.departmentName,
    product_id: product.id,
    product_name: product.product_name,
    welfare_year: year,
    welfare_month: month,
    selection_status: 'selected',
    selected_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const updatedSelections = [newSelection, ...currentSelections];
  saveWelfareSelections(updatedSelections);

  const currentLogs = loadWelfareLogs();
  const logEntry: WelfareActivityLog = {
    id: `wlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    welfare_selection_id: newSelection.id,
    actor_user_id: actorUserId,
    actor_name: actorName,
    action: 'selected',
    old_values: null,
    new_values: {
      product_id: product.id,
      product_name: product.product_name,
      welfare_month: month,
      welfare_year: year,
      selection_status: 'selected',
    },
    created_at: nowIso,
  };
  saveWelfareLogs([logEntry, ...currentLogs]);

  return { ok: true, selection: newSelection, product };
}

/**
 * Confirms personal receipt of a distributed welfare product for the authenticated employee.
 */
export function confirmMonthlyWelfareReceived(params: {
  selectionId: string;
  employee: Employee;
  actorUserId: string;
  actorName: string;
}): { ok: true; selection: WelfareSelection } | { ok: false; error: string } {
  const { selectionId, employee, actorUserId, actorName } = params;
  const currentSelections = loadWelfareSelections();
  const target = currentSelections.find((s) => s.id === selectionId);

  if (!target) {
    return { ok: false, error: 'Welfare selection record not found.' };
  }
  if (!doesSelectionMatchEmployee(target, employee)) {
    return { ok: false, error: 'You can only confirm receipt for your own welfare product.' };
  }
  if (target.selection_status !== 'distributed') {
    return {
      ok: false,
      error: 'Product must be distributed by HR before confirming receipt.',
    };
  }

  const nowIso = new Date().toISOString();
  const updated: WelfareSelection = {
    ...target,
    selection_status: 'received',
    received_at: nowIso,
    received_by: `${employee.fullName} (${employee.employeeCode})`,
    received_by_admin_override: false,
    updated_at: nowIso,
  };

  const updatedList = currentSelections.map((s) => (s.id === selectionId ? updated : s));
  saveWelfareSelections(updatedList);

  const currentLogs = loadWelfareLogs();
  const logEntry: WelfareActivityLog = {
    id: `wlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    welfare_selection_id: updated.id,
    actor_user_id: actorUserId,
    actor_name: actorName,
    action: 'confirmed_received',
    old_values: { selection_status: target.selection_status },
    new_values: {
      selection_status: 'received',
      received_at: nowIso,
      received_by: updated.received_by,
    },
    created_at: nowIso,
  };
  saveWelfareLogs([logEntry, ...currentLogs]);

  return { ok: true, selection: updated };
}
