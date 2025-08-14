-- JobsRo Production Database Schema
-- PostgreSQL Database Schema for Production Deployment

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('jobSeeker', 'employer', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    email_verified BOOLEAN DEFAULT FALSE,
    phone VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    website VARCHAR(255),
    logo_url TEXT,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    location VARCHAR(255),
    founded_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    location VARCHAR(255) NOT NULL,
    employment_type VARCHAR(50) NOT NULL CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship')),
    experience_level VARCHAR(50) NOT NULL CHECK (experience_level IN ('entry', 'mid', 'senior', 'executive')),
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(3) DEFAULT 'USD',
    category VARCHAR(100),
    requirements TEXT[],
    benefits TEXT[],
    skills TEXT[],
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'closed', 'expired')),
    is_remote BOOLEAN DEFAULT FALSE,
    application_deadline TIMESTAMP,
    posted_by INTEGER REFERENCES users(id),
    views_count INTEGER DEFAULT 0,
    applications_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Job Applications table
CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    cover_letter TEXT,
    resume_url TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn')),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, user_id)
);

-- Insert demo data
INSERT INTO users (email, password, first_name, last_name, role, status, email_verified) VALUES
('admin@jobsro.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLo5u1VhHn2kPLa', 'Admin', 'User', 'admin', 'active', TRUE),
('employer@jobsro.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLo5u1VhHn2kPLa', 'John', 'Employer', 'employer', 'active', TRUE),
('jobseeker@jobsro.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLo5u1VhHn2kPLa', 'Jane', 'Seeker', 'jobSeeker', 'active', TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO companies (name, description, website, industry, company_size, location) VALUES
('TechCorp Inc.', 'Leading technology company specializing in innovative software solutions', 'https://techcorp.com', 'Technology', '501-1000', 'New York, NY'),
('InnovateLabs', 'Cutting-edge research and development company', 'https://innovatelabs.com', 'Research', '51-200', 'San Francisco, CA')
ON CONFLICT DO NOTHING;

INSERT INTO jobs (title, description, company_id, location, employment_type, experience_level, salary_min, salary_max, category, requirements, benefits, skills, status, is_remote, posted_by, expires_at) VALUES
('Senior Full Stack Developer', 'We are looking for an experienced full stack developer to join our dynamic team. You will be responsible for developing and maintaining web applications using modern technologies.', 1, 'New York, NY', 'full-time', 'senior', 100000, 150000, 'Technology', ARRAY['5+ years experience with React and Node.js', 'Strong knowledge of JavaScript and TypeScript', 'Experience with PostgreSQL and Redis'], ARRAY['Competitive salary', 'Health insurance', 'Remote work options', '401(k) matching'], ARRAY['JavaScript', 'React', 'Node.js', 'PostgreSQL', 'TypeScript'], 'active', TRUE, 1, NOW() + INTERVAL '30 days'),
('Frontend React Developer', 'Join our team as a React developer and help build amazing user interfaces. You will work closely with our design team to create responsive and intuitive web applications.', 1, 'San Francisco, CA', 'full-time', 'mid', 80000, 120000, 'Technology', ARRAY['3+ years experience with React', 'Strong CSS and HTML skills', 'Experience with modern build tools'], ARRAY['Flexible working hours', 'Professional development budget', 'Health and dental insurance'], ARRAY['React', 'JavaScript', 'CSS', 'HTML', 'Git'], 'active', TRUE, 1, NOW() + INTERVAL '30 days')
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON job_applications(status);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON job_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();