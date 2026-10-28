import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  HeartHandshake,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  Check,
  Upload,
  Trash2,
  Eye,
  Download,
  Search,
  Calendar,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Droplets,
  Shirt,
  Car,
  Home,
  Utensils,
  Layers,
  RefreshCw,
  FileText,
  UserCheck,
  Lock,
  XCircle,
} from 'lucide-react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Employee } from '../../../types/hrms';
import {
  WelfareProduct,
  WelfareSelection,
  WelfareActivityLog,
  WelfareSelectionStatus,
  WELFARE_PRODUCT_NAMES,
  WELFARE_MONTH_NAMES,
  getMonthName,
  getKolkataCurrentYearMonth,
  formatKolkataDateTime,
} from '../../../types/welfare';
import { findLinkedEmployee } from '../../../utils/employeeIdentity';
import { safeGetItem, safeSetItem } from '../../../utils/storage';
import {
  WELFARE_SYNC_EVENT,
  emitWelfareSync,
  submitMonthlyWelfareSelection,
} from '../../../utils/welfareStorage';
import { Avatar } from '../../common/Avatar';
import { Modal } from '../../common/Modal';

const STORAGE_KEYS = {
  PRODUCTS: 'hrms_welfare_products_v1',
  SELECTIONS: 'hrms_welfare_selections_v1',
  LOGS: 'hrms_welfare_activity_logs_v1',
};

const ORGANIZATION_ID = 'org-default';

function initializeWelfareProducts(): WelfareProduct[] {
  const saved = safeGetItem(STORAGE_KEYS.PRODUCTS);
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

  safeSetItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(catalog));
  return catalog;
}

function loadWelfareSelections(): WelfareSelection[] {
  const saved = safeGetItem(STORAGE_KEYS.SELECTIONS);
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

function loadWelfareLogs(): WelfareActivityLog[] {
  const saved = safeGetItem(STORAGE_KEYS.LOGS);
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

function doesSelectionMatchEmployee(sel: WelfareSelection, emp: Employee): boolean {
  if (!sel || !emp) return false;
  if (sel.employee_id && emp.id && sel.employee_id.trim().toUpperCase() === emp.id.trim().toUpperCase()) {
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

function getStatusBadgeConfig(status: WelfareSelectionStatus): {
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

function renderProductPlaceholderIcon(productName: string, className = 'w-10 h-10 text-[#206DA6]') {
  const lower = productName.toLowerCase();
  if (lower.includes('detergent')) return <Sparkles className={className} />;
  if (lower.includes('dish')) return <Utensils className={className} />;
  if (lower.includes('fabric')) return <Shirt className={className} />;
  if (lower.includes('bike') || lower.includes('car')) return <Car className={className} />;
  if (lower.includes('floor') || lower.includes('glass') || lower.includes('kitchen'))
    return <Home className={className} />;
  if (lower.includes('hand')) return <Droplets className={className} />;
  if (lower.includes('towel')) return <Layers className={className} />;
  return <Package className={className} />;
}

/**
 * Compresses/resizes uploaded product image so base64 storage stays fast and well within browser storage limits.
 */
function processUploadedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/webp', 0.85);
        resolve(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

type AdminTab = 'dashboard' | 'selections' | 'catalog' | 'history';
type EmployeeTab = 'choose' | 'my_selection' | 'my_history';

export const EmployeeWelfareModule: React.FC = () => {
  const { employees, departments, addNotification } = useHRMS();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const isAdminOrHR =
    currentUser.role === 'admin' ||
    currentUser.role === 'hr_manager' ||
    currentUser.role === 'dept_head';

  const currentPeriod = useMemo(() => getKolkataCurrentYearMonth(), []);

  // Persistent Welfare Tables
  const [products, setProducts] = useState<WelfareProduct[]>(() => initializeWelfareProducts());
  const [selections, setSelections] = useState<WelfareSelection[]>(() => loadWelfareSelections());
  const [activityLogs, setActivityLogs] = useState<WelfareActivityLog[]>(() => loadWelfareLogs());

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    emitWelfareSync();
  }, [products]);

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.SELECTIONS, JSON.stringify(selections));
    emitWelfareSync();
  }, [selections]);

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(activityLogs));
    emitWelfareSync();
  }, [activityLogs]);

  // Listen for updates triggered from Employee Profile -> Product Select or another tab
  useEffect(() => {
    const handleSync = () => {
      const freshProducts = initializeWelfareProducts();
      const freshSelections = loadWelfareSelections();
      const freshLogs = loadWelfareLogs();
      setProducts((prev) =>
        JSON.stringify(prev) !== JSON.stringify(freshProducts) ? freshProducts : prev
      );
      setSelections((prev) =>
        JSON.stringify(prev) !== JSON.stringify(freshSelections) ? freshSelections : prev
      );
      setActivityLogs((prev) =>
        JSON.stringify(prev) !== JSON.stringify(freshLogs) ? freshLogs : prev
      );
    };
    window.addEventListener(WELFARE_SYNC_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(WELFARE_SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Role-based Tabs
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [employeeTab, setEmployeeTab] = useState<EmployeeTab>('choose');

  // Selected Month & Year for Dashboard / Employee Selection
  const [selectedYear, setSelectedYear] = useState<number>(currentPeriod.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentPeriod.month);

  // Admin Dashboard & Selections Filters
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all');
  const [filterProductId, setFilterProductId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Admin Monthly History Filters (separate state so History can filter independently)
  const [historyYear, setHistoryYear] = useState<string>(String(currentPeriod.year));
  const [historyMonth, setHistoryMonth] = useState<string>(String(currentPeriod.month));
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string>('all');
  const [historyDepartmentId, setHistoryDepartmentId] = useState<string>('all');
  const [historyProductId, setHistoryProductId] = useState<string>('all');
  const [historyStatus, setHistoryStatus] = useState<string>('all');

  // Employee Selection State
  const authenticatedEmployee = useMemo(
    () => findLinkedEmployee(currentUser, employees),
    [currentUser, employees]
  );

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isChangingSelection, setIsChangingSelection] = useState<boolean>(false);
  const [confirmProductModalOpen, setConfirmProductModalOpen] = useState<boolean>(false);

  // Admin Modals State
  const [detailsModalData, setDetailsModalData] = useState<{
    employee: Employee;
    selection: WelfareSelection | null;
    year: number;
    month: number;
  } | null>(null);

  const [distributeConfirmTarget, setDistributeConfirmTarget] = useState<{
    employee: Employee;
    selection: WelfareSelection;
  } | null>(null);

  const [previewProduct, setPreviewProduct] = useState<WelfareProduct | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);

  // Dynamic Year Options (2024 to currentYear + 2, plus any years in stored selections)
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([
      2024,
      2025,
      2026,
      2027,
      2028,
      currentPeriod.year,
      selectedYear,
    ]);
    selections.forEach((s) => {
      if (s.welfare_year) yearSet.add(s.welfare_year);
    });
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [currentPeriod.year, selectedYear, selections]);

  // Eligible Employees (all non-terminated employees in the organization)
  const eligibleEmployees = useMemo(
    () => employees.filter((e) => e.status !== 'terminated'),
    [employees]
  );

  // Sync employee selection card highlight when employee or month/year changes
  const myCurrentMonthSelection = useMemo(() => {
    if (!authenticatedEmployee) return null;
    return (
      selections.find(
        (s) =>
          doesSelectionMatchEmployee(s, authenticatedEmployee) &&
          s.welfare_year === selectedYear &&
          s.welfare_month === selectedMonth &&
          s.selection_status !== 'cancelled'
      ) || null
    );
  }, [authenticatedEmployee, selections, selectedYear, selectedMonth]);

  useEffect(() => {
    if (myCurrentMonthSelection) {
      setSelectedProductId(myCurrentMonthSelection.product_id);
      setIsChangingSelection(false);
    } else {
      setSelectedProductId('');
      setIsChangingSelection(false);
    }
  }, [myCurrentMonthSelection, selectedYear, selectedMonth, currentUser.id]);

  // Helper to append an audit log entry
  const logWelfareActivity = (
    selectionId: string,
    action: WelfareActivityLog['action'],
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null
  ) => {
    const entry: WelfareActivityLog = {
      id: `wlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      welfare_selection_id: selectionId,
      actor_user_id: currentUser.id,
      actor_name: currentUser.name,
      action,
      old_values: oldValues,
      new_values: newValues,
      created_at: new Date().toISOString(),
    };
    setActivityLogs((prev) => [entry, ...prev]);
  };

  // ================= EMPLOYEE ACTIONS =================

  const handleOpenConfirmSelectionModal = () => {
    if (isAdminOrHR || currentUser.role !== 'employee') {
      showToast('Only eligible employees can submit personal monthly welfare selections.', 'error');
      return;
    }
    if (!authenticatedEmployee) {
      showToast('Your user account is not linked to an employee profile. Please contact HR.', 'error');
      return;
    }
    if (!selectedProductId) {
      showToast('Please select one welfare product first.', 'error');
      return;
    }

    // Check if employee already has a selection for this month
    if (myCurrentMonthSelection) {
      showToast(
        `You have already selected ${myCurrentMonthSelection.product_name} for ${getMonthName(selectedMonth)} ${selectedYear}. You can select a new product next month.`,
        'info'
      );
      return;
    }

    setConfirmProductModalOpen(true);
  };

  const handleConfirmEmployeeSelection = () => {
    if (isAdminOrHR || currentUser.role !== 'employee') {
      showToast('Only authenticated employees can select a monthly welfare product.', 'error');
      return;
    }
    if (!authenticatedEmployee) {
      showToast('Your account is not linked to an employee profile. Please contact HR.', 'error');
      return;
    }

    const result = submitMonthlyWelfareSelection({
      employee: authenticatedEmployee,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      productId: selectedProductId,
      year: selectedYear,
      month: selectedMonth,
    });

    if (!result.ok) {
      if (result.existingSelection) {
        setSelections(loadWelfareSelections());
      }
      showToast(result.error, result.existingSelection ? 'info' : 'error');
      setConfirmProductModalOpen(false);
      return;
    }

    const { selection: newSelection, product } = result;
    const monthYearLabel = `${getMonthName(selectedMonth)} ${selectedYear}`;

    setSelections(loadWelfareSelections());
    setActivityLogs(loadWelfareLogs());

    addNotification({
      title: 'New Welfare Product Selection',
      message: `${authenticatedEmployee.fullName} selected ${product.product_name} for ${monthYearLabel}.`,
      type: 'welfare',
      targetRole: 'admin',
    });

    setConfirmProductModalOpen(false);
    setIsChangingSelection(false);
    showToast('Your monthly welfare product has been selected successfully!', 'success');
  };

  const handleEmployeeConfirmReceived = (selection: WelfareSelection) => {
    if (isAdminOrHR || currentUser.role !== 'employee') {
      showToast('Only the assigned employee can confirm personal receipt.', 'error');
      return;
    }
    if (!authenticatedEmployee || !doesSelectionMatchEmployee(selection, authenticatedEmployee)) {
      showToast('You can only confirm receipt for your own welfare product.', 'error');
      return;
    }
    if (selection.selection_status !== 'distributed') {
      showToast('Product must be distributed by HR before confirming receipt.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const updated: WelfareSelection = {
      ...selection,
      selection_status: 'received',
      received_at: nowIso,
      received_by: `${authenticatedEmployee.fullName} (${authenticatedEmployee.employeeCode})`,
      received_by_admin_override: false,
      updated_at: nowIso,
    };

    setSelections((prev) => prev.map((s) => (s.id === selection.id ? updated : s)));

    logWelfareActivity(
      selection.id,
      'confirmed_received',
      { selection_status: selection.selection_status },
      {
        selection_status: 'received',
        received_at: nowIso,
        received_by: updated.received_by,
      }
    );

    addNotification({
      title: 'Welfare Product Received',
      message: `${authenticatedEmployee.fullName} confirmed receipt of ${selection.product_name}.`,
      type: 'welfare',
      targetRole: 'admin',
    });

    showToast('Welfare product received successfully!', 'success');
  };

  // ================= HR / ADMIN ACTIONS =================

  const handleMarkPrepared = (selection: WelfareSelection, emp: Employee) => {
    if (!isAdminOrHR) {
      showToast('Only authorized HR/Admin users can mark products as prepared.', 'error');
      return;
    }
    if (selection.selection_status !== 'selected') {
      showToast('Only selections in "Selected" status can be marked as Prepared.', 'info');
      return;
    }

    const nowIso = new Date().toISOString();
    const updated: WelfareSelection = {
      ...selection,
      selection_status: 'prepared',
      prepared_at: nowIso,
      prepared_by: currentUser.name,
      updated_at: nowIso,
    };

    setSelections((prev) => prev.map((s) => (s.id === selection.id ? updated : s)));

    logWelfareActivity(
      selection.id,
      'marked_prepared',
      { selection_status: selection.selection_status },
      {
        selection_status: 'prepared',
        prepared_at: nowIso,
        prepared_by: currentUser.name,
      }
    );

    if (detailsModalData && detailsModalData.selection?.id === selection.id) {
      setDetailsModalData({
        ...detailsModalData,
        selection: updated,
      });
    }

    showToast(`Marked ${selection.product_name} as Prepared for ${emp.fullName}.`, 'success');
  };

  const handleConfirmDistribution = () => {
    if (!distributeConfirmTarget) return;
    if (!isAdminOrHR) {
      showToast('Only authorized HR/Admin users can distribute welfare products.', 'error');
      return;
    }

    const { selection, employee } = distributeConfirmTarget;
    const nowIso = new Date().toISOString();

    const updated: WelfareSelection = {
      ...selection,
      selection_status: 'distributed',
      prepared_at: selection.prepared_at || nowIso,
      prepared_by: selection.prepared_by || currentUser.name,
      distributed_at: nowIso,
      distributed_by: currentUser.name,
      updated_at: nowIso,
    };

    setSelections((prev) => prev.map((s) => (s.id === selection.id ? updated : s)));

    logWelfareActivity(
      selection.id,
      'marked_distributed',
      { selection_status: selection.selection_status },
      {
        selection_status: 'distributed',
        distributed_at: nowIso,
        distributed_by: currentUser.name,
      }
    );

    addNotification({
      title: 'Welfare Product Distributed',
      message: 'Your selected welfare product has been distributed. Please confirm receipt.',
      type: 'welfare',
      targetRole: 'employee',
      recipientEmployeeId: employee.id,
    });

    if (detailsModalData && detailsModalData.selection?.id === selection.id) {
      setDetailsModalData({
        ...detailsModalData,
        selection: updated,
      });
    }

    setDistributeConfirmTarget(null);
    showToast(`${selection.product_name} marked as Distributed to ${employee.fullName}.`, 'success');
  };

  const handleAdminAssistedReceipt = (selection: WelfareSelection, emp: Employee) => {
    if (!isAdminOrHR) return;
    if (selection.selection_status !== 'distributed') {
      showToast('Product must be distributed before recording receipt.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const updated: WelfareSelection = {
      ...selection,
      selection_status: 'received',
      received_at: nowIso,
      received_by: `${emp.fullName} (Recorded by HR: ${currentUser.name})`,
      received_by_admin_override: true,
      updated_at: nowIso,
    };

    setSelections((prev) => prev.map((s) => (s.id === selection.id ? updated : s)));

    logWelfareActivity(
      selection.id,
      'admin_recorded_receipt',
      { selection_status: selection.selection_status },
      {
        selection_status: 'received',
        received_at: nowIso,
        received_by: updated.received_by,
        admin_actor: currentUser.name,
      }
    );

    if (detailsModalData && detailsModalData.selection?.id === selection.id) {
      setDetailsModalData({
        ...detailsModalData,
        selection: updated,
      });
    }

    showToast(`Recorded physical receipt acknowledgment for ${emp.fullName}.`, 'success');
  };

  // ================= PRODUCT IMAGE UPLOAD ACTIONS =================

  const handleTriggerImageUpload = (productId: string) => {
    if (!isAdminOrHR) return;
    setUploadingProductId(productId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingProductId) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showToast('Invalid file format. Please upload a JPG, JPEG, PNG, or WEBP image.', 'error');
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      showToast('Image exceeds the 5 MB maximum file size limit.', 'error');
      return;
    }

    try {
      const dataUrl = await processUploadedImage(file);
      const nowIso = new Date().toISOString();
      setProducts((prev) =>
        prev.map((p) =>
          p.id === uploadingProductId
            ? { ...p, product_image_path: dataUrl, updated_at: nowIso }
            : p
        )
      );
      if (previewProduct && previewProduct.id === uploadingProductId) {
        setPreviewProduct((prev) =>
          prev ? { ...prev, product_image_path: dataUrl, updated_at: nowIso } : null
        );
      }
      showToast('Product image uploaded and saved successfully.', 'success');
    } catch {
      showToast('Failed to process the uploaded image. Please try another image.', 'error');
    } finally {
      setUploadingProductId(null);
    }
  };

  const handleRemoveProductImage = (productId: string) => {
    if (!isAdminOrHR) return;
    const nowIso = new Date().toISOString();
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, product_image_path: '', updated_at: nowIso } : p
      )
    );
    if (previewProduct && previewProduct.id === productId) {
      setPreviewProduct((prev) =>
        prev ? { ...prev, product_image_path: '', updated_at: nowIso } : null
      );
    }
    showToast('Product image removed.', 'info');
  };

  // ================= ADMIN DATA COMPUTATIONS =================

  // Build per-employee row for the selected month & year
  const monthlyEmployeeRows = useMemo(() => {
    return eligibleEmployees.map((emp) => {
      const sel =
        selections.find(
          (s) =>
            doesSelectionMatchEmployee(s, emp) &&
            s.welfare_year === selectedYear &&
            s.welfare_month === selectedMonth &&
            s.selection_status !== 'cancelled'
        ) || null;

      const status: WelfareSelectionStatus = sel ? sel.selection_status : 'not_selected';
      const product = sel ? products.find((p) => p.id === sel.product_id) : undefined;

      return {
        employee: emp,
        selection: sel,
        status,
        product,
      };
    });
  }, [eligibleEmployees, selections, selectedYear, selectedMonth, products]);

  // Summary card counts for the selected Month & Year
  const summaryStats = useMemo(() => {
    const totalEligible = monthlyEmployeeRows.length;
    const productsSelected = monthlyEmployeeRows.filter((r) =>
      ['selected', 'prepared', 'distributed', 'received'].includes(r.status)
    ).length;
    const pendingSelections = monthlyEmployeeRows.filter(
      (r) => r.status === 'not_selected'
    ).length;
    const productsDistributed = monthlyEmployeeRows.filter((r) =>
      ['distributed', 'received'].includes(r.status)
    ).length;
    const pendingDistribution = monthlyEmployeeRows.filter((r) =>
      ['selected', 'prepared'].includes(r.status)
    ).length;
    const productsReceived = monthlyEmployeeRows.filter(
      (r) => r.status === 'received'
    ).length;

    return {
      totalEligible,
      productsSelected,
      pendingSelections,
      productsDistributed,
      pendingDistribution,
      productsReceived,
    };
  }, [monthlyEmployeeRows]);

  // Filtered employee rows for Admin Dashboard / Employee Product Selections
  const filteredMonthlyRows = useMemo(() => {
    return monthlyEmployeeRows.filter((row) => {
      if (filterEmployeeId !== 'all' && row.employee.id !== filterEmployeeId) {
        return false;
      }
      if (
        filterDepartmentId !== 'all' &&
        row.employee.departmentId !== filterDepartmentId &&
        row.employee.departmentName !== filterDepartmentId
      ) {
        return false;
      }
      if (filterProductId !== 'all') {
        if (!row.selection || row.selection.product_id !== filterProductId) {
          return false;
        }
      }
      if (filterStatus !== 'all' && row.status !== filterStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = row.employee.fullName.toLowerCase().includes(q);
        const matchCode = row.employee.employeeCode.toLowerCase().includes(q);
        const matchDept = row.employee.departmentName.toLowerCase().includes(q);
        const matchProd = row.selection?.product_name.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDept && !matchProd) return false;
      }
      return true;
    });
  }, [
    monthlyEmployeeRows,
    filterEmployeeId,
    filterDepartmentId,
    filterProductId,
    filterStatus,
    searchQuery,
  ]);

  // Filtered Monthly History Records
  const filteredHistoryRecords = useMemo(() => {
    return selections
      .filter((sel) => {
        if (historyYear !== 'all' && sel.welfare_year !== Number(historyYear)) {
          return false;
        }
        if (historyMonth !== 'all' && sel.welfare_month !== Number(historyMonth)) {
          return false;
        }
        if (historyEmployeeId !== 'all') {
          const emp = employees.find((e) => e.id === historyEmployeeId);
          if (!emp || !doesSelectionMatchEmployee(sel, emp)) return false;
        }
        if (historyDepartmentId !== 'all') {
          if (
            sel.department_id !== historyDepartmentId &&
            sel.department_name !== historyDepartmentId
          ) {
            return false;
          }
        }
        if (historyProductId !== 'all' && sel.product_id !== historyProductId) {
          return false;
        }
        if (historyStatus !== 'all' && sel.selection_status !== historyStatus) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (b.welfare_year !== a.welfare_year) return b.welfare_year - a.welfare_year;
        if (b.welfare_month !== a.welfare_month) return b.welfare_month - a.welfare_month;
        return b.selected_at.localeCompare(a.selected_at);
      });
  }, [
    selections,
    historyYear,
    historyMonth,
    historyEmployeeId,
    historyDepartmentId,
    historyProductId,
    historyStatus,
    employees,
  ]);

  // Employee's own personal welfare history
  const myWelfareHistory = useMemo(() => {
    if (!authenticatedEmployee) return [];
    return selections
      .filter(
        (sel) =>
          doesSelectionMatchEmployee(sel, authenticatedEmployee) &&
          sel.selection_status !== 'cancelled'
      )
      .sort((a, b) => {
        if (b.welfare_year !== a.welfare_year) return b.welfare_year - a.welfare_year;
        if (b.welfare_month !== a.welfare_month) return b.welfare_month - a.welfare_month;
        return b.selected_at.localeCompare(a.selected_at);
      });
  }, [authenticatedEmployee, selections]);

  const handleExportHistoryCSV = () => {
    if (!isAdminOrHR) return;
    if (filteredHistoryRecords.length === 0) {
      showToast('No welfare records match the current filters to export.', 'info');
      return;
    }

    const headers = [
      'Employee Name',
      'Employee ID',
      'Department',
      'Product Selected',
      'Welfare Month',
      'Welfare Year',
      'Selection Date',
      'Distribution Status',
      'Distributed Date',
      'Received Date',
    ];

    const rows = filteredHistoryRecords.map((sel) => {
      const emp = employees.find((e) => doesSelectionMatchEmployee(sel, e));
      const empName = emp?.fullName || sel.employee_name;
      const empCode = emp?.employeeCode || sel.employee_code;
      const deptName = emp?.departmentName || sel.department_name;
      const selDate = formatKolkataDateTime(sel.selected_at).full;
      const distDate = sel.distributed_at ? formatKolkataDateTime(sel.distributed_at).full : '';
      const recDate = sel.received_at ? formatKolkataDateTime(sel.received_at).full : '';
      const statusCfg = getStatusBadgeConfig(sel.selection_status);

      return [
        empName,
        empCode,
        deptName,
        sel.product_name,
        getMonthName(sel.welfare_month),
        String(sel.welfare_year),
        selDate,
        statusCfg.label,
        distDate,
        recDate,
      ].map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`);
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const periodSuffix = `${historyYear === 'all' ? 'all-years' : historyYear}-${
      historyMonth === 'all' ? 'all-months' : getMonthName(Number(historyMonth)).toLowerCase()
    }`;
    link.href = url;
    link.setAttribute('download', `employee-welfare-history-${periodSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Welfare history exported to CSV successfully.', 'success');
  };

  // Render helper for the Admin Filter Bar + Employee Product Selections Table
  const renderAdminSelectionsTableSection = () => (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">Employee Product Selections</h3>
            <p className="text-xs text-slate-500">
              Showing eligible employees and welfare distribution status for{' '}
              <span className="font-semibold text-[#206DA6]">
                {getMonthName(selectedMonth)} {selectedYear}
              </span>
            </p>
          </div>
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee, ID, product..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* 1. Select Year */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Select Month */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            >
              {WELFARE_MONTH_NAMES.map((mName, idx) => (
                <option key={mName} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Employee Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Employee
            </label>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            >
              <option value="all">All Employees</option>
              {eligibleEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Department Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={filterDepartmentId}
              onChange={(e) => setFilterDepartmentId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            >
              <option value="all">All Departments</option>
              {Array.from(
                new Set([
                  ...departments.map((d) => d.name),
                  ...eligibleEmployees.map((e) => e.departmentName).filter(Boolean),
                ])
              ).map((deptName) => (
                <option key={deptName} value={deptName}>
                  {deptName}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Product Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Product
            </label>
            <select
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            >
              <option value="all">All Products</option>
              {products.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.product_name}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Distribution Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Distribution Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            >
              <option value="all">All Statuses</option>
              <option value="not_selected">Not Selected</option>
              <option value="selected">Selected</option>
              <option value="prepared">Prepared</option>
              <option value="distributed">Distributed</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selections Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3.5 px-3">Photo</th>
                <th className="py-3.5 px-3">Employee Name</th>
                <th className="py-3.5 px-3">Employee ID</th>
                <th className="py-3.5 px-3">Department</th>
                <th className="py-3.5 px-3">Selected Product</th>
                <th className="py-3.5 px-3">Selection Date</th>
                <th className="py-3.5 px-3">Welfare Month</th>
                <th className="py-3.5 px-3">Welfare Year</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Distribution Status</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Distributed Date</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Received Date</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMonthlyRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600">
                      No employee records match the selected filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMonthlyRows.map(({ employee: emp, selection: sel, status, product }) => {
                  const badgeCfg = getStatusBadgeConfig(status);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <Avatar src={emp.avatar} name={emp.fullName} size="sm" />
                      </td>
                      <td className="py-3 px-3 font-bold text-[#172B4D] whitespace-nowrap">
                        {emp.fullName}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {emp.employeeCode}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{emp.departmentName}</td>
                      <td className="py-3 px-3">
                        {sel ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            {product?.product_image_path ? (
                              <img
                                src={product.product_image_path}
                                alt={sel.product_name}
                                className="w-7 h-7 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                {renderProductPlaceholderIcon(
                                  sel.product_name,
                                  'w-4 h-4 text-[#206DA6]'
                                )}
                              </div>
                            )}
                            <span className="font-semibold text-[#172B4D]">{sel.product_name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic whitespace-nowrap">
                            Not Selected
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {sel ? formatKolkataDateTime(sel.selected_at).date : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                        {getMonthName(selectedMonth)}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {selectedYear}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${badgeCfg.classes}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badgeCfg.dotColor}`} />
                          {badgeCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {sel?.distributed_at ? formatKolkataDateTime(sel.distributed_at).date : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {sel?.received_at ? formatKolkataDateTime(sel.received_at).date : '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex flex-row items-center justify-end gap-2 flex-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setDetailsModalData({
                                employee: emp,
                                selection: sel,
                                year: selectedYear,
                                month: selectedMonth,
                              })
                            }
                            className="inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold text-[#206DA6] bg-blue-50 hover:bg-blue-100 border border-transparent rounded-lg transition-colors whitespace-nowrap"
                          >
                            View Details
                          </button>

                          {sel && sel.selection_status === 'selected' && (
                            <button
                              type="button"
                              onClick={() => handleMarkPrepared(sel, emp)}
                              className="inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Mark Prepared
                            </button>
                          )}

                          {sel &&
                            (sel.selection_status === 'selected' ||
                              sel.selection_status === 'prepared') && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDistributeConfirmTarget({
                                    employee: emp,
                                    selection: sel,
                                  })
                                }
                                className="inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors whitespace-nowrap"
                              >
                                Mark Distributed
                              </button>
                            )}

                          {sel &&
                            (sel.selection_status === 'distributed' ||
                              sel.selection_status === 'received') && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDetailsModalData({
                                    employee: emp,
                                    selection: sel,
                                    year: selectedYear,
                                    month: selectedMonth,
                                  })
                                }
                                className="inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                              >
                                View Receipt Status
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in text-[#172B4D]">
      {/* Hidden File Input for Admin Product Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ================= PAGE HEADER ================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#206DA6]/10 text-[#206DA6] flex items-center justify-center font-bold flex-shrink-0">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#172B4D]">
              Employee Welfare
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Select your monthly welfare product and track distribution history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#206DA6] font-bold border border-blue-100">
            1 Free Product / Month
          </span>
        </div>
      </div>

      {/* ================= ROLE-BASED NAVIGATION TABS ================= */}
      {isAdminOrHR ? (
        <div className="flex flex-wrap border-b border-slate-200 gap-6 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setAdminTab('dashboard')}
            className={`pb-3 transition-colors ${
              adminTab === 'dashboard'
                ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Welfare Dashboard
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('selections')}
            className={`pb-3 transition-colors ${
              adminTab === 'selections'
                ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Employee Product Selections
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('catalog')}
            className={`pb-3 transition-colors ${
              adminTab === 'catalog'
                ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Product Catalog ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('history')}
            className={`pb-3 transition-colors ${
              adminTab === 'history'
                ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Monthly History
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap border-b border-slate-200 gap-6 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setEmployeeTab('choose')}
            className={`pb-3 transition-colors ${
              employeeTab === 'choose'
                ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Choose My Product
          </button>
          <button
            type="button"
            onClick={() => setEmployeeTab('my_selection')}
            className={`pb-3 transition-colors flex items-center gap-1.5 ${
              employeeTab === 'my_selection'
                ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>My Selection</span>
            {myCurrentMonthSelection?.selection_status === 'distributed' && (
              <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px]">
                Confirm Receipt
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setEmployeeTab('my_history')}
            className={`pb-3 transition-colors ${
              employeeTab === 'my_history'
                ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            My Welfare History ({myWelfareHistory.length})
          </button>
        </div>
      )}

      {/* ================= ADMIN VIEWS ================= */}
      {isAdminOrHR && adminTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 6 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Eligible Employees
              </span>
              <span className="text-2xl font-black text-[#172B4D] font-mono mt-1 block">
                {summaryStats.totalEligible}
              </span>
              <span className="text-[10px] text-slate-400">
                {getMonthName(selectedMonth)} {selectedYear}
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Products Selected
              </span>
              <span className="text-2xl font-black text-[#206DA6] font-mono mt-1 block">
                {summaryStats.productsSelected}
              </span>
              <span className="text-[10px] text-slate-400">Confirmed choices</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Pending Selections
              </span>
              <span className="text-2xl font-black text-slate-600 font-mono mt-1 block">
                {summaryStats.pendingSelections}
              </span>
              <span className="text-[10px] text-slate-400">Yet to choose</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Products Distributed
              </span>
              <span className="text-2xl font-black text-purple-600 font-mono mt-1 block">
                {summaryStats.productsDistributed}
              </span>
              <span className="text-[10px] text-slate-400">Issued by HR</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Pending Distribution
              </span>
              <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">
                {summaryStats.pendingDistribution}
              </span>
              <span className="text-[10px] text-slate-400">Awaiting handover</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Products Received
              </span>
              <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
                {summaryStats.productsReceived}
              </span>
              <span className="text-[10px] text-slate-400">Receipt confirmed</span>
            </div>
          </div>

          {renderAdminSelectionsTableSection()}
        </div>
      )}

      {isAdminOrHR && adminTab === 'selections' && renderAdminSelectionsTableSection()}

      {/* ADMIN TAB 3: PRODUCT CATALOG & IMAGE MANAGEMENT */}
      {isAdminOrHR && adminTab === 'catalog' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#172B4D]">
                Welfare Product Catalog ({products.length} Official Items)
              </h3>
              <p className="text-xs text-slate-500">
                Upload or update official product photos (JPG, JPEG, PNG, WEBP up to 5 MB). Each
                product is provided free of charge.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {products.map((prod, idx) => {
              const monthlyCount = selections.filter(
                (s) =>
                  s.product_id === prod.id &&
                  s.welfare_year === selectedYear &&
                  s.welfare_month === selectedMonth &&
                  s.selection_status !== 'cancelled'
              ).length;

              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between transition-all hover:border-[#206DA6]/40 hover:shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      {prod.product_image_path ? (
                        <img
                          src={prod.product_image_path}
                          alt={prod.product_name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0">
                          {renderProductPlaceholderIcon(
                            prod.product_name,
                            'w-5 h-5 text-[#206DA6]'
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-500">
                          #{idx + 1}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700">
                          Free
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 mb-2.5">
                      <h4 className="text-xs sm:text-[13px] font-bold text-[#172B4D] leading-snug truncate">
                        {prod.product_name}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Monthly Free Employee Welfare Benefit
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Selected:{' '}
                        <span className="font-bold text-[#206DA6]">{monthlyCount}</span> in{' '}
                        {getMonthName(selectedMonth).slice(0, 3)} {selectedYear}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTriggerImageUpload(prod.id)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-lg transition-colors"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{prod.product_image_path ? 'Change' : 'Upload'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewProduct(prod)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </div>

                    {prod.product_image_path && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProductImage(prod.id)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADMIN TAB 4: MONTHLY HISTORY */}
      {isAdminOrHR && adminTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#172B4D]">Monthly Welfare History</h3>
                <p className="text-xs text-slate-500">
                  Complete archive of monthly employee product selections and distribution records
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportHistoryCSV}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-xs transition-all self-start sm:self-auto"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
              {/* Select Year */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Select Year
                </label>
                <select
                  value={historyYear}
                  onChange={(e) => setHistoryYear(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                >
                  <option value="all">All Years</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Month */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Select Month
                </label>
                <select
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                >
                  <option value="all">All Months</option>
                  {WELFARE_MONTH_NAMES.map((mName, idx) => (
                    <option key={mName} value={String(idx + 1)}>
                      {mName}
                    </option>
                  ))}
                </select>
              </div>

              {/* All Employees */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Employee
                </label>
                <select
                  value={historyEmployeeId}
                  onChange={(e) => setHistoryEmployeeId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                >
                  <option value="all">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* All Departments */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Department
                </label>
                <select
                  value={historyDepartmentId}
                  onChange={(e) => setHistoryDepartmentId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                >
                  <option value="all">All Departments</option>
                  {Array.from(
                    new Set([
                      ...departments.map((d) => d.name),
                      ...employees.map((e) => e.departmentName).filter(Boolean),
                    ])
                  ).map((deptName) => (
                    <option key={deptName} value={deptName}>
                      {deptName}
                    </option>
                  ))}
                </select>
              </div>

              {/* All Products */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Product
                </label>
                <select
                  value={historyProductId}
                  onChange={(e) => setHistoryProductId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                >
                  <option value="all">All Products</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.product_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* All Distribution Statuses */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Distribution Status
                </label>
                <select
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                >
                  <option value="all">All Distribution Statuses</option>
                  <option value="selected">Selected</option>
                  <option value="prepared">Prepared</option>
                  <option value="distributed">Distributed</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Employee Name</th>
                    <th className="py-3.5 px-4">Employee ID</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Product Selected</th>
                    <th className="py-3.5 px-4">Welfare Month</th>
                    <th className="py-3.5 px-4">Welfare Year</th>
                    <th className="py-3.5 px-4">Selection Date</th>
                    <th className="py-3.5 px-4">Distribution Status</th>
                    <th className="py-3.5 px-4">Distributed Date</th>
                    <th className="py-3.5 px-4">Received Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistoryRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <p className="font-semibold text-slate-600">
                          No welfare history records found for the selected filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryRecords.map((sel) => {
                      const emp = employees.find((e) => doesSelectionMatchEmployee(sel, e));
                      const badgeCfg = getStatusBadgeConfig(sel.selection_status);
                      return (
                        <tr
                          key={sel.id}
                          onClick={() => {
                            if (emp) {
                              setDetailsModalData({
                                employee: emp,
                                selection: sel,
                                year: sel.welfare_year,
                                month: sel.welfare_month,
                              });
                            }
                          }}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-[#172B4D]">
                            {emp?.fullName || sel.employee_name}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {emp?.employeeCode || sel.employee_code}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {emp?.departmentName || sel.department_name}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#172B4D]">
                            {sel.product_name}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {getMonthName(sel.welfare_month)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {sel.welfare_year}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {formatKolkataDateTime(sel.selected_at).full}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeCfg.classes}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeCfg.dotColor}`} />
                              {badgeCfg.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {sel.distributed_at
                              ? formatKolkataDateTime(sel.distributed_at).full
                              : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {sel.received_at ? formatKolkataDateTime(sel.received_at).full : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= EMPLOYEE VIEWS ================= */}
      {!isAdminOrHR && (
        <div className="space-y-6">
          {/* Employee Identity & Active Welfare Period Header Card */}
          {authenticatedEmployee ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <Avatar
                  src={authenticatedEmployee.avatar}
                  name={authenticatedEmployee.fullName}
                  size="lg"
                  className="ring-2 ring-[#206DA6]/20"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-extrabold text-[#172B4D]">
                      {authenticatedEmployee.fullName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-700">
                      {authenticatedEmployee.employeeCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Department:{' '}
                    <span className="font-semibold text-slate-700">
                      {authenticatedEmployee.departmentName}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Month & Year Selectors */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <Calendar className="w-4 h-4 text-[#206DA6]" />
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">
                      Selected Month &amp; Year
                    </span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="text-xs font-bold text-[#172B4D] bg-transparent focus:outline-hidden cursor-pointer"
                      >
                        {WELFARE_MONTH_NAMES.map((mName, idx) => (
                          <option key={mName} value={idx + 1}>
                            {mName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="text-xs font-bold font-mono text-[#172B4D] bg-transparent focus:outline-hidden cursor-pointer"
                      >
                        {availableYears.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Current Selection Status */}
                {(() => {
                  const currentStatus: WelfareSelectionStatus = myCurrentMonthSelection
                    ? myCurrentMonthSelection.selection_status
                    : 'not_selected';
                  const cfg = getStatusBadgeConfig(currentStatus);
                  return (
                    <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">
                        Current Selection Status
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 mt-0.5 text-xs font-bold ${
                          currentStatus === 'not_selected' ? 'text-slate-600' : 'text-[#206DA6]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                        {currentStatus === 'not_selected'
                          ? 'No Product Selected Yet'
                          : `${cfg.label} (${myCurrentMonthSelection?.product_name})`}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                Your user account is not linked to an employee profile. Please contact HR.
              </span>
            </div>
          )}

          {/* EMPLOYEE TAB 1: CHOOSE MY PRODUCT */}
          {employeeTab === 'choose' && (
            <div className="space-y-5">
              {/* Section Heading */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#172B4D]">
                    Choose Your Monthly Welfare Product
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any one free product for this month (
                    {getMonthName(selectedMonth)} {selectedYear}).
                  </p>
                </div>

                {selectedProductId &&
                  (!myCurrentMonthSelection || isChangingSelection) && (
                    <button
                      type="button"
                      onClick={handleOpenConfirmSelectionModal}
                      className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all self-start sm:self-auto"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Selection</span>
                    </button>
                  )}
              </div>

              {/* Banner if employee already has a selection for the month */}
              {myCurrentMonthSelection && (
                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#206DA6] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-extrabold text-[#172B4D]">
                        Your Product for {getMonthName(selectedMonth)} {selectedYear}:{' '}
                        <span className="text-[#206DA6]">
                          {myCurrentMonthSelection.product_name}
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        You have already selected {myCurrentMonthSelection.product_name} for{' '}
                        {getMonthName(selectedMonth)} {selectedYear}. You can select a new product
                        next month.
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Selected on{' '}
                        <span className="font-mono font-semibold text-slate-700">
                          {formatKolkataDateTime(myCurrentMonthSelection.selected_at).full}
                        </span>{' '}
                        &bull; Status:{' '}
                        <span className="font-bold capitalize text-[#206DA6]">
                          {myCurrentMonthSelection.selection_status}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {myCurrentMonthSelection.selection_status === 'distributed' && (
                      <button
                        type="button"
                        onClick={() => handleEmployeeConfirmReceived(myCurrentMonthSelection)}
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors"
                      >
                        Confirm Received
                      </button>
                    )}

                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Selection Confirmed
                    </span>
                  </div>
                </div>
              )}

              {/* 10 Product Catalog Grid (Compact Small Cards: 5 per row desktop, 3 tablet, 2 mobile) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {products.map((prod) => {
                  const isSelected = selectedProductId === prod.id;
                  const isSavedProduct = myCurrentMonthSelection?.product_id === prod.id;
                  const isLocked = !!myCurrentMonthSelection;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        if (isLocked && myCurrentMonthSelection) {
                          showToast(
                            `You have already selected ${myCurrentMonthSelection.product_name} for ${getMonthName(selectedMonth)} ${selectedYear}. You can select a new product next month.`,
                            'info'
                          );
                          return;
                        }
                        setSelectedProductId(prod.id);
                      }}
                      className={`rounded-xl border p-3 transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/25 border-2 border-[#206DA6] shadow-sm ring-2 ring-[#206DA6]/10'
                          : 'bg-white border-slate-200/80 shadow-2xs hover:border-[#206DA6]/50 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Compact Product Icon / Image at Top */}
                        <div className="flex items-start justify-between gap-2">
                          {prod.product_image_path ? (
                            <img
                              src={prod.product_image_path}
                              alt={prod.product_name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-[#206DA6] text-white border-[#206DA6]'
                                  : 'bg-blue-50/80 text-[#206DA6] border-blue-100'
                              }`}
                            >
                              {renderProductPlaceholderIcon(
                                prod.product_name,
                                isSelected ? 'w-5 h-5 text-white' : 'w-5 h-5 text-[#206DA6]'
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-1">
                            {isSavedProduct && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold">
                                Saved
                              </span>
                            )}
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-[#206DA6] text-white flex items-center justify-center shadow-2xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Product Name & Short Subtitle */}
                        <div className="mt-2.5 mb-3">
                          <h4 className="text-xs sm:text-[13px] font-bold text-[#172B4D] leading-snug truncate">
                            {prod.product_name}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                            Monthly Free Employee Welfare Benefit
                          </p>
                        </div>
                      </div>

                      {/* Compact Select Product Button at Bottom */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLocked) {
                            showToast(
                              'You have already selected your welfare product for this month.',
                              'info'
                            );
                            return;
                          }
                          setSelectedProductId(prod.id);
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? 'bg-[#206DA6] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Selected</span>
                          </>
                        ) : (
                          <span>Select Product</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Confirm Bar */}
              {(!myCurrentMonthSelection || isChangingSelection) && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    {selectedProductId ? (
                      <span>
                        Highlighted Product:{' '}
                        <strong className="text-[#172B4D]">
                          {products.find((p) => p.id === selectedProductId)?.product_name}
                        </strong>{' '}
                        for{' '}
                        <strong className="text-[#206DA6]">
                          {getMonthName(selectedMonth)} {selectedYear}
                        </strong>
                      </span>
                    ) : (
                      <span>Select any one product above and click Confirm Selection.</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!selectedProductId}
                    onClick={handleOpenConfirmSelectionModal}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      selectedProductId
                        ? 'bg-[#206DA6] text-white hover:bg-[#1A5987] shadow-md shadow-[#206DA6]/20'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Confirm Selection
                  </button>
                </div>
              )}
            </div>
          )}

          {/* EMPLOYEE TAB 2: MY SELECTION */}
          {employeeTab === 'my_selection' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              {!myCurrentMonthSelection ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Package className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#172B4D]">No Product Selected Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    You have not selected a welfare product for {getMonthName(selectedMonth)}{' '}
                    {selectedYear}. Choose any one free product from the catalog.
                  </p>
                  <button
                    type="button"
                    onClick={() => setEmployeeTab('choose')}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-xs transition-colors"
                  >
                    Choose My Product
                  </button>
                </div>
              ) : (
                (() => {
                  const prod = products.find((p) => p.id === myCurrentMonthSelection.product_id);
                  const badgeCfg = getStatusBadgeConfig(myCurrentMonthSelection.selection_status);
                  return (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                          {prod?.product_image_path ? (
                            <img
                              src={prod.product_image_path}
                              alt={myCurrentMonthSelection.product_name}
                              className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                              {renderProductPlaceholderIcon(myCurrentMonthSelection.product_name)}
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {getMonthName(myCurrentMonthSelection.welfare_month)}{' '}
                              {myCurrentMonthSelection.welfare_year} Selection
                            </span>
                            <h3 className="text-lg font-extrabold text-[#172B4D]">
                              {myCurrentMonthSelection.product_name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Selected on{' '}
                              {formatKolkataDateTime(myCurrentMonthSelection.selected_at).full}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${badgeCfg.classes}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${badgeCfg.dotColor}`} />
                            {badgeCfg.label}
                          </span>

                          {myCurrentMonthSelection.selection_status === 'distributed' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleEmployeeConfirmReceived(myCurrentMonthSelection)
                              }
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Confirm Received</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Timeline details */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
                          <span className="text-[10px] font-bold text-[#206DA6] uppercase block">
                            1. Selected
                          </span>
                          <span className="font-bold text-[#172B4D] mt-1 block">
                            {formatKolkataDateTime(myCurrentMonthSelection.selected_at).full}
                          </span>
                        </div>

                        <div
                          className={`p-3.5 rounded-xl border ${
                            myCurrentMonthSelection.prepared_at
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-slate-50 border-slate-100 opacity-60'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-amber-700 uppercase block">
                            2. Prepared by HR
                          </span>
                          <span className="font-bold text-[#172B4D] mt-1 block">
                            {myCurrentMonthSelection.prepared_at
                              ? formatKolkataDateTime(myCurrentMonthSelection.prepared_at).full
                              : 'Pending Preparation'}
                          </span>
                        </div>

                        <div
                          className={`p-3.5 rounded-xl border ${
                            myCurrentMonthSelection.distributed_at
                              ? 'bg-purple-50/60 border-purple-200'
                              : 'bg-slate-50 border-slate-100 opacity-60'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-purple-700 uppercase block">
                            3. Distributed
                          </span>
                          <span className="font-bold text-[#172B4D] mt-1 block">
                            {myCurrentMonthSelection.distributed_at
                              ? formatKolkataDateTime(myCurrentMonthSelection.distributed_at).full
                              : 'Pending Distribution'}
                          </span>
                        </div>

                        <div
                          className={`p-3.5 rounded-xl border ${
                            myCurrentMonthSelection.received_at
                              ? 'bg-emerald-50/60 border-emerald-200'
                              : 'bg-slate-50 border-slate-100 opacity-60'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                            4. Received
                          </span>
                          <span className="font-bold text-[#172B4D] mt-1 block">
                            {myCurrentMonthSelection.received_at
                              ? formatKolkataDateTime(myCurrentMonthSelection.received_at).full
                              : 'Awaiting Receipt Confirmation'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* EMPLOYEE TAB 3: MY WELFARE HISTORY */}
          {employeeTab === 'my_history' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-[#172B4D]">My Welfare History</h3>
                <p className="text-xs text-slate-500">
                  Your personal monthly welfare product selections and receipt history
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Month</th>
                      <th className="py-3.5 px-4">Year</th>
                      <th className="py-3.5 px-4">Product Image</th>
                      <th className="py-3.5 px-4">Product Name</th>
                      <th className="py-3.5 px-4">Selection Date</th>
                      <th className="py-3.5 px-4">Distribution Status</th>
                      <th className="py-3.5 px-4">Received Date</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myWelfareHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <p className="font-semibold text-slate-600">
                            No personal welfare selections recorded yet.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      myWelfareHistory.map((sel) => {
                        const prod = products.find((p) => p.id === sel.product_id);
                        const badgeCfg = getStatusBadgeConfig(sel.selection_status);
                        return (
                          <tr key={sel.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-bold text-[#172B4D]">
                              {getMonthName(sel.welfare_month)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {sel.welfare_year}
                            </td>
                            <td className="py-3 px-4">
                              {prod?.product_image_path ? (
                                <img
                                  src={prod.product_image_path}
                                  alt={sel.product_name}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                  {renderProductPlaceholderIcon(
                                    sel.product_name,
                                    'w-5 h-5 text-[#206DA6]'
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold text-[#172B4D]">
                              {sel.product_name}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              {formatKolkataDateTime(sel.selected_at).full}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeCfg.classes}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${badgeCfg.dotColor}`} />
                                {badgeCfg.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              {sel.received_at
                                ? formatKolkataDateTime(sel.received_at).full
                                : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {sel.selection_status === 'distributed' ? (
                                <button
                                  type="button"
                                  onClick={() => handleEmployeeConfirmReceived(sel)}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                                >
                                  Confirm Received
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= POPUP 1: EMPLOYEE CONFIRM WELFARE PRODUCT ================= */}
      <Modal
        isOpen={confirmProductModalOpen}
        onClose={() => setConfirmProductModalOpen(false)}
        title="Confirm Welfare Product"
        subtitle="Monthly Free Employee Welfare Benefit"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            You selected{' '}
            <strong className="text-[#172B4D]">
              {products.find((p) => p.id === selectedProductId)?.product_name}
            </strong>{' '}
            for{' '}
            <strong className="text-[#206DA6]">
              {getMonthName(selectedMonth)} {selectedYear}
            </strong>
            . Only one welfare product is allowed per month. Confirm your selection?
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setConfirmProductModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmEmployeeSelection}
              className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </Modal>

      {/* ================= POPUP 2: HR CONFIRM DISTRIBUTION ================= */}
      <Modal
        isOpen={!!distributeConfirmTarget}
        onClose={() => setDistributeConfirmTarget(null)}
        title="Confirm Product Distribution"
        subtitle="Record handover of monthly welfare product"
        maxWidth="sm"
      >
        {distributeConfirmTarget && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Confirm that{' '}
              <strong className="text-[#172B4D]">
                {distributeConfirmTarget.selection.product_name}
              </strong>{' '}
              has been distributed to{' '}
              <strong className="text-[#206DA6]">
                {distributeConfirmTarget.employee.fullName}
              </strong>
              .
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDistributeConfirmTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDistribution}
                className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
              >
                Confirm Distribution
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= POPUP 3: EMPLOYEE WELFARE DETAILS ================= */}
      <Modal
        isOpen={!!detailsModalData}
        onClose={() => setDetailsModalData(null)}
        title="Employee Welfare Details"
        subtitle={
          detailsModalData
            ? `${getMonthName(detailsModalData.month)} ${detailsModalData.year} Welfare Record`
            : ''
        }
        maxWidth="md"
      >
        {detailsModalData && (
          <div className="space-y-4 text-xs">
            {/* Employee Information */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar
                  src={detailsModalData.employee.avatar}
                  name={detailsModalData.employee.fullName}
                  size="md"
                />
                <div>
                  <h4 className="text-sm font-bold text-[#172B4D]">
                    {detailsModalData.employee.fullName}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {detailsModalData.employee.departmentName} &bull;{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {detailsModalData.employee.employeeCode}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Designation: {detailsModalData.employee.designation}
                  </p>
                </div>
              </div>

              {(() => {
                const st: WelfareSelectionStatus = detailsModalData.selection
                  ? detailsModalData.selection.selection_status
                  : 'not_selected';
                const cfg = getStatusBadgeConfig(st);
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.classes}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                    {cfg.label}
                  </span>
                );
              })()}
            </div>

            {/* Product Information */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Product Information
              </span>
              {detailsModalData.selection ? (
                <>
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                    {(() => {
                      const prod = products.find(
                        (p) => p.id === detailsModalData.selection?.product_id
                      );
                      return prod?.product_image_path ? (
                        <img
                          src={prod.product_image_path}
                          alt={detailsModalData.selection.product_name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                          {renderProductPlaceholderIcon(
                            detailsModalData.selection.product_name,
                            'w-6 h-6 text-[#206DA6]'
                          )}
                        </div>
                      );
                    })()}
                    <div>
                      <p className="text-sm font-bold text-[#172B4D]">
                        {detailsModalData.selection.product_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Welfare Period: {getMonthName(detailsModalData.selection.welfare_month)}{' '}
                        {detailsModalData.selection.welfare_year}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Selection Date &amp; Time:</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {formatKolkataDateTime(detailsModalData.selection.selected_at).full}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-slate-500 italic py-2">
                  No welfare product selected by this employee for{' '}
                  {getMonthName(detailsModalData.month)} {detailsModalData.year}.
                </p>
              )}
            </div>

            {/* Distribution Information (Only show timestamps for actions that actually occurred) */}
            {detailsModalData.selection && (
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Distribution Information
                </span>

                {detailsModalData.selection.prepared_at && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Prepared Date &amp; Time:</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {formatKolkataDateTime(detailsModalData.selection.prepared_at).full}
                      {detailsModalData.selection.prepared_by
                        ? ` (${detailsModalData.selection.prepared_by})`
                        : ''}
                    </span>
                  </div>
                )}

                {detailsModalData.selection.distributed_at && (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-slate-500">Distributed Date &amp; Time:</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {formatKolkataDateTime(detailsModalData.selection.distributed_at).full}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-slate-500">Distributed By:</span>
                      <span className="font-semibold text-slate-800">
                        {detailsModalData.selection.distributed_by || 'HR Admin'}
                      </span>
                    </div>
                  </>
                )}

                {detailsModalData.selection.received_at && (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-slate-500">Received Date &amp; Time:</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        {formatKolkataDateTime(detailsModalData.selection.received_at).full}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Received By:</span>
                      <span className="font-semibold text-emerald-800">
                        {detailsModalData.selection.received_by ||
                          detailsModalData.employee.fullName}
                      </span>
                    </div>
                  </>
                )}

                {!detailsModalData.selection.prepared_at &&
                  !detailsModalData.selection.distributed_at &&
                  !detailsModalData.selection.received_at && (
                    <p className="text-slate-400 italic">
                      Awaiting HR preparation and distribution.
                    </p>
                  )}
              </div>
            )}

            {/* Popup Footer: Close | Update Distribution Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailsModalData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Close
              </button>

              {isAdminOrHR && detailsModalData.selection && (
                <div className="inline-flex flex-row items-center gap-2 flex-nowrap">
                  {detailsModalData.selection.selection_status === 'selected' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleMarkPrepared(
                          detailsModalData.selection!,
                          detailsModalData.employee
                        )
                      }
                      className="px-4 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors whitespace-nowrap"
                    >
                      Mark Prepared
                    </button>
                  )}

                  {(detailsModalData.selection.selection_status === 'selected' ||
                    detailsModalData.selection.selection_status === 'prepared') && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = {
                          employee: detailsModalData.employee,
                          selection: detailsModalData.selection!,
                        };
                        setDetailsModalData(null);
                        setDistributeConfirmTarget(target);
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-sm transition-colors whitespace-nowrap"
                    >
                      Update Distribution Status (Mark Distributed)
                    </button>
                  )}

                  {detailsModalData.selection.selection_status === 'distributed' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAdminAssistedReceipt(
                          detailsModalData.selection!,
                          detailsModalData.employee
                        )
                      }
                      className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                      title="Use only if employee cannot access the system to confirm receipt"
                    >
                      Record Audited Physical Receipt
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ================= POPUP 4: VIEW PRODUCT MODAL ================= */}
      <Modal
        isOpen={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
        title={previewProduct?.product_name || 'Welfare Product'}
        subtitle="Official Monthly Employee Welfare Catalog Item"
        maxWidth="sm"
      >
        {previewProduct && (
          <div className="space-y-4">
            <div className="h-56 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden">
              {previewProduct.product_image_path ? (
                <img
                  src={previewProduct.product_image_path}
                  alt={previewProduct.product_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  {renderProductPlaceholderIcon(
                    previewProduct.product_name,
                    'w-12 h-12 text-[#206DA6]'
                  )}
                  <span className="text-xs">No image uploaded yet</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Catalog Status:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Active &bull; Free Monthly Benefit
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              {isAdminOrHR && (
                <button
                  type="button"
                  onClick={() => handleTriggerImageUpload(previewProduct.id)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl"
                >
                  {previewProduct.product_image_path ? 'Change Image' : 'Upload Image'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
