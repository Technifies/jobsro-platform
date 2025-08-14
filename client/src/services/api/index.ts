// API Exports
export { default as apiClient, api, uploadClient } from './apiClient';
export { default as authAPI } from './authAPI';
export { default as jobAPI } from './jobAPI';
export { default as adminAPI } from './adminAPI';

// Re-export specific functions for convenience
export {
  // Auth API
  login,
  register,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getCurrentUser,
  updateProfile
} from './authAPI';

export {
  // Job API
  getJobs,
  getJobById,
  searchJobs,
  createJob,
  updateJob,
  deleteJob,
  applyToJob,
  getApplications,
  saveJob,
  unsaveJob,
  getSavedJobs
} from './jobAPI';

export {
  // Admin API
  getDashboard,
  getUsers,
  getUserDetails,
  updateUserStatus,
  getSystemHealth
} from './adminAPI';