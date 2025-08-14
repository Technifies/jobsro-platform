const express = require('express');
const { query, transaction } = require('../config/database');
const { 
  authenticateJWT, 
  requireRole, 
  requireVerifiedEmail, 
  requireActiveAccount,
  requireOwnershipOrAdmin 
} = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { sendEmail } = require('../services/email');
const logger = require('../utils/logger');

const router = express.Router();

// Apply job (Job Seekers only)
router.post('/',
  authenticateJWT,
  requireRole('job_seeker'),
  requireVerifiedEmail,
  requireActiveAccount,
  validate(schemas.jobApplication),
  async (req, res) => {
    try {
      const { job_id, cover_letter, resume_url, applied_salary_expectation } = req.body;
      const userId = req.user.id;

      // Get job seeker profile
      const jobSeekerResult = await query(
        'SELECT * FROM job_seekers WHERE user_id = $1',
        [userId]
      );

      if (jobSeekerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job seeker profile not found' });
      }

      const jobSeeker = jobSeekerResult.rows[0];

      // Check if job exists and is active
      const jobResult = await query(`
        SELECT j.*, c.name as company_name, e.user_id as employer_user_id,
               u.email as employer_email, u.first_name as employer_first_name
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN employers e ON j.employer_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        WHERE j.id = $1 AND j.status = 'active' AND j.deleted_at IS NULL
      `, [job_id]);

      if (jobResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found or no longer active' });
      }

      const job = jobResult.rows[0];

      // Check application deadline
      if (job.application_deadline && new Date(job.application_deadline) < new Date()) {
        return res.status(400).json({ error: 'Application deadline has passed' });
      }

      // Check if already applied
      const existingApplication = await query(
        'SELECT id FROM applications WHERE job_id = $1 AND job_seeker_id = $2',
        [job_id, jobSeeker.id]
      );

      if (existingApplication.rows.length > 0) {
        return res.status(409).json({ error: 'You have already applied to this job' });
      }

      // Create application in transaction
      const application = await transaction(async (client) => {
        // Insert application
        const applicationResult = await client.query(`
          INSERT INTO applications (
            job_id, job_seeker_id, cover_letter, resume_url, 
            applied_salary_expectation, status
          ) VALUES ($1, $2, $3, $4, $5, 'applied')
          RETURNING *
        `, [job_id, jobSeeker.id, cover_letter, resume_url, applied_salary_expectation]);

        // Update job applications count
        await client.query(
          'UPDATE jobs SET applications_count = applications_count + 1 WHERE id = $1',
          [job_id]
        );

        return applicationResult.rows[0];
      });

      // Send notification email to employer
      if (job.employer_email) {
        try {
          await sendEmail({
            to: job.employer_email,
            template: 'new-application',
            data: {
              employerName: job.employer_first_name,
              jobTitle: job.title,
              candidateName: `${req.user.first_name} ${req.user.last_name}`,
              candidateEmail: req.user.email,
              applicationUrl: `${process.env.FRONTEND_URL}/employer/candidates/${application.id}`,
              jobUrl: `${process.env.FRONTEND_URL}/jobs/${job.slug}`
            }
          });
        } catch (emailError) {
          logger.error('Failed to send application notification email:', emailError);
        }
      }

      logger.info(`Job application created: Job ${job_id} by user ${userId}`);

      res.status(201).json({
        message: 'Application submitted successfully',
        application: {
          id: application.id,
          job_id: application.job_id,
          status: application.status,
          applied_at: application.applied_at,
          job_title: job.title,
          company_name: job.company_name
        }
      });
    } catch (error) {
      logger.error('Apply job error:', error);
      res.status(500).json({ error: 'Failed to submit application' });
    }
  }
);

// Get job seeker's applications
router.get('/my-applications',
  authenticateJWT,
  requireRole('job_seeker'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Get job seeker profile
      const jobSeekerResult = await query(
        'SELECT id FROM job_seekers WHERE user_id = $1',
        [userId]
      );

      if (jobSeekerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job seeker profile not found' });
      }

      const jobSeekerId = jobSeekerResult.rows[0].id;

      // Build query
      let whereClause = 'WHERE a.job_seeker_id = $1';
      let queryParams = [jobSeekerId];

      if (status) {
        whereClause += ' AND a.status = $2';
        queryParams.push(status);
      }

      // Get applications
      const applicationsResult = await query(`
        SELECT a.*, j.title as job_title, j.slug as job_slug, j.location as job_location,
               j.employment_type, j.salary_min, j.salary_max, j.currency,
               c.name as company_name, c.logo_url as company_logo, c.verified as company_verified,
               vi.scheduled_at as interview_scheduled_at, vi.status as interview_status
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN video_interviews vi ON a.id = vi.application_id
        ${whereClause}
        ORDER BY a.applied_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM applications a
        ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        applications: applicationsResult.rows,
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
      logger.error('Get applications error:', error);
      res.status(500).json({ error: 'Failed to fetch applications' });
    }
  }
);

// Get single application details
router.get('/:id',
  authenticateJWT,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const applicationResult = await query(`
        SELECT a.*, j.title as job_title, j.slug as job_slug, j.description as job_description,
               j.location as job_location, j.employment_type, j.salary_min, j.salary_max, j.currency,
               c.name as company_name, c.logo_url as company_logo, c.website as company_website,
               c.description as company_description, c.verified as company_verified,
               js.user_id as job_seeker_user_id, js.headline as job_seeker_headline,
               js.experience_years, js.current_company, js.current_position,
               js.skills, js.resume_url as profile_resume_url,
               u.first_name as job_seeker_first_name, u.last_name as job_seeker_last_name,
               u.email as job_seeker_email, u.phone as job_seeker_phone,
               emp.user_id as employer_user_id,
               vi.id as interview_id, vi.scheduled_at as interview_scheduled_at,
               vi.duration_minutes, vi.meeting_platform, vi.meeting_url, vi.status as interview_status
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
        LEFT JOIN users u ON js.user_id = u.id
        LEFT JOIN employers emp ON j.employer_id = emp.id
        LEFT JOIN video_interviews vi ON a.id = vi.application_id
        WHERE a.id = $1
      `, [id]);

      if (applicationResult.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const application = applicationResult.rows[0];

      // Check permission (job seeker owns application or employer owns job or admin)
      const hasPermission = 
        req.user.role === 'admin' ||
        application.job_seeker_user_id === userId ||
        application.employer_user_id === userId;

      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({ application });
    } catch (error) {
      logger.error('Get application error:', error);
      res.status(500).json({ error: 'Failed to fetch application' });
    }
  }
);

// Update application status (Employers only)
router.patch('/:id/status',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  requireActiveAccount,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, recruiter_notes } = req.body;
      const userId = req.user.id;

      // Validate status
      const validStatuses = ['viewed', 'shortlisted', 'interviewed', 'rejected', 'hired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Check if application exists and user has permission
      const applicationCheck = await query(`
        SELECT a.*, j.title as job_title, js.user_id as job_seeker_user_id,
               u.email as job_seeker_email, u.first_name as job_seeker_first_name,
               emp.user_id as employer_user_id, c.name as company_name
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
        LEFT JOIN users u ON js.user_id = u.id
        LEFT JOIN employers emp ON j.employer_id = emp.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE a.id = $1
      `, [id]);

      if (applicationCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const application = applicationCheck.rows[0];

      // Check ownership (admin can update all)
      if (req.user.role !== 'admin' && application.employer_user_id !== userId) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Update application status
      const updatedApplication = await query(`
        UPDATE applications SET
          status = $1,
          recruiter_notes = COALESCE($2, recruiter_notes),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [status, recruiter_notes, id]);

      // Send status update email to job seeker
      if (application.job_seeker_email) {
        try {
          const statusMessages = {
            viewed: 'Your application has been viewed by the employer.',
            shortlisted: 'Great news! You have been shortlisted for this position.',
            interviewed: 'You have been selected for an interview.',
            rejected: 'Thank you for your interest. Unfortunately, you were not selected for this position.',
            hired: 'Congratulations! You have been selected for this position.'
          };

          const statusColors = {
            viewed: '#0ea5e9',
            shortlisted: '#10b981',
            interviewed: '#7c3aed',
            rejected: '#ef4444',
            hired: '#10b981'
          };

          await sendEmail({
            to: application.job_seeker_email,
            template: 'application-status',
            data: {
              name: application.job_seeker_first_name,
              jobTitle: application.job_title,
              companyName: application.company_name,
              status: status.charAt(0).toUpperCase() + status.slice(1),
              statusColor: statusColors[status],
              message: statusMessages[status],
              applicationUrl: `${process.env.FRONTEND_URL}/applications/${id}`
            }
          });
        } catch (emailError) {
          logger.error('Failed to send status update email:', emailError);
        }
      }

      logger.info(`Application status updated: ${id} to ${status} by user ${userId}`);

      res.json({
        message: 'Application status updated successfully',
        application: updatedApplication.rows[0]
      });
    } catch (error) {
      logger.error('Update application status error:', error);
      res.status(500).json({ error: 'Failed to update application status' });
    }
  }
);

// Get applications for a job (Employers only)
router.get('/job/:jobId',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Check if user has permission to view applications for this job
      if (req.user.role !== 'admin') {
        const jobCheck = await query(`
          SELECT e.user_id
          FROM jobs j
          JOIN employers e ON j.employer_id = e.id
          WHERE j.id = $1
        `, [jobId]);

        if (jobCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Job not found' });
        }

        if (jobCheck.rows[0].user_id !== userId) {
          return res.status(403).json({ error: 'Permission denied' });
        }
      }

      // Build query
      let whereClause = 'WHERE a.job_id = $1';
      let queryParams = [jobId];

      if (status) {
        whereClause += ' AND a.status = $2';
        queryParams.push(status);
      }

      // Get applications
      const applicationsResult = await query(`
        SELECT a.*, js.headline, js.experience_years, js.current_company, js.current_position,
               js.skills, js.expected_salary_min, js.expected_salary_max,
               u.first_name, u.last_name, u.email, u.phone, u.profile_image,
               vi.scheduled_at as interview_scheduled_at, vi.status as interview_status
        FROM applications a
        JOIN job_seekers js ON a.job_seeker_id = js.id
        JOIN users u ON js.user_id = u.id
        LEFT JOIN video_interviews vi ON a.id = vi.application_id
        ${whereClause}
        ORDER BY a.applied_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM applications a
        ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        applications: applicationsResult.rows,
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
      logger.error('Get job applications error:', error);
      res.status(500).json({ error: 'Failed to fetch applications' });
    }
  }
);

// Withdraw application (Job Seekers only)
router.delete('/:id',
  authenticateJWT,
  requireRole('job_seeker'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if application exists and belongs to user
      const applicationCheck = await query(`
        SELECT a.*, j.title as job_title, js.user_id
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN job_seekers js ON a.job_seeker_id = js.id
        WHERE a.id = $1
      `, [id]);

      if (applicationCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const application = applicationCheck.rows[0];

      if (application.user_id !== userId) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Check if application can be withdrawn
      const nonWithdrawableStatuses = ['hired', 'interviewed'];
      if (nonWithdrawableStatuses.includes(application.status)) {
        return res.status(400).json({ 
          error: `Cannot withdraw application with status: ${application.status}` 
        });
      }

      // Delete application and update job count
      await transaction(async (client) => {
        await client.query('DELETE FROM applications WHERE id = $1', [id]);
        await client.query(
          'UPDATE jobs SET applications_count = applications_count - 1 WHERE id = $1',
          [application.job_id]
        );
      });

      logger.info(`Application withdrawn: ${id} by user ${userId}`);

      res.json({ message: 'Application withdrawn successfully' });
    } catch (error) {
      logger.error('Withdraw application error:', error);
      res.status(500).json({ error: 'Failed to withdraw application' });
    }
  }
);

// Bulk update application statuses (Employers)
router.patch('/bulk/status',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  async (req, res) => {
    try {
      const { application_ids, status, recruiter_notes } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(application_ids) || application_ids.length === 0) {
        return res.status(400).json({ error: 'Application IDs array is required' });
      }

      const validStatuses = ['viewed', 'shortlisted', 'interviewed', 'rejected', 'hired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Verify all applications belong to user's jobs (if not admin)
      if (req.user.role !== 'admin') {
        const permissionCheck = await query(`
          SELECT COUNT(*) as count
          FROM applications a
          JOIN jobs j ON a.job_id = j.id
          JOIN employers e ON j.employer_id = e.id
          WHERE a.id = ANY($1) AND e.user_id = $2
        `, [application_ids, userId]);

        if (parseInt(permissionCheck.rows[0].count) !== application_ids.length) {
          return res.status(403).json({ error: 'Permission denied for some applications' });
        }
      }

      // Update applications
      const result = await query(`
        UPDATE applications SET
          status = $1,
          recruiter_notes = COALESCE($2, recruiter_notes),
          updated_at = NOW()
        WHERE id = ANY($3)
        RETURNING id
      `, [status, recruiter_notes, application_ids]);

      logger.info(`Bulk application status update: ${result.rowCount} applications to ${status} by user ${userId}`);

      res.json({
        message: `${result.rowCount} applications updated successfully`,
        updated_count: result.rowCount
      });
    } catch (error) {
      logger.error('Bulk update applications error:', error);
      res.status(500).json({ error: 'Failed to update applications' });
    }
  }
);

module.exports = router;