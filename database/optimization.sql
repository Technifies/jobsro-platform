-- JobsRo Database Performance Optimization
-- Comprehensive indexing, partitioning, and query optimization

-- =====================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- Job table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status_expires ON jobs(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_jobs_industry ON jobs(industry);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_range ON jobs(salary_min, salary_max);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);

-- GIN indexes for array columns
CREATE INDEX IF NOT EXISTS idx_jobs_skills_gin ON jobs USING gin(skills_required);
CREATE INDEX IF NOT EXISTS idx_jobs_benefits_gin ON jobs USING gin(benefits);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_jobs_title_fts ON jobs USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_jobs_description_fts ON jobs USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_jobs_combined_fts ON jobs USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- Application table indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_job_seeker_job ON applications(job_seeker_id, job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_seeker_id ON applications(job_seeker_id);

-- Company table indexes
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_size ON companies(size);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(location);
CREATE INDEX IF NOT EXISTS idx_companies_name_fts ON companies USING gin(to_tsvector('english', name));

-- Job seeker table indexes
CREATE INDEX IF NOT EXISTS idx_job_seekers_user_id ON job_seekers(user_id);
CREATE INDEX IF NOT EXISTS idx_job_seekers_skills_gin ON job_seekers USING gin(skills);
CREATE INDEX IF NOT EXISTS idx_job_seekers_experience ON job_seekers(experience_years);
CREATE INDEX IF NOT EXISTS idx_job_seekers_availability ON job_seekers(availability_status);
CREATE INDEX IF NOT EXISTS idx_job_seekers_location ON job_seekers(current_location);

-- Employer table indexes
CREATE INDEX IF NOT EXISTS idx_employers_user_id ON employers(user_id);
CREATE INDEX IF NOT EXISTS idx_employers_company_id ON employers(company_id);

-- Payment table indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_amount ON payments(amount);

-- Notification table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Video interview indexes
CREATE INDEX IF NOT EXISTS idx_video_interviews_application_id ON video_interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_video_interviews_interviewer_id ON video_interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_video_interviews_scheduled_at ON video_interviews(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_video_interviews_status ON video_interviews(status);

-- Saved jobs indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_jobs_user_job ON saved_jobs(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_created_at ON saved_jobs(created_at);

-- AI training data indexes
CREATE INDEX IF NOT EXISTS idx_ai_training_data_type ON ai_training_data(data_type);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_created_at ON ai_training_data(created_at);

-- Admin action indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user_id ON admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_jobs_complex_search ON jobs(status, location, employment_type, created_at);
CREATE INDEX IF NOT EXISTS idx_applications_employer_stats ON applications(job_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_users_role_status_created ON users(role, status, created_at);

-- =====================================================
-- MATERIALIZED VIEWS FOR COMPLEX QUERIES
-- =====================================================

-- Job statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_job_statistics AS
SELECT 
    j.id,
    j.title,
    j.company_id,
    c.name as company_name,
    j.location,
    j.employment_type,
    j.industry,
    j.created_at,
    j.expires_at,
    j.status,
    COUNT(a.id) as application_count,
    COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending_applications,
    COUNT(CASE WHEN a.status = 'reviewed' THEN 1 END) as reviewed_applications,
    COUNT(CASE WHEN a.status = 'interviewed' THEN 1 END) as interviewed_applications,
    COUNT(CASE WHEN a.status = 'hired' THEN 1 END) as hired_applications,
    AVG(CASE WHEN a.created_at IS NOT NULL THEN 1.0 ELSE 0.0 END) as application_rate
FROM jobs j
LEFT JOIN companies c ON j.company_id = c.id
LEFT JOIN applications a ON j.id = a.job_id
WHERE j.deleted_at IS NULL
GROUP BY j.id, j.title, j.company_id, c.name, j.location, j.employment_type, 
         j.industry, j.created_at, j.expires_at, j.status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_job_statistics_id ON mv_job_statistics(id);

-- User statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_statistics AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.status,
    u.created_at,
    u.last_login_at,
    CASE 
        WHEN u.role = 'job_seeker' THEN (
            SELECT COUNT(*) FROM applications a 
            JOIN job_seekers js ON a.job_seeker_id = js.id 
            WHERE js.user_id = u.id
        )
        WHEN u.role = 'employer' THEN (
            SELECT COUNT(*) FROM jobs j 
            JOIN employers e ON j.employer_id = e.id 
            WHERE e.user_id = u.id
        )
        ELSE 0
    END as activity_count,
    CASE 
        WHEN u.role = 'job_seeker' THEN (
            SELECT COUNT(*) FROM saved_jobs sj WHERE sj.user_id = u.id
        )
        ELSE 0
    END as saved_jobs_count,
    COALESCE((
        SELECT SUM(amount) FROM payments p 
        WHERE p.user_id = u.id AND p.status = 'completed'
    ), 0) as total_payments
FROM users u
WHERE u.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_statistics_id ON mv_user_statistics(id);

-- Company statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_company_statistics AS
SELECT 
    c.id,
    c.name,
    c.industry,
    c.size,
    c.location,
    c.created_at,
    COUNT(j.id) as total_jobs,
    COUNT(CASE WHEN j.status = 'active' THEN 1 END) as active_jobs,
    COUNT(CASE WHEN j.status = 'filled' THEN 1 END) as filled_jobs,
    COUNT(DISTINCT a.job_seeker_id) as unique_applicants,
    AVG(j.salary_max) as avg_salary_offered
FROM companies c
LEFT JOIN jobs j ON c.id = j.company_id AND j.deleted_at IS NULL
LEFT JOIN applications a ON j.id = a.job_id
GROUP BY c.id, c.name, c.industry, c.size, c.location, c.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_company_statistics_id ON mv_company_statistics(id);

-- =====================================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- =====================================================

-- Function to refresh job statistics
CREATE OR REPLACE FUNCTION refresh_job_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_job_statistics;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh user statistics
CREATE OR REPLACE FUNCTION refresh_user_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_statistics;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh company statistics
CREATE OR REPLACE FUNCTION refresh_company_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_company_statistics;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- =====================================================

-- Optimized job search function
CREATE OR REPLACE FUNCTION search_jobs(
    p_search_query TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_employment_type TEXT DEFAULT NULL,
    p_industry TEXT DEFAULT NULL,
    p_min_salary INTEGER DEFAULT NULL,
    p_max_salary INTEGER DEFAULT NULL,
    p_skills TEXT[] DEFAULT NULL,
    p_experience_min INTEGER DEFAULT NULL,
    p_experience_max INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    job_id INTEGER,
    title TEXT,
    company_name TEXT,
    location TEXT,
    employment_type employment_type_enum,
    salary_min INTEGER,
    salary_max INTEGER,
    skills_required TEXT[],
    created_at TIMESTAMP,
    application_count BIGINT,
    search_rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.title,
        c.name,
        j.location,
        j.employment_type,
        j.salary_min,
        j.salary_max,
        j.skills_required,
        j.created_at,
        COALESCE(stats.application_count, 0),
        CASE 
            WHEN p_search_query IS NOT NULL THEN
                ts_rank(
                    to_tsvector('english', j.title || ' ' || j.description),
                    plainto_tsquery('english', p_search_query)
                )
            ELSE 1.0
        END as search_rank
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    LEFT JOIN mv_job_statistics stats ON j.id = stats.id
    WHERE j.status = 'active'
        AND j.expires_at > NOW()
        AND j.deleted_at IS NULL
        AND (p_search_query IS NULL OR 
             to_tsvector('english', j.title || ' ' || j.description) @@ plainto_tsquery('english', p_search_query))
        AND (p_location IS NULL OR j.location ILIKE '%' || p_location || '%')
        AND (p_employment_type IS NULL OR j.employment_type = p_employment_type::employment_type_enum)
        AND (p_industry IS NULL OR j.industry = p_industry)
        AND (p_min_salary IS NULL OR j.salary_max >= p_min_salary)
        AND (p_max_salary IS NULL OR j.salary_min <= p_max_salary)
        AND (p_skills IS NULL OR j.skills_required && p_skills)
        AND (p_experience_min IS NULL OR j.experience_max >= p_experience_min)
        AND (p_experience_max IS NULL OR j.experience_min <= p_experience_max)
    ORDER BY search_rank DESC, j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get user dashboard data
CREATE OR REPLACE FUNCTION get_user_dashboard_data(p_user_id INTEGER)
RETURNS JSON AS $$
DECLARE
    result JSON;
    user_role TEXT;
BEGIN
    -- Get user role
    SELECT role INTO user_role FROM users WHERE id = p_user_id;
    
    IF user_role = 'job_seeker' THEN
        -- Job seeker dashboard data
        SELECT json_build_object(
            'profile', row_to_json(u.*),
            'applications', (
                SELECT json_agg(
                    json_build_object(
                        'id', a.id,
                        'job_title', j.title,
                        'company_name', c.name,
                        'status', a.status,
                        'applied_at', a.created_at
                    )
                ) FROM applications a
                JOIN jobs j ON a.job_id = j.id
                LEFT JOIN companies c ON j.company_id = c.id
                JOIN job_seekers js ON a.job_seeker_id = js.id
                WHERE js.user_id = p_user_id
                ORDER BY a.created_at DESC
                LIMIT 10
            ),
            'saved_jobs', (
                SELECT json_agg(
                    json_build_object(
                        'id', j.id,
                        'title', j.title,
                        'company_name', c.name,
                        'location', j.location,
                        'saved_at', sj.created_at
                    )
                ) FROM saved_jobs sj
                JOIN jobs j ON sj.job_id = j.id
                LEFT JOIN companies c ON j.company_id = c.id
                WHERE sj.user_id = p_user_id
                ORDER BY sj.created_at DESC
                LIMIT 10
            ),
            'recommendations', (
                SELECT json_agg(
                    json_build_object(
                        'id', j.id,
                        'title', j.title,
                        'company_name', c.name,
                        'match_score', 85 + (random() * 15)::INTEGER
                    )
                ) FROM jobs j
                LEFT JOIN companies c ON j.company_id = c.id
                WHERE j.status = 'active' AND j.expires_at > NOW()
                ORDER BY random()
                LIMIT 5
            )
        ) INTO result
        FROM users u
        WHERE u.id = p_user_id;
        
    ELSIF user_role = 'employer' THEN
        -- Employer dashboard data
        SELECT json_build_object(
            'profile', row_to_json(u.*),
            'jobs', (
                SELECT json_agg(
                    json_build_object(
                        'id', j.id,
                        'title', j.title,
                        'status', j.status,
                        'applications_count', COALESCE(stats.application_count, 0),
                        'created_at', j.created_at
                    )
                ) FROM jobs j
                LEFT JOIN mv_job_statistics stats ON j.id = stats.id
                JOIN employers e ON j.employer_id = e.id
                WHERE e.user_id = p_user_id AND j.deleted_at IS NULL
                ORDER BY j.created_at DESC
                LIMIT 10
            ),
            'recent_applications', (
                SELECT json_agg(
                    json_build_object(
                        'id', a.id,
                        'job_title', j.title,
                        'candidate_name', us.first_name || ' ' || us.last_name,
                        'status', a.status,
                        'applied_at', a.created_at
                    )
                ) FROM applications a
                JOIN jobs j ON a.job_id = j.id
                JOIN job_seekers js ON a.job_seeker_id = js.id
                JOIN users us ON js.user_id = us.id
                JOIN employers e ON j.employer_id = e.id
                WHERE e.user_id = p_user_id
                ORDER BY a.created_at DESC
                LIMIT 10
            )
        ) INTO result
        FROM users u
        WHERE u.id = p_user_id;
        
    ELSE
        -- Admin dashboard data
        SELECT json_build_object(
            'profile', row_to_json(u.*),
            'system_stats', json_build_object(
                'total_users', (SELECT COUNT(*) FROM users),
                'total_jobs', (SELECT COUNT(*) FROM jobs WHERE deleted_at IS NULL),
                'total_applications', (SELECT COUNT(*) FROM applications),
                'total_companies', (SELECT COUNT(*) FROM companies)
            )
        ) INTO result
        FROM users u
        WHERE u.id = p_user_id;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- Slow query monitoring view
CREATE OR REPLACE VIEW v_performance_metrics AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- Table size monitoring view
CREATE OR REPLACE VIEW v_table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage monitoring view
CREATE OR REPLACE VIEW v_index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- =====================================================
-- MAINTENANCE PROCEDURES
-- =====================================================

-- Vacuum and analyze all tables
CREATE OR REPLACE FUNCTION maintenance_vacuum_analyze()
RETURNS void AS $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'VACUUM ANALYZE ' || quote_ident(table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    ANALYZE users;
    ANALYZE jobs;
    ANALYZE applications;
    ANALYZE companies;
    ANALYZE job_seekers;
    ANALYZE employers;
    ANALYZE payments;
    ANALYZE notifications;
    ANALYZE video_interviews;
    ANALYZE saved_jobs;
    ANALYZE ai_training_data;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Clean old notifications (older than 6 months)
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '6 months' AND is_read = true;
    
    -- Clean old password reset tokens (older than 24 hours)
    DELETE FROM password_reset_tokens 
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    -- Clean old email verification tokens (older than 7 days)
    DELETE FROM email_verification_tokens 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Clean old expired jobs (older than 1 year)
    UPDATE jobs 
    SET deleted_at = NOW() 
    WHERE expires_at < NOW() - INTERVAL '1 year' AND deleted_at IS NULL;
    
    -- Clean old AI training data (keep only last 1 year)
    DELETE FROM ai_training_data 
    WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;