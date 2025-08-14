const express = require('express');
const { query, transaction } = require('../config/database');
const { 
  authenticateJWT, 
  optionalAuth, 
  requireRole, 
  requireVerifiedEmail, 
  requireActiveAccount 
} = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { sendEmail } = require('../services/email');
const logger = require('../utils/logger');

const router = express.Router();

// Get all jobs with filtering and pagination
router.get('/',
  optionalAuth,
  validate(schemas.jobSearch, 'query'),
  async (req, res) => {
    try {
      const {
        keywords,
        location,
        skills,
        employment_type,
        experience_min,
        experience_max,
        salary_min,
        salary_max,
        remote_ok,
        company_id,
        industry,
        posted_after,
        sort_by,
        sort_order,
        page,
        limit
      } = req.query;

      const offset = (page - 1) * limit;
      
      // Build dynamic query
      let whereClause = `WHERE j.status = 'active' AND j.deleted_at IS NULL`;
      let queryParams = [];
      let paramCount = 0;

      // Full-text search on title and description
      if (keywords) {
        whereClause += ` AND (
          to_tsvector('english', j.title || ' ' || j.description) @@ plainto_tsquery('english', $${++paramCount})
          OR j.title ILIKE $${++paramCount}
          OR j.description ILIKE $${++paramCount}
        )`;
        queryParams.push(keywords, `%${keywords}%`, `%${keywords}%`);
      }

      // Location filter
      if (location) {
        whereClause += ` AND (j.location ILIKE $${++paramCount} OR j.remote_ok = true)`;
        queryParams.push(`%${location}%`);
      }

      // Skills filter
      if (skills && skills.length > 0) {
        whereClause += ` AND j.skills_required && $${++paramCount}`;
        queryParams.push(skills);
      }

      // Employment type filter
      if (employment_type && employment_type.length > 0) {
        whereClause += ` AND j.employment_type = ANY($${++paramCount})`;
        queryParams.push(employment_type);
      }

      // Experience range filter
      if (experience_min !== undefined) {
        whereClause += ` AND (j.experience_max >= $${++paramCount} OR j.experience_max IS NULL)`;
        queryParams.push(experience_min);
      }
      
      if (experience_max !== undefined) {
        whereClause += ` AND (j.experience_min <= $${++paramCount} OR j.experience_min IS NULL)`;
        queryParams.push(experience_max);
      }

      // Salary filter
      if (salary_min !== undefined) {
        whereClause += ` AND (j.salary_max >= $${++paramCount} OR j.salary_max IS NULL)`;
        queryParams.push(salary_min);
      }

      if (salary_max !== undefined) {
        whereClause += ` AND (j.salary_min <= $${++paramCount} OR j.salary_min IS NULL)`;
        queryParams.push(salary_max);
      }

      // Remote work filter
      if (remote_ok !== undefined) {
        whereClause += ` AND j.remote_ok = $${++paramCount}`;
        queryParams.push(remote_ok);
      }

      // Company filter
      if (company_id) {
        whereClause += ` AND j.company_id = $${++paramCount}`;
        queryParams.push(company_id);
      }

      // Industry filter
      if (industry) {
        whereClause += ` AND j.industry ILIKE $${++paramCount}`;
        queryParams.push(`%${industry}%`);
      }

      // Posted after filter
      if (posted_after) {
        whereClause += ` AND j.posted_at >= $${++paramCount}`;
        queryParams.push(posted_after);
      }

      // Build ORDER BY clause
      let orderClause = 'ORDER BY ';
      if (sort_by === 'salary') {
        orderClause += `COALESCE(j.salary_max, j.salary_min, 0) ${sort_order.toUpperCase()}, `;
      } else if (sort_by === 'date') {
        orderClause += `j.posted_at ${sort_order.toUpperCase()}, `;
      } else if (sort_by === 'relevance' && keywords) {
        orderClause += `ts_rank(to_tsvector('english', j.title || ' ' || j.description), plainto_tsquery('english', $1)) DESC, `;
      }
      
      // Always include featured and premium jobs first, then by creation date
      orderClause += `j.is_featured DESC, j.is_premium DESC, j.created_at DESC`;

      // Main query
      const jobsQuery = `
        SELECT 
          j.id, j.title, j.slug, j.description, j.location, j.remote_ok,
          j.employment_type, j.experience_min, j.experience_max,
          j.salary_min, j.salary_max, j.salary_disclosed, j.currency,
          j.skills_required, j.education_level, j.industry, j.job_function,
          j.openings_count, j.applications_count, j.views_count,
          j.is_featured, j.is_premium, j.posted_at, j.application_deadline,
          c.id as company_id, c.name as company_name, c.logo_url as company_logo,
          c.industry as company_industry, c.company_size, c.verified as company_verified,
          CASE WHEN $${paramCount + 1} IS NOT NULL THEN
            (SELECT COUNT(*) FROM saved_jobs sj WHERE sj.job_id = j.id AND sj.job_seeker_id = $${paramCount + 1})
          ELSE 0 END as is_saved
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        ${whereClause}
        ${orderClause}
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      queryParams.push(req.user?.role === 'job_seeker' ? req.user.id : null, limit, offset);

      // Count query for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        ${whereClause}
      `;

      // Execute queries
      const [jobsResult, countResult] = await Promise.all([
        query(jobsQuery, queryParams),
        query(countQuery, queryParams.slice(0, paramCount - 2)) // Remove limit, offset, and user_id
      ]);

      const jobs = jobsResult.rows;
      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      // Update view counts for jobs (async, don't wait)
      if (jobs.length > 0) {
        const jobIds = jobs.map(job => job.id);
        query(
          'UPDATE jobs SET views_count = views_count + 1 WHERE id = ANY($1)',
          [jobIds]
        ).catch(error => logger.warn('Failed to update job view counts:', error));
      }

      res.json({
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          keywords,
          location,
          skills,
          employment_type,
          experience_range: experience_min !== undefined || experience_max !== undefined ? 
            { min: experience_min, max: experience_max } : null,
          salary_range: salary_min !== undefined || salary_max !== undefined ? 
            { min: salary_min, max: salary_max } : null,
          remote_ok,
          company_id,
          industry,
          posted_after
        }
      });
    } catch (error) {
      logger.error('Get jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  }
);

// Get single job by ID or slug
router.get('/:identifier',
  optionalAuth,
  async (req, res) => {
    try {
      const { identifier } = req.params;
      
      // Check if identifier is UUID or slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      const jobQuery = `
        SELECT 
          j.*, 
          c.id as company_id, c.name as company_name, c.logo_url as company_logo,
          c.description as company_description, c.website as company_website,
          c.industry as company_industry, c.company_size, c.founded_year,
          c.headquarters, c.verified as company_verified, c.rating as company_rating,
          e.user_id as employer_user_id,
          u.first_name as employer_first_name, u.last_name as employer_last_name,
          CASE WHEN $2 IS NOT NULL THEN
            (SELECT COUNT(*) FROM saved_jobs sj WHERE sj.job_id = j.id AND sj.job_seeker_id = $2)
          ELSE 0 END as is_saved,
          CASE WHEN $2 IS NOT NULL THEN
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.job_seeker_id = $2)
          ELSE 0 END as has_applied
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN employers e ON j.employer_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        WHERE ${isUUID ? 'j.id = $1' : 'j.slug = $1'}
          AND j.status = 'active' AND j.deleted_at IS NULL
      `;

      const result = await query(jobQuery, [
        identifier,
        req.user?.role === 'job_seeker' ? req.user.id : null
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const job = result.rows[0];

      // Update view count (async)
      query(
        'UPDATE jobs SET views_count = views_count + 1 WHERE id = $1',
        [job.id]
      ).catch(error => logger.warn('Failed to update job view count:', error));

      // Get similar jobs (async)
      const similarJobsPromise = query(
        `SELECT j.id, j.title, j.location, j.salary_min, j.salary_max, j.currency,
                c.name as company_name, c.logo_url as company_logo
         FROM jobs j
         LEFT JOIN companies c ON j.company_id = c.id
         WHERE j.id != $1 AND j.status = 'active' AND j.deleted_at IS NULL
           AND (j.skills_required && $2 OR j.industry = $3 OR j.job_function = $4)
         ORDER BY 
           (CASE WHEN j.skills_required && $2 THEN 3 ELSE 0 END) +
           (CASE WHEN j.industry = $3 THEN 2 ELSE 0 END) +
           (CASE WHEN j.job_function = $4 THEN 1 ELSE 0 END) DESC,
           j.created_at DESC
         LIMIT 6`,
        [job.id, job.skills_required || [], job.industry, job.job_function]
      );

      const similarJobs = await similarJobsPromise.catch(() => ({ rows: [] }));

      res.json({
        job: {
          ...job,
          similar_jobs: similarJobs.rows
        }
      });
    } catch (error) {
      logger.error('Get job error:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  }
);

// Create new job (Employers only)
router.post('/',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  requireVerifiedEmail,
  requireActiveAccount,
  validate(schemas.jobPosting),
  async (req, res) => {
    try {
      const jobData = req.body;
      const userId = req.user.id;

      // Get employer profile
      const employerResult = await query(
        'SELECT * FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Employer profile not found' });
      }

      const employer = employerResult.rows[0];

      // Check if employer has permission to post jobs
      if (!employer.can_post_jobs) {
        return res.status(403).json({ error: 'Permission denied to post jobs' });
      }

      // Check job posting limits based on subscription
      if (employer.subscription_id) {
        const subscriptionCheck = await query(`
          SELECT sp.job_posting_limit, 
                 COUNT(j.id) as jobs_posted_this_month
          FROM subscriptions s
          JOIN subscription_plans sp ON s.plan_id = sp.id
          LEFT JOIN jobs j ON j.employer_id = $1 
            AND j.created_at >= date_trunc('month', CURRENT_DATE)
            AND j.deleted_at IS NULL
          WHERE s.id = $2 AND s.status = 'active'
          GROUP BY sp.job_posting_limit
        `, [employer.id, employer.subscription_id]);

        if (subscriptionCheck.rows.length > 0) {
          const { job_posting_limit, jobs_posted_this_month } = subscriptionCheck.rows[0];
          if (job_posting_limit && jobs_posted_this_month >= job_posting_limit) {
            return res.status(403).json({
              error: 'Job posting limit exceeded for current subscription',
              limit: job_posting_limit,
              used: jobs_posted_this_month
            });
          }
        }
      }

      // Generate unique slug
      const baseSlug = jobData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      
      let slug = baseSlug;
      let counter = 1;
      
      while (true) {
        const existingSlug = await query('SELECT id FROM jobs WHERE slug = $1', [slug]);
        if (existingSlug.rows.length === 0) break;
        slug = `${baseSlug}-${counter++}`;
      }

      // Create job in transaction
      const job = await transaction(async (client) => {
        // Insert job
        const jobResult = await client.query(`
          INSERT INTO jobs (
            employer_id, company_id, title, slug, description, requirements,
            responsibilities, location, remote_ok, employment_type,
            experience_min, experience_max, salary_min, salary_max, salary_disclosed,
            currency, skills_required, education_level, industry, job_function,
            application_deadline, openings_count, is_featured, is_premium,
            status, posted_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, 'active', NOW()
          ) RETURNING *
        `, [
          employer.id, employer.company_id, jobData.title, slug, jobData.description,
          jobData.requirements, jobData.responsibilities, jobData.location,
          jobData.remote_ok, jobData.employment_type, jobData.experience_min,
          jobData.experience_max, jobData.salary_min, jobData.salary_max,
          jobData.salary_disclosed, jobData.currency, jobData.skills_required,
          jobData.education_level, jobData.industry, jobData.job_function,
          jobData.application_deadline, jobData.openings_count,
          jobData.is_featured, jobData.is_premium
        ]);

        // Update employer job count
        await client.query(
          'UPDATE employers SET jobs_posted_count = jobs_posted_count + 1 WHERE id = $1',
          [employer.id]
        );

        return jobResult.rows[0];
      });

      logger.info(`Job created: ${job.title} by employer ${userId}`);

      // Send job alerts to matching candidates (async)
      setTimeout(async () => {
        try {
          await sendJobAlerts(job);
        } catch (error) {
          logger.error('Failed to send job alerts:', error);
        }
      }, 1000);

      res.status(201).json({
        message: 'Job posted successfully',
        job: {
          id: job.id,
          title: job.title,
          slug: job.slug,
          status: job.status,
          posted_at: job.posted_at
        }
      });
    } catch (error) {
      logger.error('Create job error:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  }
);

// Update job (Employers only - own jobs)
router.put('/:id',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  requireVerifiedEmail,
  requireActiveAccount,
  validate(schemas.jobPosting),
  async (req, res) => {
    try {
      const { id } = req.params;
      const jobData = req.body;
      const userId = req.user.id;

      // Check if job exists and user has permission
      const jobCheck = await query(`
        SELECT j.*, e.user_id as employer_user_id
        FROM jobs j
        JOIN employers e ON j.employer_id = e.id
        WHERE j.id = $1 AND j.deleted_at IS NULL
      `, [id]);

      if (jobCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const existingJob = jobCheck.rows[0];

      // Check ownership (admin can edit all)
      if (req.user.role !== 'admin' && existingJob.employer_user_id !== userId) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Update slug if title changed
      let slug = existingJob.slug;
      if (jobData.title !== existingJob.title) {
        const baseSlug = jobData.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50);
        
        slug = baseSlug;
        let counter = 1;
        
        while (true) {
          const existingSlug = await query(
            'SELECT id FROM jobs WHERE slug = $1 AND id != $2',
            [slug, id]
          );
          if (existingSlug.rows.length === 0) break;
          slug = `${baseSlug}-${counter++}`;
        }
      }

      // Update job
      const result = await query(`
        UPDATE jobs SET
          title = $1, slug = $2, description = $3, requirements = $4,
          responsibilities = $5, location = $6, remote_ok = $7, employment_type = $8,
          experience_min = $9, experience_max = $10, salary_min = $11, salary_max = $12,
          salary_disclosed = $13, currency = $14, skills_required = $15,
          education_level = $16, industry = $17, job_function = $18,
          application_deadline = $19, openings_count = $20, is_featured = $21,
          is_premium = $22, updated_at = NOW()
        WHERE id = $23
        RETURNING *
      `, [
        jobData.title, slug, jobData.description, jobData.requirements,
        jobData.responsibilities, jobData.location, jobData.remote_ok,
        jobData.employment_type, jobData.experience_min, jobData.experience_max,
        jobData.salary_min, jobData.salary_max, jobData.salary_disclosed,
        jobData.currency, jobData.skills_required, jobData.education_level,
        jobData.industry, jobData.job_function, jobData.application_deadline,
        jobData.openings_count, jobData.is_featured, jobData.is_premium, id
      ]);

      logger.info(`Job updated: ${result.rows[0].title} by user ${userId}`);

      res.json({
        message: 'Job updated successfully',
        job: result.rows[0]
      });
    } catch (error) {
      logger.error('Update job error:', error);
      res.status(500).json({ error: 'Failed to update job' });
    }
  }
);

// Delete job (soft delete)
router.delete('/:id',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if job exists and user has permission
      const jobCheck = await query(`
        SELECT j.*, e.user_id as employer_user_id
        FROM jobs j
        JOIN employers e ON j.employer_id = e.id
        WHERE j.id = $1 AND j.deleted_at IS NULL
      `, [id]);

      if (jobCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const job = jobCheck.rows[0];

      // Check ownership (admin can delete all)
      if (req.user.role !== 'admin' && job.employer_user_id !== userId) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Soft delete
      await query(
        'UPDATE jobs SET deleted_at = NOW(), status = $1 WHERE id = $2',
        ['closed', id]
      );

      logger.info(`Job deleted: ${job.title} by user ${userId}`);

      res.json({ message: 'Job deleted successfully' });
    } catch (error) {
      logger.error('Delete job error:', error);
      res.status(500).json({ error: 'Failed to delete job' });
    }
  }
);

// Get jobs posted by current employer
router.get('/employer/my-jobs',
  authenticateJWT,
  requireRole('employer'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Get employer ID
      const employerResult = await query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Employer profile not found' });
      }

      const employerId = employerResult.rows[0].id;

      // Build query
      let whereClause = 'WHERE j.employer_id = $1 AND j.deleted_at IS NULL';
      let queryParams = [employerId];

      if (status) {
        whereClause += ' AND j.status = $2';
        queryParams.push(status);
      }

      // Get jobs
      const jobsResult = await query(`
        SELECT j.*, c.name as company_name, c.logo_url as company_logo,
               COUNT(a.id) as applications_count
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN applications a ON j.id = a.job_id
        ${whereClause}
        GROUP BY j.id, c.name, c.logo_url
        ORDER BY j.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM jobs j
        ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        jobs: jobsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      logger.error('Get employer jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  }
);

// Save/Unsave job for job seekers
router.post('/:id/save',
  authenticateJWT,
  requireRole('job_seeker'),
  async (req, res) => {
    try {
      const { id: jobId } = req.params;
      const jobSeekerId = req.user.id;

      // Check if job exists
      const jobExists = await query(
        'SELECT id FROM jobs WHERE id = $1 AND status = $2 AND deleted_at IS NULL',
        [jobId, 'active']
      );

      if (jobExists.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Get job seeker profile
      const jobSeekerResult = await query(
        'SELECT id FROM job_seekers WHERE user_id = $1',
        [jobSeekerId]
      );

      if (jobSeekerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job seeker profile not found' });
      }

      const jobSeekerProfileId = jobSeekerResult.rows[0].id;

      // Check if already saved
      const existingSave = await query(
        'SELECT id FROM saved_jobs WHERE job_seeker_id = $1 AND job_id = $2',
        [jobSeekerProfileId, jobId]
      );

      if (existingSave.rows.length > 0) {
        // Unsave
        await query(
          'DELETE FROM saved_jobs WHERE job_seeker_id = $1 AND job_id = $2',
          [jobSeekerProfileId, jobId]
        );
        
        res.json({ message: 'Job removed from saved list', saved: false });
      } else {
        // Save
        await query(
          'INSERT INTO saved_jobs (job_seeker_id, job_id, notes) VALUES ($1, $2, $3)',
          [jobSeekerProfileId, jobId, req.body.notes || null]
        );
        
        res.json({ message: 'Job saved successfully', saved: true });
      }
    } catch (error) {
      logger.error('Save job error:', error);
      res.status(500).json({ error: 'Failed to save/unsave job' });
    }
  }
);

// Job alert matching function
const sendJobAlerts = async (job) => {
  try {
    // Find matching job alerts
    const alertsResult = await query(`
      SELECT ja.*, js.user_id, u.email, u.first_name
      FROM job_alerts ja
      JOIN job_seekers js ON ja.job_seeker_id = js.id
      JOIN users u ON js.user_id = u.id
      WHERE ja.is_active = true 
        AND u.status = 'active'
        AND (ja.last_sent IS NULL OR ja.last_sent < NOW() - INTERVAL '1 day')
        AND (
          (ja.keywords IS NULL OR $1 ILIKE ANY(ja.keywords))
          OR (ja.location IS NULL OR $2 ILIKE '%' || ja.location || '%')
          OR (ja.salary_min IS NULL OR $3 >= ja.salary_min)
          OR (ja.experience_min IS NULL OR $4 >= ja.experience_min)
          OR (ja.employment_type IS NULL OR $5 = ja.employment_type)
        )
    `, [
      job.title + ' ' + job.description,
      job.location,
      job.salary_max,
      job.experience_max,
      job.employment_type
    ]);

    // Send emails to matching candidates
    const emailPromises = alertsResult.rows.map(alert => 
      sendEmail({
        to: alert.email,
        template: 'job-alert',
        data: {
          name: alert.first_name,
          jobCount: 1,
          jobs: [{
            title: job.title,
            companyName: job.company_name,
            location: job.location,
            salary: job.salary_disclosed ? 
              `₹${job.salary_min}-${job.salary_max}` : 'Salary not disclosed',
            summary: job.description.substring(0, 200) + '...',
            jobUrl: `${process.env.FRONTEND_URL}/jobs/${job.slug}`
          }],
          viewAllUrl: `${process.env.FRONTEND_URL}/jobs`,
          unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe?token=${alert.id}`
        }
      }).then(() => {
        // Update last_sent timestamp
        return query(
          'UPDATE job_alerts SET last_sent = NOW() WHERE id = $1',
          [alert.id]
        );
      })
    );

    await Promise.allSettled(emailPromises);
    logger.info(`Job alerts sent for job: ${job.title}`);
  } catch (error) {
    logger.error('Send job alerts error:', error);
  }
};

module.exports = router;