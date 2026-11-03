import { Employee, LeaveRequest, UserProfile } from '../types/hrms';
import { WorkTaskAssignment } from '../types/workAssignment';

/**
 * Checks whether two Employee objects represent the same individual employee record,
 * safely handling legacy localStorage states where two different employees may share a code.
 */
export function isSameEmployeeRecord(
  a: Employee | null | undefined,
  b: Employee | null | undefined
): boolean {
  if (!a || !b) return false;
  if (a === b) return true;

  const emailA = (a.email || '').trim().toLowerCase();
  const emailB = (b.email || '').trim().toLowerCase();
  if (emailA && emailB && emailA !== emailB) {
    return false;
  }

  const nameA = (a.fullName || '').trim().toLowerCase();
  const nameB = (b.fullName || '').trim().toLowerCase();
  if (nameA && nameB && nameA !== nameB) {
    return false;
  }

  const idA = (a.id || '').trim().toUpperCase();
  const idB = (b.id || '').trim().toUpperCase();
  if (idA && idB && idA === idB) return true;

  const codeA = (a.employeeCode || '').trim().toUpperCase();
  const codeB = (b.employeeCode || '').trim().toUpperCase();
  if (codeA && codeB && codeA === codeB) return true;

  return false;
}

/**
 * Resolves the verified Employee record linked to an authenticated UserProfile.
 * Never falls back to an unrelated default employee.
 */
export function findLinkedEmployee(
  user: UserProfile | null | undefined,
  employees: Employee[]
): Employee | undefined {
  if (!user || !Array.isArray(employees) || employees.length === 0) {
    return undefined;
  }

  // Admin accounts without an employee link do not map to an employee profile
  if ((user.role === 'admin' || user.role === 'hr_manager') && !user.employeeId) {
    return undefined;
  }

  const userEmail = (user.email || '').trim().toLowerCase();
  const userName = (user.name || '').trim().toLowerCase();
  const linkKey = typeof user.employeeId === 'string' ? user.employeeId.trim() : '';
  const linkUpper = linkKey.toUpperCase();

  // 1. Exact email match on employee records (most specific when employee codes collide)
  if (userEmail) {
    const byEmail = employees.find(
      (e) => e.email && e.email.trim().toLowerCase() === userEmail
    );
    if (byEmail) return byEmail;
  }

  // 2. Collect candidates matching employeeId / employeeCode
  if (linkUpper) {
    const idCandidates = employees.filter((e) => {
      const empIdUpper = (e.id || '').trim().toUpperCase();
      const empCodeUpper = (e.employeeCode || '').trim().toUpperCase();
      return empIdUpper === linkUpper || empCodeUpper === linkUpper;
    });

    if (idCandidates.length > 0) {
      if (userName) {
        const byNameAndId = idCandidates.find(
          (e) => (e.fullName || '').trim().toLowerCase() === userName
        );
        if (byNameAndId) return byNameAndId;
      }
      if (idCandidates.length === 1) {
        // Verify another employee doesn't explicitly match the authenticated user's full name
        if (userName) {
          const exactNameOther = employees.find(
            (e) => (e.fullName || '').trim().toLowerCase() === userName
          );
          if (exactNameOther) return exactNameOther;
        }
        return idCandidates[0];
      }
    }

    // 3. Canonical numeric suffix match between 'emp-001' and 'EMP-1001' / 'emp-1001'
    const numMatch = linkUpper.match(/^EMP-(\d+)$/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (!isNaN(num) && num > 0) {
        const fullNum = num < 1000 ? 1000 + num : num;
        const shortNum = num >= 1000 ? num - 1000 : num;
        const canonicalCode = `EMP-${fullNum}`;
        const canonicalId = `EMP-${fullNum}`;
        const legacyShortId = `EMP-${String(shortNum).padStart(3, '0')}`;

        const canonicalCandidates = employees.filter((e) => {
          const empIdUpper = (e.id || '').trim().toUpperCase();
          const empCodeUpper = (e.employeeCode || '').trim().toUpperCase();
          return (
            empCodeUpper === canonicalCode ||
            empIdUpper === canonicalId ||
            empIdUpper === legacyShortId
          );
        });

        if (canonicalCandidates.length > 0) {
          if (canonicalCandidates.length === 1) {
            return canonicalCandidates[0];
          }
        }
      }
    }
  }

  // Strict Rule: Never match accounts using display names alone.
  // If neither verified employeeId/code nor verified email matches, account is unlinked.
  return undefined;
}

/**
 * Checks whether a leave request belongs to the given verified Employee record.
 */
export function doesLeaveBelongToEmployee(
  leave: Pick<LeaveRequest, 'employeeId' | 'employeeCode'> & { employeeName?: string },
  emp: Employee
): boolean {
  if (!leave || !emp) return false;
  if (
    leave.employeeName &&
    emp.fullName &&
    leave.employeeName.trim().toLowerCase() !== emp.fullName.trim().toLowerCase()
  ) {
    return false;
  }
  if (leave.employeeId && emp.id && leave.employeeId.trim().toUpperCase() === emp.id.trim().toUpperCase()) {
    return true;
  }
  if (
    leave.employeeCode &&
    emp.employeeCode &&
    leave.employeeCode.trim().toUpperCase() === emp.employeeCode.trim().toUpperCase()
  ) {
    return true;
  }
  if (
    leave.employeeId &&
    emp.employeeCode &&
    leave.employeeId.trim().toUpperCase() === emp.employeeCode.trim().toUpperCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether a work task assignment belongs to the given verified Employee record.
 */
export function doesAssignmentBelongToEmployee(
  assignment: Pick<WorkTaskAssignment, 'employeeId' | 'employeeCode'> & { employeeName?: string },
  emp: Employee | null | undefined
): boolean {
  if (!assignment || !emp) return false;

  if (
    assignment.employeeName &&
    emp.fullName &&
    assignment.employeeName.trim().toLowerCase() !== emp.fullName.trim().toLowerCase()
  ) {
    return false;
  }

  if (
    assignment.employeeId &&
    emp.id &&
    assignment.employeeId.trim().toUpperCase() === emp.id.trim().toUpperCase()
  ) {
    return true;
  }

  if (
    assignment.employeeCode &&
    emp.employeeCode &&
    assignment.employeeCode.trim().toUpperCase() === emp.employeeCode.trim().toUpperCase()
  ) {
    return true;
  }

  if (
    assignment.employeeId &&
    emp.employeeCode &&
    assignment.employeeId.trim().toUpperCase() === emp.employeeCode.trim().toUpperCase()
  ) {
    return true;
  }

  return false;
}
