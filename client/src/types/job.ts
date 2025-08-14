export interface Job {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  location: string;
  remote_ok: boolean;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary';
  experience_min?: number;
  experience_max?: number;
  salary_min?: number;
  salary_max?: number;
  salary_disclosed: boolean;
  currency: string;
  skills_required: string[];
  education_level?: string;
  industry?: string;
  job_function?: string;
  openings_count: number;
  applications_count: number;
  views_count: number;
  is_featured: boolean;
  is_premium: boolean;
  posted_at: string;
  application_deadline?: string;
  status: 'draft' | 'active' | 'paused' | 'expired' | 'closed';
  
  // Company information
  company_id: string;
  company_name: string;
  company_logo?: string;
  company_industry?: string;
  company_size?: string;
  company_verified: boolean;
  
  // User-specific fields
  is_saved?: boolean;
  has_applied?: boolean;
  similar_jobs?: Job[];
}

export interface JobFilters {
  keywords?: string;
  location?: string;
  skills?: string[];
  employment_type?: string[];
  experience_min?: number;
  experience_max?: number;
  salary_min?: number;
  salary_max?: number;
  remote_ok?: boolean;
  company_id?: string;
  industry?: string;
  posted_after?: string;
  sort_by?: 'relevance' | 'date' | 'salary';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface JobsResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: JobFilters;
}

export interface JobApplication {
  id: string;
  job_id: string;
  job_seeker_id: string;
  status: 'applied' | 'viewed' | 'shortlisted' | 'interviewed' | 'rejected' | 'hired';
  cover_letter?: string;
  resume_url?: string;
  applied_salary_expectation?: number;
  ai_match_score?: number;
  recruiter_notes?: string;
  interview_feedback?: any;
  applied_at: string;
  updated_at: string;
  
  // Job details
  job_title?: string;
  job_location?: string;
  company_name?: string;
  company_logo?: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  description?: string;
  website?: string;
  logo_url?: string;
  industry?: string;
  company_size?: string;
  founded_year?: number;
  headquarters?: string;
  company_type?: string;
  verified: boolean;
  rating?: number;
  review_count: number;
  created_at: string;
}

export interface JobAlert {
  id: string;
  name: string;
  keywords: string[];
  location?: string;
  salary_min?: number;
  experience_min?: number;
  employment_type?: string;
  frequency: 'immediate' | 'daily' | 'weekly';
  is_active: boolean;
  last_sent?: string;
  created_at: string;
}

export interface SavedJob {
  id: string;
  job_id: string;
  notes?: string;
  created_at: string;
  job: Job;
}