import { apiClient } from './apiClient';
import { Job, JobFilters, JobsResponse, JobApplication, SavedJob } from '../../types/job';

export const jobAPI = {
  // Get jobs with filters
  async getJobs(filters: JobFilters): Promise<JobsResponse> {
    const response = await apiClient.get('/jobs', { params: filters });
    return response.data;
  },

  // Get single job by slug or ID
  async getJob(identifier: string): Promise<{ job: Job }> {
    const response = await apiClient.get(`/jobs/${identifier}`);
    return response.data;
  },

  // Create new job (employers)
  async createJob(jobData: Partial<Job>): Promise<{ message: string; job: Job }> {
    const response = await apiClient.post('/jobs', jobData);
    return response.data;
  },

  // Update job (employers)
  async updateJob(jobId: string, jobData: Partial<Job>): Promise<{ message: string; job: Job }> {
    const response = await apiClient.put(`/jobs/${jobId}`, jobData);
    return response.data;
  },

  // Delete job (employers)
  async deleteJob(jobId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/jobs/${jobId}`);
    return response.data;
  },

  // Get employer's jobs
  async getEmployerJobs(params?: { status?: string; page?: number; limit?: number }): Promise<{
    jobs: Job[];
    pagination: any;
  }> {
    const response = await apiClient.get('/jobs/employer/my-jobs', { params });
    return response.data;
  },

  // Save/unsave job
  async toggleSaveJob(jobId: string, notes?: string): Promise<{ message: string; saved: boolean }> {
    const response = await apiClient.post(`/jobs/${jobId}/save`, { notes });
    return response.data;
  },

  // Apply to job
  async applyToJob(jobId: string, applicationData: {
    cover_letter?: string;
    resume_url?: string;
    applied_salary_expectation?: number;
  }): Promise<{ message: string; application: JobApplication }> {
    const response = await apiClient.post(`/applications`, {
      job_id: jobId,
      ...applicationData
    });
    return response.data;
  },

  // Get job applications
  async getApplications(params?: { 
    status?: string; 
    page?: number; 
    limit?: number; 
  }): Promise<{
    applications: JobApplication[];
    pagination: any;
  }> {
    const response = await apiClient.get('/applications/my-applications', { params });
    return response.data;
  },

  // Get saved jobs
  async getSavedJobs(params?: { 
    page?: number; 
    limit?: number; 
  }): Promise<{
    savedJobs: SavedJob[];
    pagination: any;
  }> {
    const response = await apiClient.get('/users/saved-jobs', { params });
    return response.data;
  },

  // Search suggestions
  async getSearchSuggestions(query: string): Promise<{
    keywords: string[];
    locations: string[];
    companies: string[];
  }> {
    const response = await apiClient.get('/jobs/suggestions', { params: { q: query } });
    return response.data;
  },

  // Get job statistics
  async getJobStats(): Promise<{
    total_jobs: number;
    jobs_today: number;
    companies: number;
    locations: string[];
  }> {
    const response = await apiClient.get('/jobs/stats');
    return response.data;
  }
};