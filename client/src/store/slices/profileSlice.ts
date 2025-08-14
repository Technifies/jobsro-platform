import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api/apiClient';
import { User } from '../../types/auth';

interface ProfileState {
  profile: any | null;
  isLoading: boolean;
  error: string | null;
  
  // Job seeker specific
  education: EducationItem[];
  experience: ExperienceItem[];
  skills: string[];
  certifications: CertificationItem[];
  
  // Profile completion
  profileCompletionScore: number;
  missingFields: string[];
  
  // Resume
  resumeUrl: string | null;
  resumeUploading: boolean;
  resumeError: string | null;
  
  // Company profile (for employers)
  companyProfile: CompanyProfile | null;
}

interface EducationItem {
  id?: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date?: string;
  grade?: string;
  description?: string;
  is_current: boolean;
}

interface ExperienceItem {
  id?: string;
  company_name: string;
  position: string;
  location: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  description: string;
  skills_used: string[];
  achievements: string[];
}

interface CertificationItem {
  id?: string;
  name: string;
  issuer: string;
  issue_date: string;
  expiry_date?: string;
  credential_id?: string;
  credential_url?: string;
}

interface CompanyProfile {
  id: string;
  name: string;
  description: string;
  website?: string;
  industry?: string;
  company_size?: string;
  founded_year?: number;
  headquarters?: string;
  logo_url?: string;
  verified: boolean;
}

const initialState: ProfileState = {
  profile: null,
  isLoading: false,
  error: null,
  
  education: [],
  experience: [],
  skills: [],
  certifications: [],
  
  profileCompletionScore: 0,
  missingFields: [],
  
  resumeUrl: null,
  resumeUploading: false,
  resumeError: null,
  
  companyProfile: null,
};

// Async Thunks
export const getProfile = createAsyncThunk(
  'profile/getProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch profile');
    }
  }
);

export const updateBasicProfile = createAsyncThunk(
  'profile/updateBasicProfile',
  async (profileData: Partial<User>, { rejectWithValue }) => {
    try {
      const response = await api.put('/users/profile', profileData);
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update profile');
    }
  }
);

export const updateJobSeekerProfile = createAsyncThunk(
  'profile/updateJobSeekerProfile',
  async (profileData: any, { rejectWithValue }) => {
    try {
      const response = await api.put('/users/profile/job-seeker', profileData);
      return response.data.profile;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update job seeker profile');
    }
  }
);

export const addEducation = createAsyncThunk(
  'profile/addEducation',
  async (education: Omit<EducationItem, 'id'>, { rejectWithValue }) => {
    try {
      const response = await api.post('/users/profile/education', education);
      return response.data.education;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add education');
    }
  }
);

export const updateEducation = createAsyncThunk(
  'profile/updateEducation',
  async ({ id, education }: { id: string; education: Partial<EducationItem> }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/users/profile/education/${id}`, education);
      return response.data.education;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update education');
    }
  }
);

export const deleteEducation = createAsyncThunk(
  'profile/deleteEducation',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/users/profile/education/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete education');
    }
  }
);

export const addExperience = createAsyncThunk(
  'profile/addExperience',
  async (experience: Omit<ExperienceItem, 'id'>, { rejectWithValue }) => {
    try {
      const response = await api.post('/users/profile/experience', experience);
      return response.data.experience;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add experience');
    }
  }
);

export const updateExperience = createAsyncThunk(
  'profile/updateExperience',
  async ({ id, experience }: { id: string; experience: Partial<ExperienceItem> }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/users/profile/experience/${id}`, experience);
      return response.data.experience;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update experience');
    }
  }
);

export const deleteExperience = createAsyncThunk(
  'profile/deleteExperience',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/users/profile/experience/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete experience');
    }
  }
);

export const uploadResume = createAsyncThunk(
  'profile/uploadResume',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('resume', file);
      
      const response = await api.upload('/users/profile/resume', formData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to upload resume');
    }
  }
);

// Profile Slice
export const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.resumeError = null;
    },
    
    updateSkills: (state, action: PayloadAction<string[]>) => {
      state.skills = action.payload;
    },
    
    addSkill: (state, action: PayloadAction<string>) => {
      if (!state.skills.includes(action.payload)) {
        state.skills.push(action.payload);
      }
    },
    
    removeSkill: (state, action: PayloadAction<string>) => {
      state.skills = state.skills.filter(skill => skill !== action.payload);
    },
    
    calculateProfileCompletion: (state) => {
      if (!state.profile) return;
      
      const requiredFields = [
        'headline',
        'summary', 
        'current_location',
        'experience_years',
        'skills'
      ];
      
      const optionalFields = [
        'current_company',
        'current_position',
        'expected_salary_min',
        'preferred_locations'
      ];
      
      let score = 0;
      const missingFields: string[] = [];
      
      // Required fields (70% weight)
      const requiredWeight = 70 / requiredFields.length;
      requiredFields.forEach(field => {
        if (state.profile[field] && 
            (Array.isArray(state.profile[field]) ? state.profile[field].length > 0 : true)) {
          score += requiredWeight;
        } else {
          missingFields.push(field);
        }
      });
      
      // Optional fields (20% weight)
      const optionalWeight = 20 / optionalFields.length;
      optionalFields.forEach(field => {
        if (state.profile[field] && 
            (Array.isArray(state.profile[field]) ? state.profile[field].length > 0 : true)) {
          score += optionalWeight;
        }
      });
      
      // Education and experience (10% weight)
      if (state.education.length > 0) score += 5;
      if (state.experience.length > 0) score += 5;
      
      // Resume bonus
      if (state.resumeUrl) score = Math.min(100, score + 5);
      
      state.profileCompletionScore = Math.round(score);
      state.missingFields = missingFields;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get Profile
      .addCase(getProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profile = action.payload.profile;
        if (action.payload.profile.education) {
          state.education = action.payload.profile.education;
        }
        if (action.payload.profile.work_experience) {
          state.experience = action.payload.profile.work_experience;
        }
        if (action.payload.profile.skills) {
          state.skills = action.payload.profile.skills;
        }
        if (action.payload.profile.resume_url) {
          state.resumeUrl = action.payload.profile.resume_url;
        }
        state.error = null;
      })
      .addCase(getProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update Basic Profile
      .addCase(updateBasicProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateBasicProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        // Update basic user info in profile
        if (state.profile) {
          Object.assign(state.profile, action.payload);
        }
        state.error = null;
      })
      .addCase(updateBasicProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update Job Seeker Profile
      .addCase(updateJobSeekerProfile.fulfilled, (state, action) => {
        state.profile = { ...state.profile, ...action.payload };
      })
      
      // Education
      .addCase(addEducation.fulfilled, (state, action) => {
        state.education.push(action.payload);
      })
      .addCase(updateEducation.fulfilled, (state, action) => {
        const index = state.education.findIndex(edu => edu.id === action.payload.id);
        if (index !== -1) {
          state.education[index] = action.payload;
        }
      })
      .addCase(deleteEducation.fulfilled, (state, action) => {
        state.education = state.education.filter(edu => edu.id !== action.payload);
      })
      
      // Experience
      .addCase(addExperience.fulfilled, (state, action) => {
        state.experience.push(action.payload);
      })
      .addCase(updateExperience.fulfilled, (state, action) => {
        const index = state.experience.findIndex(exp => exp.id === action.payload.id);
        if (index !== -1) {
          state.experience[index] = action.payload;
        }
      })
      .addCase(deleteExperience.fulfilled, (state, action) => {
        state.experience = state.experience.filter(exp => exp.id !== action.payload);
      })
      
      // Resume Upload
      .addCase(uploadResume.pending, (state) => {
        state.resumeUploading = true;
        state.resumeError = null;
      })
      .addCase(uploadResume.fulfilled, (state, action) => {
        state.resumeUploading = false;
        state.resumeUrl = action.payload.resume_url;
        state.resumeError = null;
      })
      .addCase(uploadResume.rejected, (state, action) => {
        state.resumeUploading = false;
        state.resumeError = action.payload as string;
      });
  },
});

export const {
  clearError,
  updateSkills,
  addSkill,
  removeSkill,
  calculateProfileCompletion,
} = profileSlice.actions;

// Selectors
export const selectProfile = (state: { profile: ProfileState }) => state.profile;
export const selectProfileData = (state: { profile: ProfileState }) => state.profile.profile;
export const selectEducation = (state: { profile: ProfileState }) => state.profile.education;
export const selectExperience = (state: { profile: ProfileState }) => state.profile.experience;
export const selectSkills = (state: { profile: ProfileState }) => state.profile.skills;
export const selectProfileCompletion = (state: { profile: ProfileState }) => ({
  score: state.profile.profileCompletionScore,
  missingFields: state.profile.missingFields
});
export const selectResumeUrl = (state: { profile: ProfileState }) => state.profile.resumeUrl;

export type { EducationItem, ExperienceItem, CertificationItem, CompanyProfile };