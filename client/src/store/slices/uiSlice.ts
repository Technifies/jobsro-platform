import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  // Navigation
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  
  // Modals and dialogs
  loginModalOpen: boolean;
  registerModalOpen: boolean;
  jobApplicationModalOpen: boolean;
  profileModalOpen: boolean;
  
  // Loading states
  globalLoading: boolean;
  uploadingFile: boolean;
  
  // Notifications
  notifications: Notification[];
  
  // Search UI
  searchFiltersOpen: boolean;
  advancedSearchOpen: boolean;
  searchSuggestionsOpen: boolean;
  
  // Theme and preferences
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact' | 'spacious';
  
  // View modes
  jobListViewMode: 'list' | 'grid' | 'card';
  applicationsViewMode: 'table' | 'card';
  
  // Current page state
  currentPage: string;
  breadcrumbs: Breadcrumb[];
  
  // Error states
  errorMessage: string | null;
  successMessage: string | null;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    url: string;
  };
}

interface Breadcrumb {
  label: string;
  href?: string;
  current?: boolean;
}

const initialState: UIState = {
  // Navigation
  sidebarOpen: true,
  mobileMenuOpen: false,
  
  // Modals and dialogs
  loginModalOpen: false,
  registerModalOpen: false,
  jobApplicationModalOpen: false,
  profileModalOpen: false,
  
  // Loading states
  globalLoading: false,
  uploadingFile: false,
  
  // Notifications
  notifications: [],
  
  // Search UI
  searchFiltersOpen: false,
  advancedSearchOpen: false,
  searchSuggestionsOpen: false,
  
  // Theme and preferences
  theme: 'light',
  density: 'comfortable',
  
  // View modes
  jobListViewMode: 'list',
  applicationsViewMode: 'table',
  
  // Current page state
  currentPage: '',
  breadcrumbs: [],
  
  // Error states
  errorMessage: null,
  successMessage: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Navigation
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleMobileMenu: (state) => {
      state.mobileMenuOpen = !state.mobileMenuOpen;
    },
    setMobileMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.mobileMenuOpen = action.payload;
    },

    // Modals
    setLoginModalOpen: (state, action: PayloadAction<boolean>) => {
      state.loginModalOpen = action.payload;
      if (action.payload) {
        state.registerModalOpen = false;
      }
    },
    setRegisterModalOpen: (state, action: PayloadAction<boolean>) => {
      state.registerModalOpen = action.payload;
      if (action.payload) {
        state.loginModalOpen = false;
      }
    },
    setJobApplicationModalOpen: (state, action: PayloadAction<boolean>) => {
      state.jobApplicationModalOpen = action.payload;
    },
    setProfileModalOpen: (state, action: PayloadAction<boolean>) => {
      state.profileModalOpen = action.payload;
    },

    // Loading states
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload;
    },
    setUploadingFile: (state, action: PayloadAction<boolean>) => {
      state.uploadingFile = action.payload;
    },

    // Notifications
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: Date.now(),
        read: false,
      };
      state.notifications = [notification, ...state.notifications].slice(0, 50); // Keep last 50
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    markAllNotificationsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },

    // Search UI
    setSearchFiltersOpen: (state, action: PayloadAction<boolean>) => {
      state.searchFiltersOpen = action.payload;
    },
    setAdvancedSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.advancedSearchOpen = action.payload;
    },
    setSearchSuggestionsOpen: (state, action: PayloadAction<boolean>) => {
      state.searchSuggestionsOpen = action.payload;
    },

    // Theme and preferences
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('jobsro_theme', action.payload);
      }
    },
    setDensity: (state, action: PayloadAction<'comfortable' | 'compact' | 'spacious'>) => {
      state.density = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jobsro_density', action.payload);
      }
    },

    // View modes
    setJobListViewMode: (state, action: PayloadAction<'list' | 'grid' | 'card'>) => {
      state.jobListViewMode = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jobsro_job_view_mode', action.payload);
      }
    },
    setApplicationsViewMode: (state, action: PayloadAction<'table' | 'card'>) => {
      state.applicationsViewMode = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jobsro_applications_view_mode', action.payload);
      }
    },

    // Page state
    setCurrentPage: (state, action: PayloadAction<string>) => {
      state.currentPage = action.payload;
    },
    setBreadcrumbs: (state, action: PayloadAction<Breadcrumb[]>) => {
      state.breadcrumbs = action.payload;
    },

    // Messages
    setErrorMessage: (state, action: PayloadAction<string | null>) => {
      state.errorMessage = action.payload;
      if (action.payload) {
        state.successMessage = null;
      }
    },
    setSuccessMessage: (state, action: PayloadAction<string | null>) => {
      state.successMessage = action.payload;
      if (action.payload) {
        state.errorMessage = null;
      }
    },
    clearMessages: (state) => {
      state.errorMessage = null;
      state.successMessage = null;
    },

    // Initialize from localStorage
    initializeFromStorage: (state) => {
      if (typeof window !== 'undefined') {
        const theme = localStorage.getItem('jobsro_theme') as 'light' | 'dark' | 'system';
        const density = localStorage.getItem('jobsro_density') as 'comfortable' | 'compact' | 'spacious';
        const jobViewMode = localStorage.getItem('jobsro_job_view_mode') as 'list' | 'grid' | 'card';
        const applicationsViewMode = localStorage.getItem('jobsro_applications_view_mode') as 'table' | 'card';

        if (theme) state.theme = theme;
        if (density) state.density = density;
        if (jobViewMode) state.jobListViewMode = jobViewMode;
        if (applicationsViewMode) state.applicationsViewMode = applicationsViewMode;
      }
    },
  },
});

export const {
  // Navigation
  toggleSidebar,
  setSidebarOpen,
  toggleMobileMenu,
  setMobileMenuOpen,

  // Modals
  setLoginModalOpen,
  setRegisterModalOpen,
  setJobApplicationModalOpen,
  setProfileModalOpen,

  // Loading states
  setGlobalLoading,
  setUploadingFile,

  // Notifications
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,

  // Search UI
  setSearchFiltersOpen,
  setAdvancedSearchOpen,
  setSearchSuggestionsOpen,

  // Theme and preferences
  setTheme,
  setDensity,

  // View modes
  setJobListViewMode,
  setApplicationsViewMode,

  // Page state
  setCurrentPage,
  setBreadcrumbs,

  // Messages
  setErrorMessage,
  setSuccessMessage,
  clearMessages,

  // Initialize
  initializeFromStorage,
} = uiSlice.actions;

// Selectors
export const selectUI = (state: { ui: UIState }) => state.ui;
export const selectSidebarOpen = (state: { ui: UIState }) => state.ui.sidebarOpen;
export const selectMobileMenuOpen = (state: { ui: UIState }) => state.ui.mobileMenuOpen;
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;
export const selectUnreadNotifications = (state: { ui: UIState }) => 
  state.ui.notifications.filter(n => !n.read);
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectJobListViewMode = (state: { ui: UIState }) => state.ui.jobListViewMode;
export const selectCurrentPage = (state: { ui: UIState }) => state.ui.currentPage;
export const selectBreadcrumbs = (state: { ui: UIState }) => state.ui.breadcrumbs;

export type { Notification, Breadcrumb };