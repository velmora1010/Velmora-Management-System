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

const NAVIGATION_STORAGE_KEY = 'app_navigation_state';

const defaultState: NavigationState = {
  lastActiveDepartment: null,
  departments: {}
};

export const getNavigationState = (): NavigationState => {
  try {
    const saved = localStorage.getItem(NAVIGATION_STORAGE_KEY);
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
  return defaultState;
};

export const saveNavigationState = (state: NavigationState) => {
  try {
    localStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[NAV] Error saving navigation state:', e);
  }
};

export const saveActiveDepartment = (dept: string) => {
  console.log('[NAV] Department changed to:', dept);
  const state = getNavigationState();
  state.lastActiveDepartment = dept;
  saveNavigationState(state);
};

export const getActiveDepartment = (): string | null => {
  return getNavigationState().lastActiveDepartment;
};

export const saveDepartmentNavigation = (
  dept: string, 
  route: string, 
  updates?: Partial<DepartmentNavigation>
) => {
  const state = getNavigationState();
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
  saveNavigationState(state);
};

export const getDepartmentNavigation = (dept: string): DepartmentNavigation | null => {
  const state = getNavigationState();
  return state.departments[dept] || null;
};

export const clearNavigationState = () => {
  try {
    localStorage.removeItem(NAVIGATION_STORAGE_KEY);
    console.log('[NAV] Navigation state cleared');
  } catch (e) {
    console.error('[NAV] Error clearing navigation state:', e);
  }
};
