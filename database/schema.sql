-- JobsRo - Complete Database Schema for National Jobs Portal
-- PostgreSQL Schema with AI Features, Video Interviews, and Comprehensive Job Management

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- User Types Enum
CREATE TYPE user_role AS ENUM ('job_seeker', 'employer', 'recruiter', 'admin');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'deactivated');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'expired', 'cancelled');
CREATE TYPE job_status AS ENUM ('draft', 'active', 'paused', 'expired', 'closed');
CREATE TYPE application_status AS ENUM ('applied', 'viewed', 'shortlisted', 'interviewed', 'rejected', 'hired');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE interview_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

-- Core Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role NOT NULL,
    status account_status DEFAULT 'pending',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    profile_image TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Social Login Providers
CREATE TABLE social_logins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'linkedin', 'facebook'
    provider_id VARCHAR(255) NOT NULL,
    provider_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id)
);

-- Job Seekers Profile
CREATE TABLE job_seekers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    headline VARCHAR(200),
    summary TEXT,
    current_location VARCHAR(100),
    preferred_locations TEXT[], -- Array of preferred locations
    expected_salary_min INTEGER,
    expected_salary_max INTEGER,
    currency VARCHAR(10) DEFAULT 'INR',
    experience_years INTEGER,
    current_company VARCHAR(100),
    current_position VARCHAR(100),
    notice_period_days INTEGER,
    resume_url TEXT,
    resume_parsed_data JSONB, -- AI parsed resume data
    skills TEXT[], -- Array of skills
    certifications JSONB, -- Array of certifications
    languages TEXT[],
    availability_status VARCHAR(50) DEFAULT 'actively_looking',
    profile_completion_score INTEGER DEFAULT 0,
    ai_profile_score JSONB, -- AI generated profile analysis
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Education Details
CREATE TABLE education (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_seeker_id UUID REFERENCES job_seekers(id) ON DELETE CASCADE,
    institution VARCHAR(200),
    degree VARCHAR(100),
    field_of_study VARCHAR(100),
    start_date DATE,
    end_date DATE,
    grade VARCHAR(20),
    description TEXT,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Work Experience
CREATE TABLE work_experience (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_seeker_id UUID REFERENCES job_seekers(id) ON DELETE CASCADE,
    company_name VARCHAR(200),
    position VARCHAR(100),
    location VARCHAR(100),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    description TEXT,
    skills_used TEXT[],
    achievements TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE,
    description TEXT,
    website VARCHAR(255),
    logo_url TEXT,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    founded_year INTEGER,
    headquarters VARCHAR(100),
    company_type VARCHAR(50), -- 'startup', 'corporate', 'non_profit', etc.
    verified BOOLEAN DEFAULT FALSE,
    rating DECIMAL(2,1),
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employers Profile
CREATE TABLE employers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id),
    designation VARCHAR(100),
    department VARCHAR(100),
    is_company_admin BOOLEAN DEFAULT FALSE,
    can_post_jobs BOOLEAN DEFAULT TRUE,
    can_access_resumes BOOLEAN DEFAULT FALSE,
    subscription_id UUID, -- Reference to subscription
    jobs_posted_count INTEGER DEFAULT 0,
    credits_remaining INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recruiters Profile
CREATE TABLE recruiters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    agency_name VARCHAR(200),
    specialization TEXT[], -- Array of specializations
    license_number VARCHAR(100),
    commission_rate DECIMAL(5,2),
    active_clients INTEGER DEFAULT 0,
    successful_placements INTEGER DEFAULT 0,
    subscription_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'INR',
    billing_cycle VARCHAR(20), -- 'monthly', 'yearly'
    features JSONB, -- Plan features as JSON
    job_posting_limit INTEGER,
    resume_access_limit INTEGER,
    featured_jobs_limit INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    status subscription_status DEFAULT 'trial',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    auto_renew BOOLEAN DEFAULT TRUE,
    razorpay_subscription_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs Table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employer_id UUID REFERENCES employers(id),
    company_id UUID REFERENCES companies(id),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT NOT NULL,
    requirements TEXT,
    responsibilities TEXT,
    location VARCHAR(100),
    remote_ok BOOLEAN DEFAULT FALSE,
    employment_type VARCHAR(50), -- 'full_time', 'part_time', 'contract', 'internship'
    experience_min INTEGER,
    experience_max INTEGER,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_disclosed BOOLEAN DEFAULT FALSE,
    currency VARCHAR(10) DEFAULT 'INR',
    skills_required TEXT[],
    education_level VARCHAR(100),
    industry VARCHAR(100),
    job_function VARCHAR(100),
    status job_status DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    application_deadline TIMESTAMP,
    openings_count INTEGER DEFAULT 1,
    applications_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    ai_matching_score JSONB, -- AI generated job analysis
    posted_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Job Applications
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    job_seeker_id UUID REFERENCES job_seekers(id) ON DELETE CASCADE,
    status application_status DEFAULT 'applied',
    cover_letter TEXT,
    resume_url TEXT,
    applied_salary_expectation INTEGER,
    ai_match_score DECIMAL(5,2), -- AI calculated match score
    recruiter_notes TEXT,
    interview_feedback JSONB,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, job_seeker_id)
);

-- Video Interviews
CREATE TABLE video_interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    interviewer_id UUID REFERENCES users(id),
    scheduled_at TIMESTAMP,
    duration_minutes INTEGER DEFAULT 60,
    meeting_platform VARCHAR(50), -- 'google_meet', 'zoom'
    meeting_url TEXT,
    meeting_id VARCHAR(255),
    meeting_password VARCHAR(100),
    status interview_status DEFAULT 'scheduled',
    feedback TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    recording_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    subscription_id UUID REFERENCES subscriptions(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    payment_method VARCHAR(50),
    razorpay_payment_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    status payment_status DEFAULT 'pending',
    payment_date TIMESTAMP,
    description TEXT,
    invoice_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resume Writing Services
CREATE TABLE resume_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_seeker_id UUID REFERENCES job_seekers(id),
    service_type VARCHAR(50), -- 'basic_review', 'professional_rewrite', 'executive_package'
    price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'ordered',
    assigned_writer_id UUID,
    original_resume_url TEXT,
    revised_resume_url TEXT,
    feedback TEXT,
    delivery_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200),
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    sent_via VARCHAR(20)[], -- ['email', 'sms', 'push']
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Alerts
CREATE TABLE job_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_seeker_id UUID REFERENCES job_seekers(id) ON DELETE CASCADE,
    name VARCHAR(100),
    keywords TEXT[],
    location VARCHAR(100),
    salary_min INTEGER,
    experience_min INTEGER,
    employment_type VARCHAR(50),
    frequency VARCHAR(20) DEFAULT 'daily', -- 'immediate', 'daily', 'weekly'
    is_active BOOLEAN DEFAULT TRUE,
    last_sent TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved Jobs
CREATE TABLE saved_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_seeker_id UUID REFERENCES job_seekers(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_seeker_id, job_id)
);

-- Company Reviews
CREATE TABLE company_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    pros TEXT,
    cons TEXT,
    advice_to_management TEXT,
    job_title VARCHAR(100),
    employment_status VARCHAR(50),
    years_at_company INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    is_anonymous BOOLEAN DEFAULT TRUE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Training Data
CREATE TABLE ai_training_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_type VARCHAR(50), -- 'resume_job_match', 'search_query', 'skill_mapping'
    input_data JSONB,
    output_data JSONB,
    feedback_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Analytics
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50),
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_skills ON jobs USING GIN(skills_required);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_applications_job_seeker_id ON applications(job_seeker_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_job_seekers_skills ON job_seekers USING GIN(skills);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Full-text search indexes
CREATE INDEX idx_jobs_search ON jobs USING GIN(to_tsvector('english', title || ' ' || description));
CREATE INDEX idx_companies_search ON companies USING GIN(to_tsvector('english', name || ' ' || description));

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_seekers_updated_at BEFORE UPDATE ON job_seekers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employers_updated_at BEFORE UPDATE ON employers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();