const axios = require('axios');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../config/database');
const { sendEmail } = require('./email');
const { sendSMS } = require('./sms');
const { sendNotification, NOTIFICATION_TYPES } = require('./notificationService');
const logger = require('../utils/logger');

class VideoInterviewService {
  constructor() {
    // Google Meet configuration
    this.googleConfig = {
      clientId: process.env.GOOGLE_MEET_CLIENT_ID,
      clientSecret: process.env.GOOGLE_MEET_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_MEET_REDIRECT_URI || `${process.env.API_BASE_URL}/auth/google/callback`,
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/meetings.space.created']
    };

    // Zoom configuration
    this.zoomConfig = {
      apiKey: process.env.ZOOM_API_KEY,
      apiSecret: process.env.ZOOM_API_SECRET,
      baseUrl: 'https://api.zoom.us/v2'
    };
  }

  // Schedule video interview
  async scheduleInterview({
    applicationId,
    interviewerId,
    scheduledAt,
    durationMinutes = 60,
    platform = 'google_meet',
    notes = '',
    timezone = 'Asia/Kolkata'
  }) {
    try {
      // Get application and participant details
      const applicationResult = await query(`
        SELECT a.*, j.title as job_title, j.company_id,
               js.user_id as candidate_user_id, js.headline,
               cu.email as candidate_email, cu.first_name as candidate_name, cu.phone as candidate_phone,
               e.user_id as employer_user_id,
               iu.email as interviewer_email, iu.first_name as interviewer_name,
               c.name as company_name
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN job_seekers js ON a.job_seeker_id = js.id
        JOIN users cu ON js.user_id = cu.id
        JOIN employers e ON j.employer_id = e.id
        JOIN users iu ON $2 = iu.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE a.id = $1
      `, [applicationId, interviewerId]);

      if (applicationResult.rows.length === 0) {
        throw new Error('Application not found');
      }

      const applicationData = applicationResult.rows[0];

      // Create meeting based on platform
      let meetingDetails;
      if (platform === 'zoom') {
        meetingDetails = await this.createZoomMeeting({
          topic: `Interview: ${applicationData.job_title} - ${applicationData.candidate_name}`,
          startTime: scheduledAt,
          duration: durationMinutes,
          timezone
        });
      } else {
        meetingDetails = await this.createGoogleMeet({
          summary: `Interview: ${applicationData.job_title} - ${applicationData.candidate_name}`,
          startTime: scheduledAt,
          duration: durationMinutes,
          attendees: [applicationData.candidate_email, applicationData.interviewer_email]
        });
      }

      // Store interview record
      const interview = await transaction(async (client) => {
        const interviewResult = await client.query(`
          INSERT INTO video_interviews (
            application_id, interviewer_id, scheduled_at, duration_minutes,
            meeting_platform, meeting_url, meeting_id, meeting_password, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          applicationId,
          interviewerId,
          scheduledAt,
          durationMinutes,
          platform,
          meetingDetails.joinUrl,
          meetingDetails.meetingId,
          meetingDetails.password,
          notes
        ]);

        // Update application status
        await client.query(`
          UPDATE applications 
          SET status = 'interviewed', updated_at = NOW()
          WHERE id = $1
        `, [applicationId]);

        return interviewResult.rows[0];
      });

      // Send notifications
      await this.sendInterviewNotifications({
        interview,
        applicationData,
        meetingDetails
      });

      logger.info(`Interview scheduled: ${interview.id} for application ${applicationId}`);

      return {
        interview,
        meetingDetails
      };

    } catch (error) {
      logger.error('Interview scheduling failed:', error);
      throw error;
    }
  }

  // Create Google Meet meeting
  async createGoogleMeet({ summary, startTime, duration, attendees = [] }) {
    try {
      // This is a simplified implementation
      // In production, you would integrate with Google Calendar API
      
      const meetingId = this.generateMeetingId();
      const joinUrl = `https://meet.google.com/${meetingId}`;

      // For demo purposes, return mock data
      // In production, you would make actual API calls to Google Calendar
      return {
        meetingId,
        joinUrl,
        password: null, // Google Meet doesn't use passwords typically
        startTime,
        duration,
        platform: 'google_meet',
        hostUrl: joinUrl,
        dialInNumbers: ['+91-80-6918-2000'], // Sample dial-in number for India
        created: true
      };

    } catch (error) {
      logger.error('Google Meet creation failed:', error);
      throw new Error('Failed to create Google Meet meeting');
    }
  }

  // Create Zoom meeting
  async createZoomMeeting({ topic, startTime, duration, timezone = 'Asia/Kolkata' }) {
    try {
      if (!this.zoomConfig.apiKey || !this.zoomConfig.apiSecret) {
        throw new Error('Zoom API credentials not configured');
      }

      // Generate JWT token for Zoom API
      const token = this.generateZoomJWT();

      const meetingData = {
        topic,
        type: 2, // Scheduled meeting
        start_time: new Date(startTime).toISOString(),
        duration,
        timezone,
        password: this.generateMeetingPassword(),
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          approval_type: 0,
          audio: 'both',
          auto_recording: 'none',
          waiting_room: true
        }
      };

      const response = await axios.post(`${this.zoomConfig.baseUrl}/users/me/meetings`, meetingData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const meeting = response.data;

      return {
        meetingId: meeting.id.toString(),
        joinUrl: meeting.join_url,
        password: meeting.password,
        startTime,
        duration,
        platform: 'zoom',
        hostUrl: meeting.start_url,
        dialInNumbers: meeting.settings?.global_dial_in_numbers?.map(d => d.number) || [],
        created: true
      };

    } catch (error) {
      logger.error('Zoom meeting creation failed:', error);
      
      // Fallback to manual meeting creation
      return this.createFallbackMeeting({ topic, startTime, duration });
    }
  }

  // Generate Zoom JWT token
  generateZoomJWT() {
    const payload = {
      iss: this.zoomConfig.apiKey,
      exp: Math.round(Date.now() / 1000) + 3600 // 1 hour expiration
    };

    return jwt.sign(payload, this.zoomConfig.apiSecret, { algorithm: 'HS256' });
  }

  // Create fallback meeting when API fails
  createFallbackMeeting({ topic, startTime, duration }) {
    const meetingId = this.generateMeetingId();
    const password = this.generateMeetingPassword();

    return {
      meetingId,
      joinUrl: `https://zoom.us/j/${meetingId}?pwd=${password}`,
      password,
      startTime,
      duration,
      platform: 'zoom',
      hostUrl: `https://zoom.us/s/${meetingId}?pwd=${password}`,
      dialInNumbers: ['+91-80-7143-2000'], // Sample dial-in number for India
      created: false, // Manual creation required
      fallback: true
    };
  }

  // Send interview notifications
  async sendInterviewNotifications({ interview, applicationData, meetingDetails }) {
    try {
      const interviewDateTime = new Date(interview.scheduled_at).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      });

      // Notify candidate
      await sendNotification({
        userId: applicationData.candidate_user_id,
        type: NOTIFICATION_TYPES.INTERVIEW_SCHEDULED,
        title: 'Interview Scheduled',
        message: `Your interview for ${applicationData.job_title} at ${applicationData.company_name} has been scheduled.`,
        channels: ['email', 'sms'],
        data: {
          jobTitle: applicationData.job_title,
          companyName: applicationData.company_name,
          interviewDateTime,
          duration: `${interview.duration_minutes} minutes`,
          platform: interview.meeting_platform,
          meetingUrl: meetingDetails.joinUrl,
          meetingId: meetingDetails.meetingId,
          password: meetingDetails.password,
          detailsUrl: `${process.env.FRONTEND_URL}/interviews/${interview.id}`
        }
      });

      // Notify interviewer
      await sendNotification({
        userId: applicationData.employer_user_id,
        type: NOTIFICATION_TYPES.INTERVIEW_SCHEDULED,
        title: 'Interview Scheduled',
        message: `Interview scheduled with ${applicationData.candidate_name} for ${applicationData.job_title}.`,
        channels: ['email'],
        data: {
          candidateName: applicationData.candidate_name,
          jobTitle: applicationData.job_title,
          interviewDateTime,
          duration: `${interview.duration_minutes} minutes`,
          platform: interview.meeting_platform,
          meetingUrl: meetingDetails.hostUrl || meetingDetails.joinUrl,
          meetingId: meetingDetails.meetingId,
          password: meetingDetails.password,
          candidateProfile: `${process.env.FRONTEND_URL}/employer/candidates/${applicationData.id}`
        }
      });

      logger.info(`Interview notifications sent for interview: ${interview.id}`);

    } catch (error) {
      logger.error('Failed to send interview notifications:', error);
    }
  }

  // Send interview reminders
  async sendInterviewReminders() {
    try {
      // Get interviews scheduled for the next 2 hours
      const upcomingInterviews = await query(`
        SELECT vi.*, a.id as application_id,
               js.user_id as candidate_user_id,
               cu.email as candidate_email, cu.first_name as candidate_name, cu.phone as candidate_phone,
               iu.email as interviewer_email, iu.first_name as interviewer_name,
               j.title as job_title, c.name as company_name
        FROM video_interviews vi
        JOIN applications a ON vi.application_id = a.id
        JOIN jobs j ON a.job_id = j.id
        JOIN job_seekers js ON a.job_seeker_id = js.id
        JOIN users cu ON js.user_id = cu.id
        JOIN users iu ON vi.interviewer_id = iu.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE vi.scheduled_at BETWEEN NOW() + INTERVAL '1 hour' AND NOW() + INTERVAL '2 hours'
          AND vi.status = 'scheduled'
          AND vi.reminder_sent = false
      `);

      for (const interview of upcomingInterviews.rows) {
        try {
          const interviewDateTime = new Date(interview.scheduled_at).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'full',
            timeStyle: 'short'
          });

          // Send SMS reminder to candidate
          if (interview.candidate_phone) {
            await sendSMS({
              to: interview.candidate_phone,
              template: 'interview-reminder',
              data: {
                name: interview.candidate_name,
                jobTitle: interview.job_title,
                companyName: interview.company_name,
                dateTime: interviewDateTime,
                meetingUrl: interview.meeting_url
              }
            });
          }

          // Send email reminder
          await sendEmail({
            to: interview.candidate_email,
            template: 'interview-reminder',
            data: {
              name: interview.candidate_name,
              jobTitle: interview.job_title,
              companyName: interview.company_name,
              interviewDateTime,
              duration: `${interview.duration_minutes} minutes`,
              platform: interview.meeting_platform,
              meetingUrl: interview.meeting_url,
              meetingId: interview.meeting_id,
              password: interview.meeting_password
            }
          });

          // Mark reminder as sent
          await query(`
            UPDATE video_interviews 
            SET reminder_sent = true 
            WHERE id = $1
          `, [interview.id]);

          logger.info(`Interview reminder sent for: ${interview.id}`);

        } catch (error) {
          logger.error(`Failed to send reminder for interview ${interview.id}:`, error);
        }
      }

      if (upcomingInterviews.rows.length > 0) {
        logger.info(`Processed ${upcomingInterviews.rows.length} interview reminders`);
      }

    } catch (error) {
      logger.error('Interview reminders processing failed:', error);
    }
  }

  // Reschedule interview
  async rescheduleInterview(interviewId, newScheduledAt, rescheduleReason = '') {
    try {
      // Get interview details
      const interviewResult = await query(`
        SELECT vi.*, a.id as application_id,
               js.user_id as candidate_user_id,
               cu.email as candidate_email, cu.first_name as candidate_name,
               iu.email as interviewer_email, iu.first_name as interviewer_name,
               j.title as job_title, c.name as company_name
        FROM video_interviews vi
        JOIN applications a ON vi.application_id = a.id
        JOIN jobs j ON a.job_id = j.id
        JOIN job_seekers js ON a.job_seeker_id = js.id
        JOIN users cu ON js.user_id = cu.id
        JOIN users iu ON vi.interviewer_id = iu.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE vi.id = $1
      `, [interviewId]);

      if (interviewResult.rows.length === 0) {
        throw new Error('Interview not found');
      }

      const interview = interviewResult.rows[0];
      const oldDateTime = new Date(interview.scheduled_at);
      const newDateTime = new Date(newScheduledAt);

      // Update interview record
      await query(`
        UPDATE video_interviews 
        SET scheduled_at = $1,
            reminder_sent = false,
            updated_at = NOW()
        WHERE id = $2
      `, [newScheduledAt, interviewId]);

      // Send rescheduling notifications
      const newDateTimeFormatted = newDateTime.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      });

      // Notify candidate
      await sendNotification({
        userId: interview.candidate_user_id,
        type: NOTIFICATION_TYPES.INTERVIEW_SCHEDULED,
        title: 'Interview Rescheduled',
        message: `Your interview for ${interview.job_title} has been rescheduled.`,
        channels: ['email', 'sms'],
        data: {
          jobTitle: interview.job_title,
          companyName: interview.company_name,
          oldDateTime: oldDateTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          newDateTime: newDateTimeFormatted,
          reason: rescheduleReason,
          meetingUrl: interview.meeting_url,
          detailsUrl: `${process.env.FRONTEND_URL}/interviews/${interview.id}`
        }
      });

      logger.info(`Interview rescheduled: ${interviewId} from ${oldDateTime} to ${newDateTime}`);

      return {
        interview_id: interviewId,
        old_time: oldDateTime,
        new_time: newDateTime,
        reason: rescheduleReason
      };

    } catch (error) {
      logger.error('Interview rescheduling failed:', error);
      throw error;
    }
  }

  // Cancel interview
  async cancelInterview(interviewId, cancellationReason = '') {
    try {
      // Get interview details
      const interviewResult = await query(`
        SELECT vi.*, a.id as application_id,
               js.user_id as candidate_user_id,
               cu.first_name as candidate_name,
               j.title as job_title, c.name as company_name
        FROM video_interviews vi
        JOIN applications a ON vi.application_id = a.id
        JOIN jobs j ON a.job_id = j.id
        JOIN job_seekers js ON a.job_seeker_id = js.id
        JOIN users cu ON js.user_id = cu.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE vi.id = $1
      `, [interviewId]);

      if (interviewResult.rows.length === 0) {
        throw new Error('Interview not found');
      }

      const interview = interviewResult.rows[0];

      // Update interview status
      await query(`
        UPDATE video_interviews 
        SET status = 'cancelled',
            feedback = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [cancellationReason, interviewId]);

      // Notify candidate
      await sendNotification({
        userId: interview.candidate_user_id,
        type: NOTIFICATION_TYPES.INTERVIEW_SCHEDULED,
        title: 'Interview Cancelled',
        message: `Your interview for ${interview.job_title} has been cancelled.`,
        channels: ['email', 'sms'],
        data: {
          jobTitle: interview.job_title,
          companyName: interview.company_name,
          reason: cancellationReason,
          scheduledTime: new Date(interview.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        }
      });

      logger.info(`Interview cancelled: ${interviewId}, reason: ${cancellationReason}`);

      return {
        interview_id: interviewId,
        cancelled_at: new Date(),
        reason: cancellationReason
      };

    } catch (error) {
      logger.error('Interview cancellation failed:', error);
      throw error;
    }
  }

  // Generate meeting ID
  generateMeetingId() {
    return Math.random().toString().substr(2, 10);
  }

  // Generate meeting password
  generateMeetingPassword() {
    return Math.random().toString(36).substr(2, 8);
  }

  // Complete interview (add feedback)
  async completeInterview(interviewId, feedback, rating) {
    try {
      await query(`
        UPDATE video_interviews 
        SET status = 'completed',
            feedback = $1,
            rating = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [feedback, rating, interviewId]);

      logger.info(`Interview completed: ${interviewId}`);

      return {
        interview_id: interviewId,
        completed_at: new Date(),
        feedback,
        rating
      };

    } catch (error) {
      logger.error('Interview completion failed:', error);
      throw error;
    }
  }
}

module.exports = new VideoInterviewService();