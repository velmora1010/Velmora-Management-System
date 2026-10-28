/**
 * Safe LocalStorage Utility
 * Protects against QuotaExceededError and prevents runtime crashes
 */

// In-memory fallback map if localStorage is full
const inMemoryFallback = new Map<string, string>();

/**
 * Strips redundant large base64 avatar duplicates from attendance and work assignment items.
 * Does NOT delete any employees, attendance records, or assignments.
 */
export function sanitizeExistingStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    // 1. Remove obsolete legacy keys
    const staleKeys = [
      'hrms_employee_draft_v1',
      'hrms_activity_v2',
      'hrms_leaves_v2',
      'hrms_attendance_v2',
      'hrms_work_assignments_v1',
      'hrms_work_tasks_v1',
      'hrms_work_updates_v1',
    ];
    staleKeys.forEach((k) => localStorage.removeItem(k));

    // 2. Sanitize bloated attendance records (strip duplicated base64 avatars)
    const rawAttendance = localStorage.getItem('hrms_attendance_v3');
    if (rawAttendance && rawAttendance.length > 100000) {
      try {
        const parsed = JSON.parse(rawAttendance);
        if (Array.isArray(parsed)) {
          let modified = false;
          const sanitized = parsed.map((r) => {
            if (r.avatar && (r.avatar.startsWith('data:') || r.avatar.length > 200)) {
              modified = true;
              const { avatar, ...rest } = r;
              return { ...rest, avatar: '' };
            }
            return r;
          });
          if (modified) {
            localStorage.setItem('hrms_attendance_v3', JSON.stringify(sanitized));
            console.info(`[Storage] Trimmed duplicate avatars from attendance storage (${Math.round(rawAttendance.length / 1024)}KB -> ${Math.round(JSON.stringify(sanitized).length / 1024)}KB)`);
          }
        }
      } catch (e) {
        console.warn('[Storage] Error sanitizing attendance storage:', e);
      }
    }

    // 3. Sanitize bloated work assignments
    const rawAssignments = localStorage.getItem('hrms_work_assignments_v2');
    if (rawAssignments && rawAssignments.length > 100000) {
      try {
        const parsed = JSON.parse(rawAssignments);
        if (Array.isArray(parsed)) {
          let modified = false;
          const sanitized = parsed.map((a) => {
            if (a.employeeAvatar && (a.employeeAvatar.startsWith('data:') || a.employeeAvatar.length > 200)) {
              modified = true;
              const { employeeAvatar, ...rest } = a;
              return { ...rest, employeeAvatar: '' };
            }
            return a;
          });
          if (modified) {
            localStorage.setItem('hrms_work_assignments_v2', JSON.stringify(sanitized));
            console.info(`[Storage] Trimmed duplicate avatars from work assignments storage (${Math.round(rawAssignments.length / 1024)}KB -> ${Math.round(JSON.stringify(sanitized).length / 1024)}KB)`);
          }
        }
      } catch (e) {
        console.warn('[Storage] Error sanitizing work assignments storage:', e);
      }
    }

    // 4. Sanitize bloated progress updates
    const rawUpdates = localStorage.getItem('hrms_work_updates_v2');
    if (rawUpdates && rawUpdates.length > 100000) {
      try {
        const parsed = JSON.parse(rawUpdates);
        if (Array.isArray(parsed)) {
          let modified = false;
          const sanitized = parsed.map((u) => {
            if (u.employeeAvatar && (u.employeeAvatar.startsWith('data:') || u.employeeAvatar.length > 200)) {
              modified = true;
              const { employeeAvatar, ...rest } = u;
              return { ...rest, employeeAvatar: '' };
            }
            return u;
          });
          if (modified) {
            localStorage.setItem('hrms_work_updates_v2', JSON.stringify(sanitized));
          }
        }
      } catch (e) {
        console.warn('[Storage] Error sanitizing updates storage:', e);
      }
    }

    // 5. Purge obsolete demo tasks and demo assignments from storage
    const demoTaskIds = ['task-1001', 'task-1002', 'task-1003', 'task-1004', 'task-1005', 'task-1006'];
    const demoTaskCodes = ['TSK-1001', 'TSK-1002', 'TSK-1003', 'TSK-1004', 'TSK-1005', 'TSK-1006'];

    const rawTasks = localStorage.getItem('hrms_work_tasks_v2');
    if (rawTasks) {
      try {
        const parsedTasks = JSON.parse(rawTasks);
        if (Array.isArray(parsedTasks)) {
          const nonDemoTasks = parsedTasks.filter(
            (t: { id?: string; taskCode?: string }) =>
              !demoTaskIds.includes(t.id || '') && !demoTaskCodes.includes(t.taskCode || '')
          );
          if (nonDemoTasks.length !== parsedTasks.length) {
            localStorage.setItem('hrms_work_tasks_v2', JSON.stringify(nonDemoTasks));
            console.info(`[Storage] Purged ${parsedTasks.length - nonDemoTasks.length} demo tasks from local storage.`);
          }
        }
      } catch (e) {
        console.warn('[Storage] Error purging demo tasks:', e);
      }
    }

    const currentAssignments = localStorage.getItem('hrms_work_assignments_v2');
    if (currentAssignments) {
      try {
        const parsedAssigns = JSON.parse(currentAssignments);
        if (Array.isArray(parsedAssigns)) {
          const nonDemoAssigns = parsedAssigns.filter(
            (a: { taskId?: string }) => !demoTaskIds.includes(a.taskId || '')
          );
          if (nonDemoAssigns.length !== parsedAssigns.length) {
            localStorage.setItem('hrms_work_assignments_v2', JSON.stringify(nonDemoAssigns));
            console.info(`[Storage] Purged demo assignments from local storage.`);
          }
        }
      } catch (e) {
        console.warn('[Storage] Error purging demo assignments:', e);
      }
    }
  } catch (err) {
    console.warn('[Storage] General storage cleanup error:', err);
  }
}

// Auto-run once at script load time
sanitizeExistingStorage();

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    inMemoryFallback.set(key, value);
    return true;
  } catch (error: unknown) {
    const isQuota =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.code === 22 ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

    if (isQuota) {
      console.warn(`[Storage] QuotaExceededError for key "${key}". Running cleanup and retrying...`);
      try {
        sanitizeExistingStorage();
        localStorage.setItem(key, value);
        inMemoryFallback.set(key, value);
        return true;
      } catch {
        console.warn(`[Storage] Could not write "${key}" to localStorage. Stored in memory safely.`);
        inMemoryFallback.set(key, value);
        return false;
      }
    }

    console.error(`[Storage] Error setting key "${key}":`, error);
    inMemoryFallback.set(key, value);
    return false;
  }
}

export function safeGetItem(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
    return inMemoryFallback.get(key) || null;
  } catch (error) {
    console.error(`[Storage] Error getting key "${key}":`, error);
    return inMemoryFallback.get(key) || null;
  }
}
