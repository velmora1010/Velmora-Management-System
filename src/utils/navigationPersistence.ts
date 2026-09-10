export interface DepartmentNavigation {
  route: string;
  marketingView?: 'home' | 'influencer-dashboard' | 'influence-db';
  dashboardView?: 'overview' | 'create-campaign' | 'campaign-details';
  campaignView?: 'overview' | 'add-influencer' | 'influencer-list' | 'dispatched-list' | 'status-tracking' | 'calendar' | 'analytics';
  selectedCampaignId?: string;
  editingInfluencerId?: string;
  activeTab?: string;
  updatedAt: string;
}

export interface NavigationState {
  lastActiveDepartment: string | null;
  departments: Record<string, DepartmentNavigation>;
}

const BASE_STORAGE_KEY = 'app_navigation_state';

const getCurrentUserId = (): string | null => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed?.user?.id) {
            return parsed.user.id;
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
};

export const getNavigationStorageKey = (userId?: string | null): string => {
  const uid = userId !== undefined ? userId : getCurrentUserId();
  return uid ? `${BASE_STORAGE_KEY}_${uid}` : BASE_STORAGE_KEY;
};

const defaultState: NavigationState = {
  lastActiveDepartment: null,
  departments: {}
};

export const getNavigationState = (userId?: string | null): NavigationState => {
  try {
    const key = getNavigationStorageKey(userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          lastActiveDepartment: parsed.lastActiveDepartment || null,
          departments: parsed.departments || {}
        };
      }
    }
  } catch (e) {
    console.error('[NAV] Error reading navigation state:', e);
  }
  return { ...defaultState };
};

export const saveNavigationState = (state: NavigationState, userId?: string | null) => {
  try {
    const key = getNavigationStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error('[NAV] Error saving navigation state:', e);
  }
};

export const saveActiveDepartment = (dept: string, userId?: string | null) => {
  console.log('[NAV] Department changed to:', dept);
  const state = getNavigationState(userId);
  state.lastActiveDepartment = dept;
  saveNavigationState(state, userId);
};

export const getActiveDepartment = (userId?: string | null): string | null => {
  return getNavigationState(userId).lastActiveDepartment;
};

export const saveDepartmentNavigation = (
  dept: string, 
  route: string, 
  updates?: Partial<DepartmentNavigation>,
  userId?: string | null
) => {
  const state = getNavigationState(userId);
  const existing = state.departments[dept] || { route, updatedAt: new Date().toISOString() };
  
  state.departments[dept] = {
    ...existing,
    route,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  // Also keep lastActiveDepartment up to date
  state.lastActiveDepartment = dept;
  
  console.log('[NAV] Saving navigation state for', dept, 'route:', route, 'updates:', updates);
  saveNavigationState(state, userId);
};

export const getDepartmentNavigation = (dept: string, userId?: string | null): DepartmentNavigation | null => {
  const state = getNavigationState(userId);
  return state.departments[dept] || null;
};

export const clearNavigationState = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key === BASE_STORAGE_KEY || key.startsWith(`${BASE_STORAGE_KEY}_`))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    console.log('[NAV] All user navigation state cleared');
  } catch (e) {
    console.error('[NAV] Error clearing navigation state:', e);
  }
};

