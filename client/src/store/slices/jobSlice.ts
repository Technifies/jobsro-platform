import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { jobAPI } from '../../services/api/jobAPI';
import { Job, JobFilters, JobsResponse, JobApplication, SavedJob } from '../../types/job';

interface JobState {
  // Job listings
  jobs: Job[];
  featuredJobs: Job[];
  currentJob: Job | null;
  
  // Search and filters
  searchFilters: JobFilters;
  searchResults: JobsResponse | null;
  searchLoading: boolean;
  searchError: string | null;
  
  // Job details
  jobLoading: boolean;
  jobError: string | null;
  
  // Applications
  applications: JobApplication[];
  applicationsLoading: boolean;
  applicationsError: string | null;
  
  // Saved jobs
  savedJobs: SavedJob[];
  savedJobsLoading: boolean;
  savedJobsError: string | null;
  
  // UI state
  searchHistory: string[];
  suggestions: {
    keywords: string[];
    locations: string[];
    companies: string[];
  };
}

const initialState: JobState = {
  jobs: [],
  featuredJobs: [],
  currentJob: null,
  
  searchFilters: {
    page: 1,
    limit: 20,
    sort_by: 'relevance',
    sort_order: 'desc'
  },
  searchResults: null,
  searchLoading: false,
  searchError: null,
  
  jobLoading: false,
  jobError: null,
  
  applications: [],
  applicationsLoading: false,
  applicationsError: null,
  
  savedJobs: [],
  savedJobsLoading: false,
  savedJobsError: null,
  
  searchHistory: [],
  suggestions: {
    keywords: [],
    locations: [],
    companies: []
  }
};

// Async Thunks
export const searchJobs = createAsyncThunk(
  'jobs/searchJobs',
  async (filters: JobFilters, { rejectWithValue }) => {
    try {
      const response = await jobAPI.getJobs(filters);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to search jobs');
    }
  }
);

export const getJob = createAsyncThunk(
  'jobs/getJob',
  async (identifier: string, { rejectWithValue }) => {
    try {
      const response = await jobAPI.getJob(identifier);
      return response.job;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch job');
    }
  }
);

export const getFeaturedJobs = createAsyncThunk(
  'jobs/getFeaturedJobs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await jobAPI.getJobs({ 
        limit: 12, 
        sort_by: 'date',
        sort_order: 'desc' 
      });
      return response.jobs.filter(job => job.is_featured || job.is_premium);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch featured jobs');
    }
  }
);

export const applyToJob = createAsyncThunk(
  'jobs/applyToJob',
  async ({ 
    jobId, 
    applicationData 
  }: { 
    jobId: string; 
    applicationData: {
      cover_letter?: string;
      resume_url?: string;
      applied_salary_expectation?: number;
    }
  }, { rejectWithValue }) => {
    try {
      const response = await jobAPI.applyToJob(jobId, applicationData);
      return response.application;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to apply to job');
    }
  }
);

export const toggleSaveJob = createAsyncThunk(
  'jobs/toggleSaveJob',
  async ({ jobId, notes }: { jobId: string; notes?: string }, { rejectWithValue }) => {
    try {
      const response = await jobAPI.toggleSaveJob(jobId, notes);
      return { jobId, saved: response.saved };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to save/unsave job');
    }
  }
);

export const getMyApplications = createAsyncThunk(
  'jobs/getMyApplications',
  async (params?: { status?: string; page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await jobAPI.getApplications(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch applications');
    }
  }
);

export const getSavedJobs = createAsyncThunk(
  'jobs/getSavedJobs',
  async (params?: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await jobAPI.getSavedJobs(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch saved jobs');
    }
  }
);

export const getSearchSuggestions = createAsyncThunk(
  'jobs/getSearchSuggestions',
  async (query: string, { rejectWithValue }) => {
    try {
      const response = await jobAPI.getSearchSuggestions(query);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get suggestions');
    }
  }
);

// Job Slice
export const jobSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    // Clear errors
    clearJobError: (state) => {
      state.jobError = null;
      state.searchError = null;
      state.applicationsError = null;
      state.savedJobsError = null;
    },

    // Update search filters
    setSearchFilters: (state, action: PayloadAction<Partial<JobFilters>>) => {
      state.searchFilters = { ...state.searchFilters, ...action.payload };
    },

    // Reset search filters
    resetSearchFilters: (state) => {
      state.searchFilters = {
        page: 1,
        limit: 20,
        sort_by: 'relevance',
        sort_order: 'desc'
      };
      state.searchResults = null;
    },

    // Add to search history
    addToSearchHistory: (state, action: PayloadAction<string>) => {
      const query = action.payload.trim();
      if (query && !state.searchHistory.includes(query)) {
        state.searchHistory = [query, ...state.searchHistory.slice(0, 9)]; // Keep last 10
      }
    },

    // Clear search history
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },

    // Update job in list (for save/unsave actions)
    updateJobInList: (state, action: PayloadAction<{ jobId: string; updates: Partial<Job> }>) => {
      const { jobId, updates } = action.payload;
      
      // Update in jobs list
      const jobIndex = state.jobs.findIndex(job => job.id === jobId);
      if (jobIndex !== -1) {
        state.jobs[jobIndex] = { ...state.jobs[jobIndex], ...updates };
      }
      
      // Update in featured jobs
      const featuredIndex = state.featuredJobs.findIndex(job => job.id === jobId);
      if (featuredIndex !== -1) {
        state.featuredJobs[featuredIndex] = { ...state.featuredJobs[featuredIndex], ...updates };
      }
      
      // Update current job
      if (state.currentJob && state.currentJob.id === jobId) {
        state.currentJob = { ...state.currentJob, ...updates };
      }
      
      // Update in search results
      if (state.searchResults) {
        const searchIndex = state.searchResults.jobs.findIndex(job => job.id === jobId);
        if (searchIndex !== -1) {
          state.searchResults.jobs[searchIndex] = { 
            ...state.searchResults.jobs[searchIndex], 
            ...updates 
          };
        }
      }
    },

    // Clear current job
    clearCurrentJob: (state) => {
      state.currentJob = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Search Jobs
      .addCase(searchJobs.pending, (state) => {
        state.searchLoading = true;
        state.searchError = null;
      })
      .addCase(searchJobs.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload;
        state.jobs = action.payload.jobs;
        state.searchError = null;
      })
      .addCase(searchJobs.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = action.payload as string;
      })

      // Get Job
      .addCase(getJob.pending, (state) => {
        state.jobLoading = true;
        state.jobError = null;
      })
      .addCase(getJob.fulfilled, (state, action) => {
        state.jobLoading = false;
        state.currentJob = action.payload;
        state.jobError = null;
      })
      .addCase(getJob.rejected, (state, action) => {
        state.jobLoading = false;
        state.jobError = action.payload as string;
        state.currentJob = null;
      })

      // Get Featured Jobs
      .addCase(getFeaturedJobs.fulfilled, (state, action) => {
        state.featuredJobs = action.payload;
      })

      // Apply to Job
      .addCase(applyToJob.fulfilled, (state, action) => {
        // Update job's has_applied status
        const application = action.payload;
        if (application.job_id) {
          state.jobs = state.jobs.map(job => 
            job.id === application.job_id 
              ? { ...job, has_applied: true, applications_count: job.applications_count + 1 }
              : job
          );
          
          if (state.currentJob && state.currentJob.id === application.job_id) {
            state.currentJob.has_applied = true;
            state.currentJob.applications_count += 1;
          }
        }
        
        // Add to applications list
        state.applications = [action.payload, ...state.applications];
      })

      // Toggle Save Job
      .addCase(toggleSaveJob.fulfilled, (state, action) => {
        const { jobId, saved } = action.payload;
        
        // Update all job instances
        state.jobs = state.jobs.map(job => 
          job.id === jobId ? { ...job, is_saved: saved } : job
        );
        
        state.featuredJobs = state.featuredJobs.map(job => 
          job.id === jobId ? { ...job, is_saved: saved } : job
        );
        
        if (state.currentJob && state.currentJob.id === jobId) {
          state.currentJob.is_saved = saved;
        }
        
        if (state.searchResults) {
          state.searchResults.jobs = state.searchResults.jobs.map(job => 
            job.id === jobId ? { ...job, is_saved: saved } : job
          );
        }
        
        // Update saved jobs list if unsaved
        if (!saved) {
          state.savedJobs = state.savedJobs.filter(savedJob => savedJob.job_id !== jobId);
        }
      })

      // Get My Applications
      .addCase(getMyApplications.pending, (state) => {
        state.applicationsLoading = true;
        state.applicationsError = null;
      })
      .addCase(getMyApplications.fulfilled, (state, action) => {
        state.applicationsLoading = false;
        state.applications = action.payload.applications;
        state.applicationsError = null;
      })
      .addCase(getMyApplications.rejected, (state, action) => {
        state.applicationsLoading = false;
        state.applicationsError = action.payload as string;
      })

      // Get Saved Jobs
      .addCase(getSavedJobs.pending, (state) => {
        state.savedJobsLoading = true;
        state.savedJobsError = null;
      })
      .addCase(getSavedJobs.fulfilled, (state, action) => {
        state.savedJobsLoading = false;
        state.savedJobs = action.payload.savedJobs;
        state.savedJobsError = null;
      })
      .addCase(getSavedJobs.rejected, (state, action) => {
        state.savedJobsLoading = false;
        state.savedJobsError = action.payload as string;
      })

      // Get Search Suggestions
      .addCase(getSearchSuggestions.fulfilled, (state, action) => {
        state.suggestions = action.payload;
      });
  },
});

export const {
  clearJobError,
  setSearchFilters,
  resetSearchFilters,
  addToSearchHistory,
  clearSearchHistory,
  updateJobInList,
  clearCurrentJob,
} = jobSlice.actions;

// Selectors
export const selectJobs = (state: { jobs: JobState }) => state.jobs;
export const selectJobsList = (state: { jobs: JobState }) => state.jobs.jobs;
export const selectFeaturedJobs = (state: { jobs: JobState }) => state.jobs.featuredJobs;
export const selectCurrentJob = (state: { jobs: JobState }) => state.jobs.currentJob;
export const selectSearchResults = (state: { jobs: JobState }) => state.jobs.searchResults;
export const selectSearchFilters = (state: { jobs: JobState }) => state.jobs.searchFilters;
export const selectSearchLoading = (state: { jobs: JobState }) => state.jobs.searchLoading;
export const selectJobLoading = (state: { jobs: JobState }) => state.jobs.jobLoading;
export const selectApplications = (state: { jobs: JobState }) => state.jobs.applications;
export const selectSavedJobs = (state: { jobs: JobState }) => state.jobs.savedJobs;
export const selectSearchHistory = (state: { jobs: JobState }) => state.jobs.searchHistory;
export const selectSuggestions = (state: { jobs: JobState }) => state.jobs.suggestions;