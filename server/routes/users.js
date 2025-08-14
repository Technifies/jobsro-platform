const express = require('express');
const { query, transaction } = require('../config/database');
const { 
  authenticateJWT, 
  requireVerifiedEmail, 
  requireActiveAccount,
  requireOwnershipOrAdmin 
} = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// Get user profile
router.get('/profile',
  authenticateJWT,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      let profileData = {};
      
      // Get role-specific profile data
      if (userRole === 'job_seeker') {
        const profile = await query(`
          SELECT js.*, 
                 array_agg(DISTINCT e.institution) FILTER (WHERE e.institution IS NOT NULL) as education_institutions,
                 array_agg(DISTINCT we.company_name) FILTER (WHERE we.company_name IS NOT NULL) as work_companies
          FROM job_seekers js
          LEFT JOIN education e ON js.id = e.job_seeker_id
          LEFT JOIN work_experience we ON js.id = we.job_seeker_id
          WHERE js.user_id = $1
          GROUP BY js.id
        `, [userId]);
        
        if (profile.rows.length > 0) {
          profileData = profile.rows[0];
          
          // Get education details
          const education = await query(
            'SELECT * FROM education WHERE job_seeker_id = $1 ORDER BY start_date DESC',
            [profileData.id]
          );
          profileData.education = education.rows;
          
          // Get work experience
          const workExperience = await query(
            'SELECT * FROM work_experience WHERE job_seeker_id = $1 ORDER BY start_date DESC',
            [profileData.id]
          );
          profileData.work_experience = workExperience.rows;
        }
      } else if (userRole === 'employer') {
        const profile = await query(`
          SELECT e.*, c.name as company_name, c.logo_url as company_logo,
                 c.description as company_description, c.website as company_website,
                 c.industry as company_industry, c.company_size, c.verified as company_verified
          FROM employers e
          LEFT JOIN companies c ON e.company_id = c.id
          WHERE e.user_id = $1
        `, [userId]);
        profileData = profile.rows[0] || {};
      } else if (userRole === 'recruiter') {
        const profile = await query(
          'SELECT * FROM recruiters WHERE user_id = $1',
          [userId]
        );
        profileData = profile.rows[0] || {};
      }

      res.json({
        user: req.user,
        profile: profileData
      });
    } catch (error) {
      logger.error('Get user profile error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }
);

// Update user basic info
router.put('/profile',
  authenticateJWT,
  requireActiveAccount,
  validate(schemas.profileUpdate),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { first_name, last_name, phone, profile_image } = req.body;

      const result = await query(`
        UPDATE users SET
          first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          phone = COALESCE($3, phone),
          profile_image = COALESCE($4, profile_image),
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [first_name, last_name, phone, profile_image, userId]);

      logger.info(`User profile updated: ${userId}`);

      res.json({
        message: 'Profile updated successfully',
        user: result.rows[0]
      });
    } catch (error) {
      logger.error('Update user profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Update job seeker profile
router.put('/profile/job-seeker',
  authenticateJWT,
  requireActiveAccount,
  validate(schemas.jobSeekerProfile),
  async (req, res) => {
    try {
      const userId = req.user.id;
      
      if (req.user.role !== 'job_seeker') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const profileData = req.body;

      // Get job seeker profile ID
      const jobSeekerResult = await query(
        'SELECT id FROM job_seekers WHERE user_id = $1',
        [userId]
      );

      if (jobSeekerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job seeker profile not found' });
      }

      const jobSeekerId = jobSeekerResult.rows[0].id;

      // Update profile
      const result = await query(`
        UPDATE job_seekers SET
          headline = COALESCE($1, headline),
          summary = COALESCE($2, summary),
          current_location = COALESCE($3, current_location),
          preferred_locations = COALESCE($4, preferred_locations),
          expected_salary_min = COALESCE($5, expected_salary_min),
          expected_salary_max = COALESCE($6, expected_salary_max),
          currency = COALESCE($7, currency),
          experience_years = COALESCE($8, experience_years),
          current_company = COALESCE($9, current_company),
          current_position = COALESCE($10, current_position),
          notice_period_days = COALESCE($11, notice_period_days),
          skills = COALESCE($12, skills),
          languages = COALESCE($13, languages),
          availability_status = COALESCE($14, availability_status),
          updated_at = NOW()
        WHERE id = $15
        RETURNING *
      `, [
        profileData.headline, profileData.summary, profileData.current_location,
        profileData.preferred_locations, profileData.expected_salary_min,
        profileData.expected_salary_max, profileData.currency, profileData.experience_years,
        profileData.current_company, profileData.current_position,
        profileData.notice_period_days, profileData.skills, profileData.languages,
        profileData.availability_status, jobSeekerId
      ]);

      logger.info(`Job seeker profile updated: ${userId}`);

      res.json({
        message: 'Job seeker profile updated successfully',
        profile: result.rows[0]
      });
    } catch (error) {
      logger.error('Update job seeker profile error:', error);
      res.status(500).json({ error: 'Failed to update job seeker profile' });
    }
  }
);

// Get saved jobs
router.get('/saved-jobs',
  authenticateJWT,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      if (req.user.role !== 'job_seeker') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get job seeker profile
      const jobSeekerResult = await query(
        'SELECT id FROM job_seekers WHERE user_id = $1',
        [userId]
      );

      if (jobSeekerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job seeker profile not found' });
      }

      const jobSeekerId = jobSeekerResult.rows[0].id;

      // Get saved jobs
      const savedJobsResult = await query(`
        SELECT sj.id as saved_job_id, sj.notes, sj.created_at as saved_at,
               j.*, c.name as company_name, c.logo_url as company_logo,
               c.verified as company_verified
        FROM saved_jobs sj
        JOIN jobs j ON sj.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE sj.job_seeker_id = $1 AND j.status = 'active' AND j.deleted_at IS NULL
        ORDER BY sj.created_at DESC
        LIMIT $2 OFFSET $3
      `, [jobSeekerId, limit, offset]);

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM saved_jobs sj
        JOIN jobs j ON sj.job_id = j.id
        WHERE sj.job_seeker_id = $1 AND j.status = 'active' AND j.deleted_at IS NULL
      `, [jobSeekerId]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        savedJobs: savedJobsResult.rows,
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
      logger.error('Get saved jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch saved jobs' });
    }
  }
);

// Delete user account
router.delete('/account',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { confirm_deletion } = req.body;

      if (!confirm_deletion) {
        return res.status(400).json({ 
          error: 'Account deletion must be confirmed by setting confirm_deletion to true' 
        });
      }

      // Soft delete user account
      await query(
        'UPDATE users SET deleted_at = NOW(), status = $1 WHERE id = $2',
        ['deactivated', userId]
      );

      logger.info(`User account deleted: ${userId}`);

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      logger.error('Delete user account error:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }
);

module.exports = router;