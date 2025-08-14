const express = require('express');
const { query } = require('../config/database');
const { 
  authenticateJWT, 
  requireRole, 
  requireVerifiedEmail, 
  requireActiveAccount 
} = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const videoInterviewService = require('../services/videoInterviewService');
const logger = require('../utils/logger');

const router = express.Router();

// Schedule video interview (Employers only)
router.post('/schedule',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  requireVerifiedEmail,
  requireActiveAccount,
  validate(schemas.videoInterview),
  async (req, res) => {
    try {
      const { 
        application_id, 
        scheduled_at, 
        duration_minutes = 60, 
        meeting_platform = 'google_meet',
        notes = ''
      } = req.body;
      
      const interviewerId = req.user.id;

      // Verify application exists and user has permission
      const applicationCheck = await query(`
        SELECT a.id, j.title as job_title, e.user_id as employer_user_id
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN employers e ON j.employer_id = e.id
        WHERE a.id = $1
      `, [application_id]);

      if (applicationCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const application = applicationCheck.rows[0];

      // Check permission (admin can schedule for any job)
      if (req.user.role !== 'admin' && application.employer_user_id !== interviewerId) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Validate scheduled time (must be in future)
      const scheduledDate = new Date(scheduled_at);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Interview must be scheduled for a future time' });
      }

      // Check for scheduling conflicts
      const conflictCheck = await query(`
        SELECT id FROM video_interviews
        WHERE interviewer_id = $1
          AND status IN ('scheduled', 'in_progress')
          AND scheduled_at BETWEEN $2 - INTERVAL '${duration_minutes} minutes' 
          AND $2 + INTERVAL '${duration_minutes} minutes'
      `, [interviewerId, scheduled_at]);

      if (conflictCheck.rows.length > 0) {
        return res.status(409).json({ 
          error: 'You have a scheduling conflict with another interview' 
        });
      }

      const result = await videoInterviewService.scheduleInterview({
        applicationId: application_id,
        interviewerId,
        scheduledAt: scheduled_at,
        durationMinutes: duration_minutes,
        platform: meeting_platform,
        notes
      });

      logger.info(`Interview scheduled by user ${interviewerId} for application ${application_id}`);

      res.status(201).json({
        message: 'Interview scheduled successfully',
        interview: result.interview,
        meeting_details: result.meetingDetails
      });
    } catch (error) {
      logger.error('Schedule interview error:', error);
      res.status(500).json({ error: 'Failed to schedule interview' });
    }
  }
);

// Get user's interviews
router.get('/my-interviews',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, upcoming_only, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = '';
      let queryParams = [];
      
      if (req.user.role === 'job_seeker') {
        whereClause = 'WHERE js.user_id = $1';
        queryParams = [userId];
      } else if (req.user.role === 'employer') {
        whereClause = 'WHERE vi.interviewer_id = $1';
        queryParams = [userId];
      } else {
        return res.status(403).json({ error: 'Invalid user role' });
      }

      if (status) {
        whereClause += ` AND vi.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      if (upcoming_only === 'true') {
        whereClause += ` AND vi.scheduled_at > NOW()`;
      }

      const interviewsResult = await query(`
        SELECT vi.*, 
               j.title as job_title, j.location as job_location,
               c.name as company_name, c.logo_url as company_logo,
               cu.first_name as candidate_first_name, cu.last_name as candidate_last_name,
               cu.profile_image as candidate_image,
               iu.first_name as interviewer_first_name, iu.last_name as interviewer_last_name,
               iu.profile_image as interviewer_image
        FROM video_interviews vi
        JOIN applications a ON vi.application_id = a.id
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
        LEFT JOIN users cu ON js.user_id = cu.id
        LEFT JOIN users iu ON vi.interviewer_id = iu.id
        ${whereClause}
        ORDER BY vi.scheduled_at ${upcoming_only === 'true' ? 'ASC' : 'DESC'}
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM video_interviews vi
        JOIN applications a ON vi.application_id = a.id
        LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
        ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        interviews: interviewsResult.rows,
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
      logger.error('Get interviews error:', error);
      res.status(500).json({ error: 'Failed to fetch interviews' });
    }
  }
);

// Get interview details
router.get('/:id',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const interviewResult = await query(`
        SELECT vi.*,
               a.id as application_id, a.cover_letter,
               j.title as job_title, j.description as job_description,
               j.location as job_location, j.employment_type,
               c.name as company_name, c.logo_url as company_logo,
               c.description as company_description,
               js.user_id as candidate_user_id, js.headline, js.summary,
               js.experience_years, js.skills, js.resume_url,
               cu.first_name as candidate_first_name, cu.last_name as candidate_last_name,
               cu.email as candidate_email, cu.phone as candidate_phone,
               cu.profile_image as candidate_image,
               iu.first_name as interviewer_first_name, iu.last_name as interviewer_last_name,
               iu.email as interviewer_email, iu.profile_image as interviewer_image
        FROM video_interviews vi
        JOIN applications a ON vi.application_id = a.id
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
        LEFT JOIN users cu ON js.user_id = cu.id
        LEFT JOIN users iu ON vi.interviewer_id = iu.id
        WHERE vi.id = $1
      `, [id]);

      if (interviewResult.rows.length === 0) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      const interview = interviewResult.rows[0];

      // Check permission
      const hasPermission = 
        req.user.role === 'admin' ||
        interview.candidate_user_id === userId ||
        interview.interviewer_id === userId;

      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Hide sensitive information from candidates
      if (req.user.role === 'job_seeker') {
        delete interview.interviewer_email;
        delete interview.candidate_email;
        delete interview.candidate_phone;
      }

      res.json({ interview });
    } catch (error) {
      logger.error('Get interview details error:', error);
      res.status(500).json({ error: 'Failed to fetch interview details' });
    }
  }
);

// Reschedule interview
router.patch('/:id/reschedule',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  requireActiveAccount,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { new_scheduled_at, reason = '' } = req.body;
      const userId = req.user.id;

      if (!new_scheduled_at) {
        return res.status(400).json({ error: 'new_scheduled_at is required' });
      }

      // Validate new scheduled time
      const newScheduledDate = new Date(new_scheduled_at);
      if (newScheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Interview must be rescheduled for a future time' });
      }

      // Check permission
      if (req.user.role !== 'admin') {
        const interviewCheck = await query(`
          SELECT vi.id
          FROM video_interviews vi
          WHERE vi.id = $1 AND vi.interviewer_id = $2
        `, [id, userId]);

        if (interviewCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Permission denied or interview not found' });
        }
      }

      const result = await videoInterviewService.rescheduleInterview(id, new_scheduled_at, reason);

      logger.info(`Interview rescheduled: ${id} by user ${userId}`);

      res.json({
        message: 'Interview rescheduled successfully',
        ...result
      });
    } catch (error) {
      logger.error('Reschedule interview error:', error);
      res.status(500).json({ error: 'Failed to reschedule interview' });
    }
  }
);

// Cancel interview
router.patch('/:id/cancel',
  authenticateJWT,
  requireRole(['employer', 'job_seeker', 'admin']),
  requireActiveAccount,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason = '' } = req.body;
      const userId = req.user.id;

      // Check permission
      if (req.user.role !== 'admin') {
        let permissionQuery;
        if (req.user.role === 'employer') {
          permissionQuery = 'SELECT vi.id FROM video_interviews vi WHERE vi.id = $1 AND vi.interviewer_id = $2';
        } else { // job_seeker
          permissionQuery = `
            SELECT vi.id
            FROM video_interviews vi
            JOIN applications a ON vi.application_id = a.id
            JOIN job_seekers js ON a.job_seeker_id = js.id
            WHERE vi.id = $1 AND js.user_id = $2
          `;
        }

        const permissionCheck = await query(permissionQuery, [id, userId]);

        if (permissionCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Permission denied or interview not found' });
        }
      }

      const result = await videoInterviewService.cancelInterview(id, reason);

      logger.info(`Interview cancelled: ${id} by user ${userId}`);

      res.json({
        message: 'Interview cancelled successfully',
        ...result
      });
    } catch (error) {
      logger.error('Cancel interview error:', error);
      res.status(500).json({ error: 'Failed to cancel interview' });
    }
  }
);

// Complete interview with feedback (Employers only)
router.patch('/:id/complete',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  requireActiveAccount,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { feedback, rating } = req.body;
      const userId = req.user.id;

      if (!feedback) {
        return res.status(400).json({ error: 'Feedback is required' });
      }

      if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      // Check permission
      if (req.user.role !== 'admin') {
        const interviewCheck = await query(`
          SELECT vi.id
          FROM video_interviews vi
          WHERE vi.id = $1 AND vi.interviewer_id = $2
        `, [id, userId]);

        if (interviewCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Permission denied or interview not found' });
        }
      }

      const result = await videoInterviewService.completeInterview(id, feedback, rating);

      logger.info(`Interview completed: ${id} by user ${userId}`);

      res.json({
        message: 'Interview completed successfully',
        ...result
      });
    } catch (error) {
      logger.error('Complete interview error:', error);
      res.status(500).json({ error: 'Failed to complete interview' });
    }
  }
);

// Get interview statistics (for dashboards)
router.get('/stats/summary',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { start_date, end_date } = req.query;

      let userFilter = '';
      let queryParams = [userId];

      if (req.user.role === 'job_seeker') {
        userFilter = 'AND js.user_id = $1';
      } else if (req.user.role === 'employer') {
        userFilter = 'AND vi.interviewer_id = $1';
      } else {
        return res.status(403).json({ error: 'Invalid user role' });
      }

      let dateFilter = '';
      if (start_date) {
        dateFilter += ` AND vi.scheduled_at >= $${queryParams.length + 1}`;
        queryParams.push(start_date);
      }
      if (end_date) {
        dateFilter += ` AND vi.scheduled_at <= $${queryParams.length + 1}`;
        queryParams.push(end_date);
      }

      const [totalResult, statusResult, upcomingResult] = await Promise.all([
        // Total interviews
        query(`
          SELECT COUNT(*) as total
          FROM video_interviews vi
          JOIN applications a ON vi.application_id = a.id
          LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
          WHERE 1=1 ${userFilter} ${dateFilter}
        `, queryParams),

        // By status
        query(`
          SELECT vi.status, COUNT(*) as count
          FROM video_interviews vi
          JOIN applications a ON vi.application_id = a.id
          LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
          WHERE 1=1 ${userFilter} ${dateFilter}
          GROUP BY vi.status
        `, queryParams),

        // Upcoming interviews (next 7 days)
        query(`
          SELECT COUNT(*) as upcoming
          FROM video_interviews vi
          JOIN applications a ON vi.application_id = a.id
          LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
          WHERE vi.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            AND vi.status = 'scheduled'
            ${userFilter}
        `, [userId])
      ]);

      res.json({
        total: parseInt(totalResult.rows[0].total),
        by_status: statusResult.rows,
        upcoming_week: parseInt(upcomingResult.rows[0].upcoming),
        period: {
          start_date: start_date || null,
          end_date: end_date || null
        }
      });
    } catch (error) {
      logger.error('Interview stats error:', error);
      res.status(500).json({ error: 'Failed to get interview statistics' });
    }
  }
);

// Test meeting creation (for development)
router.post('/test-meeting',
  authenticateJWT,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { platform = 'google_meet', topic = 'Test Interview' } = req.body;

      let meetingDetails;
      const startTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      if (platform === 'zoom') {
        meetingDetails = await videoInterviewService.createZoomMeeting({
          topic,
          startTime,
          duration: 60
        });
      } else {
        meetingDetails = await videoInterviewService.createGoogleMeet({
          summary: topic,
          startTime,
          duration: 60,
          attendees: [req.user.email]
        });
      }

      res.json({
        message: 'Test meeting created',
        meeting_details: meetingDetails
      });
    } catch (error) {
      logger.error('Test meeting creation error:', error);
      res.status(500).json({ error: 'Failed to create test meeting' });
    }
  }
);

module.exports = router;