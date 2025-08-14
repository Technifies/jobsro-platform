-- Admin Actions Log Table
CREATE TABLE IF NOT EXISTS admin_actions (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    data_type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(category, key)
);

-- Indexes for admin tables
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user_id ON admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Insert default system settings
INSERT INTO system_settings (category, key, value, description, data_type) VALUES
-- General Settings
('general', 'site_name', 'JobsRo', 'Website name', 'string'),
('general', 'site_description', 'Premier job portal connecting talent with opportunities', 'Website description', 'string'),
('general', 'contact_email', 'admin@jobsro.com', 'Contact email address', 'string'),
('general', 'support_email', 'support@jobsro.com', 'Support email address', 'string'),
('general', 'maintenance_mode', 'false', 'Enable maintenance mode', 'boolean'),

-- Job Settings
('jobs', 'max_job_posting_duration', '90', 'Maximum days a job can be active', 'number'),
('jobs', 'auto_expire_jobs', 'true', 'Automatically expire jobs after duration', 'boolean'),
('jobs', 'featured_job_price', '999', 'Price for featured job posting (in rupees)', 'number'),
('jobs', 'urgent_job_price', '499', 'Price for urgent job posting (in rupees)', 'number'),
('jobs', 'max_applications_per_job', '100', 'Maximum applications allowed per job', 'number'),

-- User Settings
('users', 'email_verification_required', 'true', 'Require email verification for new users', 'boolean'),
('users', 'max_login_attempts', '5', 'Maximum login attempts before lockout', 'number'),
('users', 'account_lockout_duration', '30', 'Account lockout duration in minutes', 'number'),
('users', 'password_reset_expiry', '60', 'Password reset token expiry in minutes', 'number'),

-- Payment Settings
('payments', 'razorpay_enabled', 'true', 'Enable Razorpay payments', 'boolean'),
('payments', 'free_job_postings_per_month', '3', 'Free job postings per employer per month', 'number'),
('payments', 'premium_subscription_price', '2999', 'Monthly premium subscription price', 'number'),
('payments', 'pro_subscription_price', '4999', 'Monthly pro subscription price', 'number'),

-- Notification Settings
('notifications', 'email_notifications_enabled', 'true', 'Enable email notifications', 'boolean'),
('notifications', 'sms_notifications_enabled', 'true', 'Enable SMS notifications', 'boolean'),
('notifications', 'push_notifications_enabled', 'false', 'Enable push notifications', 'boolean'),
('notifications', 'daily_job_alerts', 'true', 'Send daily job alerts to job seekers', 'boolean'),

-- AI Settings
('ai', 'openai_enabled', 'true', 'Enable OpenAI features', 'boolean'),
('ai', 'resume_parsing_enabled', 'true', 'Enable AI resume parsing', 'boolean'),
('ai', 'job_matching_enabled', 'true', 'Enable AI job matching', 'boolean'),
('ai', 'match_score_threshold', '60', 'Minimum match score for recommendations', 'number'),

-- Security Settings
('security', 'jwt_expiry_hours', '24', 'JWT token expiry in hours', 'number'),
('security', 'refresh_token_expiry_days', '7', 'Refresh token expiry in days', 'number'),
('security', 'rate_limit_requests_per_minute', '100', 'API rate limit per minute', 'number'),
('security', 'cors_origins', '*', 'Allowed CORS origins', 'string'),

-- File Upload Settings
('uploads', 'max_resume_size_mb', '5', 'Maximum resume file size in MB', 'number'),
('uploads', 'max_company_logo_size_mb', '2', 'Maximum company logo size in MB', 'number'),
('uploads', 'allowed_resume_formats', '["pdf", "doc", "docx", "txt"]', 'Allowed resume file formats', 'json'),
('uploads', 'allowed_image_formats', '["jpg", "jpeg", "png", "gif"]', 'Allowed image formats', 'json')

ON CONFLICT (category, key) DO NOTHING;

-- Report Tables for Analytics
CREATE TABLE IF NOT EXISTS system_reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL,
    report_data JSONB NOT NULL,
    generated_by INTEGER REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_reports_type ON system_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_system_reports_generated_at ON system_reports(generated_at);

-- Content Moderation Table
CREATE TABLE IF NOT EXISTS content_moderation (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL, -- job, user_profile, company, review
    content_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    reason TEXT,
    moderated_by INTEGER REFERENCES users(id),
    moderated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_moderation_type_id ON content_moderation(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_moderation_status ON content_moderation(status);

-- System Announcements Table
CREATE TABLE IF NOT EXISTS system_announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info', -- info, warning, success, error
    target_roles VARCHAR(100)[], -- null for all users, or specific roles
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_announcements_active ON system_announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_system_announcements_dates ON system_announcements(start_date, end_date);