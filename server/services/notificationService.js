const { query, transaction } = require('../config/database');
const { sendEmail, sendBulkEmails } = require('./email');
const { sendSMS, sendBulkSMS } = require('./sms');
const logger = require('../utils/logger');

// Notification types
const NOTIFICATION_TYPES = {
  // Job seeker notifications
  JOB_ALERT: 'job_alert',
  APPLICATION_STATUS: 'application_status',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  INTERVIEW_REMINDER: 'interview_reminder',
  NEW_JOB_MATCH: 'new_job_match',
  PROFILE_VIEW: 'profile_view',
  SAVED_JOB_UPDATE: 'saved_job_update',
  
  // Employer notifications
  NEW_APPLICATION: 'new_application',
  CANDIDATE_SHORTLISTED: 'candidate_shortlisted',
  JOB_EXPIRING: 'job_expiring',
  SUBSCRIPTION_EXPIRY: 'subscription_expiry',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  
  // System notifications
  ACCOUNT_VERIFICATION: 'account_verification',
  PASSWORD_RESET: 'password_reset',
  SECURITY_ALERT: 'security_alert',
  SYSTEM_MAINTENANCE: 'system_maintenance',
  
  // General notifications
  WELCOME: 'welcome',
  NEWSLETTER: 'newsletter',
  FEATURE_UPDATE: 'feature_update'
};

// Notification priorities
const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Get user notification preferences
const getUserNotificationPreferences = async (userId) => {
  try {
    const result = await query(`
      SELECT notification_preferences 
      FROM users 
      WHERE id = $1
    `, [userId]);

    const user = result.rows[0];
    
    // Default preferences if not set
    const defaultPreferences = {
      email: {
        job_alerts: true,
        application_status: true,
        interview_notifications: true,
        new_applications: true,
        marketing: false,
        system_notifications: true
      },
      sms: {
        interview_reminders: true,
        urgent_notifications: true,
        application_updates: false,
        marketing: false
      },
      push: {
        all: true,
        job_alerts: true,
        messages: true
      }
    };

    return user?.notification_preferences || defaultPreferences;
  } catch (error) {
    logger.error('Error fetching notification preferences:', error);
    return null;
  }
};

// Create notification record
const createNotificationRecord = async (notificationData) => {
  try {
    const result = await query(`
      INSERT INTO notifications (
        user_id, type, title, message, data, sent_via, priority, scheduled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      notificationData.userId,
      notificationData.type,
      notificationData.title,
      notificationData.message,
      JSON.stringify(notificationData.data || {}),
      notificationData.sentVia || [],
      notificationData.priority || NOTIFICATION_PRIORITY.MEDIUM,
      notificationData.scheduledAt || null
    ]);

    return result.rows[0];
  } catch (error) {
    logger.error('Error creating notification record:', error);
    throw error;
  }
};

// Update notification status
const updateNotificationStatus = async (notificationId, status, error = null) => {
  try {
    await query(`
      UPDATE notifications 
      SET status = $1, error_message = $2, sent_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [status, error, notificationId]);
  } catch (err) {
    logger.error('Error updating notification status:', err);
  }
};

// Send single notification
const sendNotification = async ({
  userId,
  type,
  title,
  message,
  data = {},
  channels = ['email'], // email, sms, push
  priority = NOTIFICATION_PRIORITY.MEDIUM,
  scheduledAt = null
}) => {
  try {
    // Get user details
    const userResult = await query(`
      SELECT id, email, phone, first_name, last_name, notification_preferences
      FROM users 
      WHERE id = $1 AND status = 'active'
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found or inactive');
    }

    const user = userResult.rows[0];
    const preferences = user.notification_preferences || await getUserNotificationPreferences(userId);

    // Create notification record
    const notification = await createNotificationRecord({
      userId,
      type,
      title,
      message,
      data,
      priority,
      scheduledAt
    });

    const results = { sent: [], failed: [] };

    // Send email if enabled
    if (channels.includes('email') && user.email && shouldSendEmailNotification(type, preferences)) {
      try {
        await sendEmail({
          to: user.email,
          subject: title,
          html: message,
          template: getEmailTemplate(type),
          data: {
            name: user.first_name,
            ...data
          }
        });
        results.sent.push('email');
        logger.info(`Email notification sent to ${user.email} for type: ${type}`);
      } catch (error) {
        results.failed.push({ channel: 'email', error: error.message });
        logger.error(`Email notification failed for ${user.email}:`, error);
      }
    }

    // Send SMS if enabled
    if (channels.includes('sms') && user.phone && shouldSendSMSNotification(type, preferences)) {
      try {
        await sendSMS({
          to: user.phone,
          template: getSMSTemplate(type),
          data: {
            name: user.first_name,
            ...data
          }
        });
        results.sent.push('sms');
        logger.info(`SMS notification sent to ${user.phone} for type: ${type}`);
      } catch (error) {
        results.failed.push({ channel: 'sms', error: error.message });
        logger.error(`SMS notification failed for ${user.phone}:`, error);
      }
    }

    // Update notification record with results
    await query(`
      UPDATE notifications 
      SET sent_via = $1, status = $2, sent_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [results.sent, results.sent.length > 0 ? 'sent' : 'failed', notification.id]);

    return {
      notificationId: notification.id,
      sent: results.sent,
      failed: results.failed,
      success: results.sent.length > 0
    };

  } catch (error) {
    logger.error('Error sending notification:', error);
    throw error;
  }
};

// Send bulk notifications
const sendBulkNotifications = async (notifications) => {
  try {
    const results = [];
    const emailBatch = [];
    const smsBatch = [];

    for (const notification of notifications) {
      try {
        // Get user details
        const userResult = await query(`
          SELECT id, email, phone, first_name, last_name, notification_preferences
          FROM users 
          WHERE id = $1 AND status = 'active'
        `, [notification.userId]);

        if (userResult.rows.length === 0) {
          results.push({ ...notification, success: false, error: 'User not found' });
          continue;
        }

        const user = userResult.rows[0];
        const preferences = user.notification_preferences || await getUserNotificationPreferences(notification.userId);

        // Create notification record
        const record = await createNotificationRecord(notification);

        // Prepare email batch
        if (notification.channels?.includes('email') && user.email && shouldSendEmailNotification(notification.type, preferences)) {
          emailBatch.push({
            to: user.email,
            subject: notification.title,
            template: getEmailTemplate(notification.type),
            data: {
              name: user.first_name,
              ...notification.data
            },
            notificationId: record.id
          });
        }

        // Prepare SMS batch
        if (notification.channels?.includes('sms') && user.phone && shouldSendSMSNotification(notification.type, preferences)) {
          smsBatch.push({
            to: user.phone,
            template: getSMSTemplate(notification.type),
            data: {
              name: user.first_name,
              ...notification.data
            },
            notificationId: record.id
          });
        }

        results.push({ ...notification, success: true, notificationId: record.id });
      } catch (error) {
        results.push({ ...notification, success: false, error: error.message });
      }
    }

    // Send email batch
    if (emailBatch.length > 0) {
      try {
        await sendBulkEmails(emailBatch);
        logger.info(`Bulk email notifications sent: ${emailBatch.length}`);
      } catch (error) {
        logger.error('Bulk email notifications failed:', error);
      }
    }

    // Send SMS batch
    if (smsBatch.length > 0) {
      try {
        await sendBulkSMS(smsBatch);
        logger.info(`Bulk SMS notifications sent: ${smsBatch.length}`);
      } catch (error) {
        logger.error('Bulk SMS notifications failed:', error);
      }
    }

    return results;
  } catch (error) {
    logger.error('Error sending bulk notifications:', error);
    throw error;
  }
};

// Check if email notification should be sent
const shouldSendEmailNotification = (type, preferences) => {
  const emailPrefs = preferences.email || {};
  
  switch (type) {
    case NOTIFICATION_TYPES.JOB_ALERT:
      return emailPrefs.job_alerts !== false;
    case NOTIFICATION_TYPES.APPLICATION_STATUS:
      return emailPrefs.application_status !== false;
    case NOTIFICATION_TYPES.INTERVIEW_SCHEDULED:
    case NOTIFICATION_TYPES.INTERVIEW_REMINDER:
      return emailPrefs.interview_notifications !== false;
    case NOTIFICATION_TYPES.NEW_APPLICATION:
      return emailPrefs.new_applications !== false;
    case NOTIFICATION_TYPES.NEWSLETTER:
      return emailPrefs.marketing === true;
    default:
      return emailPrefs.system_notifications !== false;
  }
};

// Check if SMS notification should be sent
const shouldSendSMSNotification = (type, preferences) => {
  const smsPrefs = preferences.sms || {};
  
  switch (type) {
    case NOTIFICATION_TYPES.INTERVIEW_REMINDER:
      return smsPrefs.interview_reminders !== false;
    case NOTIFICATION_TYPES.APPLICATION_STATUS:
      return smsPrefs.application_updates === true;
    case NOTIFICATION_TYPES.SECURITY_ALERT:
    case NOTIFICATION_TYPES.ACCOUNT_VERIFICATION:
      return smsPrefs.urgent_notifications !== false;
    default:
      return false; // SMS only for specific types
  }
};

// Get email template for notification type
const getEmailTemplate = (type) => {
  const templateMap = {
    [NOTIFICATION_TYPES.JOB_ALERT]: 'job-alert',
    [NOTIFICATION_TYPES.APPLICATION_STATUS]: 'application-status',
    [NOTIFICATION_TYPES.INTERVIEW_SCHEDULED]: 'interview-scheduled',
    [NOTIFICATION_TYPES.INTERVIEW_REMINDER]: 'interview-reminder',
    [NOTIFICATION_TYPES.NEW_APPLICATION]: 'new-application',
    [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: 'subscription-activated',
    [NOTIFICATION_TYPES.WELCOME]: 'welcome',
  };
  
  return templateMap[type] || null;
};

// Get SMS template for notification type
const getSMSTemplate = (type) => {
  const templateMap = {
    [NOTIFICATION_TYPES.INTERVIEW_REMINDER]: 'interview-reminder',
    [NOTIFICATION_TYPES.APPLICATION_STATUS]: 'application-status',
    [NOTIFICATION_TYPES.JOB_ALERT]: 'job-alert',
    [NOTIFICATION_TYPES.ACCOUNT_VERIFICATION]: 'verification-code',
    [NOTIFICATION_TYPES.PASSWORD_RESET]: 'password-reset',
    [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: 'payment-success',
  };
  
  return templateMap[type] || null;
};

// Scheduled notification processing
const processScheduledNotifications = async () => {
  try {
    const result = await query(`
      SELECT * FROM notifications
      WHERE scheduled_at IS NOT NULL 
        AND scheduled_at <= NOW()
        AND status = 'pending'
      ORDER BY scheduled_at ASC
      LIMIT 100
    `);

    const notifications = result.rows;
    
    for (const notification of notifications) {
      try {
        await sendNotification({
          userId: notification.user_id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          channels: ['email', 'sms'],
          priority: notification.priority
        });

        await query(`
          UPDATE notifications 
          SET status = 'sent', sent_at = NOW()
          WHERE id = $1
        `, [notification.id]);

      } catch (error) {
        await query(`
          UPDATE notifications 
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [error.message, notification.id]);
      }
    }

    if (notifications.length > 0) {
      logger.info(`Processed ${notifications.length} scheduled notifications`);
    }
  } catch (error) {
    logger.error('Error processing scheduled notifications:', error);
  }
};

// Get user notifications
const getUserNotifications = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    const queryParams = [userId];

    if (unreadOnly) {
      whereClause += ' AND is_read = false';
    }

    const result = await query(`
      SELECT * FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);

    const countResult = await query(`
      SELECT COUNT(*) as total FROM notifications ${whereClause}
    `, queryParams);

    return {
      notifications: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    };
  } catch (error) {
    logger.error('Error getting user notifications:', error);
    throw error;
  }
};

// Mark notifications as read
const markNotificationsAsRead = async (userId, notificationIds = null) => {
  try {
    let query_text = 'UPDATE notifications SET is_read = true WHERE user_id = $1';
    let params = [userId];

    if (notificationIds && Array.isArray(notificationIds)) {
      query_text += ' AND id = ANY($2)';
      params.push(notificationIds);
    }

    const result = await query(query_text, params);
    return result.rowCount;
  } catch (error) {
    logger.error('Error marking notifications as read:', error);
    throw error;
  }
};

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  sendNotification,
  sendBulkNotifications,
  processScheduledNotifications,
  getUserNotifications,
  markNotificationsAsRead,
  getUserNotificationPreferences,
  createNotificationRecord,
  updateNotificationStatus
};