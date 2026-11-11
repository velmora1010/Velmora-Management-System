/**
 * Human Resources & Employee Portal Module Configuration
 *
 * Central feature flags and availability toggles for HR and Employee portals.
 * Set WORK_ASSIGNMENT_ENABLED = true to reactivate the Work Assignment module
 * across both administrator and employee interfaces without any code changes.
 */

export const WORK_ASSIGNMENT_ENABLED = false;

export const hrModuleConfig = {
  workAssignmentEnabled: WORK_ASSIGNMENT_ENABLED,
} as const;

export default hrModuleConfig;
