import { api } from './apiClient';

// Admin Dashboard
export const getDashboard = (period: string = '30d') => {
  return api.get(`/admin/dashboard?period=${period}`);
};

// User Management
export const getUsers = (params: {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  return api.get(`/admin/users?${queryParams}`);
};

export const getUserDetails = (userId: number) => {
  return api.get(`/admin/users/${userId}`);
};

export const updateUserStatus = (userId: number, data: {
  status: string;
  reason?: string;
}) => {
  return api.patch(`/admin/users/${userId}/status`, data);
};

// Job Management
export const getJobs = (params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  return api.get(`/admin/jobs?${queryParams}`);
};

export const updateJobStatus = (jobId: number, data: {
  status: string;
  reason?: string;
}) => {
  return api.patch(`/admin/jobs/${jobId}/status`, data);
};

// Payment Management
export const getPayments = (params: {
  page?: number;
  limit?: number;
  status?: string;
  user_id?: number;
  start_date?: string;
  end_date?: string;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  return api.get(`/admin/payments?${queryParams}`);
};

// System Settings
export const getSystemSettings = () => {
  return api.get('/admin/settings');
};

export const updateSystemSetting = (category: string, key: string, value: string) => {
  return api.put(`/admin/settings/${category}/${key}`, { value });
};

// Admin Actions Log
export const getAdminActions = (params: {
  page?: number;
  limit?: number;
  admin_user_id?: number;
  action_type?: string;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  return api.get(`/admin/actions?${queryParams}`);
};

// System Health
export const getSystemHealth = () => {
  return api.get('/admin/health');
};

// Content Moderation
export const getContentForModeration = (params: {
  page?: number;
  limit?: number;
  content_type?: string;
  status?: string;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  return api.get(`/admin/moderation?${queryParams}`);
};

export const moderateContent = (moderationId: number, data: {
  status: 'approved' | 'rejected';
  reason?: string;
}) => {
  return api.patch(`/admin/moderation/${moderationId}`, data);
};

// System Announcements
export const getAnnouncements = (params: {
  page?: number;
  limit?: number;
  is_active?: boolean;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  return api.get(`/admin/announcements?${queryParams}`);
};

export const createAnnouncement = (data: {
  title: string;
  message: string;
  type?: string;
  target_roles?: string[];
  start_date?: string;
  end_date?: string;
}) => {
  return api.post('/admin/announcements', data);
};

export const updateAnnouncement = (announcementId: number, data: {
  title?: string;
  message?: string;
  type?: string;
  target_roles?: string[];
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
}) => {
  return api.patch(`/admin/announcements/${announcementId}`, data);
};

export const deleteAnnouncement = (announcementId: number) => {
  return api.delete(`/admin/announcements/${announcementId}`);
};

// Analytics and Reports
export const generateReport = (reportType: string, params: {
  start_date?: string;
  end_date?: string;
  format?: 'json' | 'csv' | 'pdf';
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  return api.post(`/admin/reports/${reportType}?${queryParams}`);
};

export const getAvailableReports = () => {
  return api.get('/admin/reports');
};

// Bulk Operations
export const bulkUpdateUsers = (data: {
  user_ids: number[];
  operation: 'activate' | 'deactivate' | 'suspend' | 'ban';
  reason?: string;
}) => {
  return api.post('/admin/users/bulk-update', data);
};

export const bulkUpdateJobs = (data: {
  job_ids: number[];
  operation: 'activate' | 'deactivate' | 'expire';
  reason?: string;
}) => {
  return api.post('/admin/jobs/bulk-update', data);
};

// System Maintenance
export const enableMaintenanceMode = (data: {
  message?: string;
  estimated_duration?: string;
}) => {
  return api.post('/admin/maintenance/enable', data);
};

export const disableMaintenanceMode = () => {
  return api.post('/admin/maintenance/disable');
};

export const getMaintenanceStatus = () => {
  return api.get('/admin/maintenance/status');
};

// Database Operations
export const runDatabaseCleanup = () => {
  return api.post('/admin/database/cleanup');
};

export const getDatabaseStats = () => {
  return api.get('/admin/database/stats');
};

export const backupDatabase = () => {
  return api.post('/admin/database/backup');
};

export const adminAPI = {
  // Dashboard
  getDashboard,
  
  // User Management
  getUsers,
  getUserDetails,
  updateUserStatus,
  bulkUpdateUsers,
  
  // Job Management
  getJobs,
  updateJobStatus,
  bulkUpdateJobs,
  
  // Payment Management
  getPayments,
  
  // System Settings
  getSystemSettings,
  updateSystemSetting,
  
  // Admin Actions
  getAdminActions,
  
  // System Health
  getSystemHealth,
  
  // Content Moderation
  getContentForModeration,
  moderateContent,
  
  // Announcements
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  
  // Reports
  generateReport,
  getAvailableReports,
  
  // System Maintenance
  enableMaintenanceMode,
  disableMaintenanceMode,
  getMaintenanceStatus,
  
  // Database
  runDatabaseCleanup,
  getDatabaseStats,
  backupDatabase,
};

export default adminAPI;