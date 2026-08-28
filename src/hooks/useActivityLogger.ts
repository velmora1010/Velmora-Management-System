import { logActivity } from '../services/activityService';

/**
 * Custom React hook for logging user activity.
 * All errors are caught internally to prevent disruption of business workflows.
 */
export const useActivityLogger = () => {
  return { logActivity };
};
