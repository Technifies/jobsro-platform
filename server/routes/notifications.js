const express = require('express');
const { query } = require('../config/database');
const { 
  authenticateJWT, 
  requireRole, 
  requireActiveAccount 
} = require('../middleware/auth');
const { 
  sendNotification,
  getUserNotifications,
  markNotificationsAsRead,
  getUserNotificationPreferences,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY
} = require('../services/notificationService');
const logger = require('../utils/logger');

const router = express.Router();

// Get user notifications
router.get('/',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, unread_only } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        unreadOnly: unread_only === 'true'
      };

      const result = await getUserNotifications(userId, options);
      
      res.json(result);
    } catch (error) {
      logger.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }
);

// Get unread notification count
router.get('/unread-count',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await query(`
        SELECT COUNT(*) as count
        FROM notifications
        WHERE user_id = $1 AND is_read = false
      `, [userId]);

      res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
      logger.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }
);

// Mark notifications as read
router.patch('/mark-read',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { notification_ids, mark_all } = req.body;

      let updatedCount;
      
      if (mark_all) {
        updatedCount = await markNotificationsAsRead(userId);
      } else if (notification_ids && Array.isArray(notification_ids)) {
        updatedCount = await markNotificationsAsRead(userId, notification_ids);
      } else {
        return res.status(400).json({ error: 'Either mark_all or notification_ids is required' });
      }

      res.json({ 
        message: 'Notifications marked as read',
        updated_count: updatedCount
      });
    } catch (error) {
      logger.error('Mark notifications read error:', error);
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  }
);

// Get notification preferences
router.get('/preferences',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const preferences = await getUserNotificationPreferences(userId);
      
      res.json({ preferences });
    } catch (error) {
      logger.error('Get notification preferences error:', error);
      res.status(500).json({ error: 'Failed to get notification preferences' });
    }
  }
);

// Update notification preferences
router.put('/preferences',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { preferences } = req.body;

      // Validate preferences structure
      const validPreferences = {
        email: preferences.email || {},
        sms: preferences.sms || {},
        push: preferences.push || {}
      };

      await query(`
        UPDATE users 
        SET notification_preferences = $1
        WHERE id = $2
      `, [JSON.stringify(validPreferences), userId]);

      logger.info(`Notification preferences updated for user: ${userId}`);

      res.json({ 
        message: 'Notification preferences updated successfully',
        preferences: validPreferences
      });
    } catch (error) {
      logger.error('Update notification preferences error:', error);
      res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  }
);

// Delete notification
router.delete('/:id',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await query(`
        DELETE FROM notifications
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [id, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
      logger.error('Delete notification error:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  }
);

// Send test notification (for development/testing)
router.post('/test',
  authenticateJWT,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { user_id, type, title, message, channels, priority } = req.body;

      if (!user_id || !type || !title || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await sendNotification({
        userId: user_id,
        type: type,
        title: title,
        message: message,
        channels: channels || ['email'],
        priority: priority || NOTIFICATION_PRIORITY.MEDIUM,
        data: {
          test: true,
          sender: req.user.email
        }
      });

      res.json({
        message: 'Test notification sent',
        result
      });
    } catch (error) {
      logger.error('Send test notification error:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  }
);

// Get notification statistics (Admin only)
router.get('/stats',
  authenticateJWT,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      
      let whereClause = 'WHERE 1=1';
      const queryParams = [];
      
      if (start_date) {
        whereClause += ' AND created_at >= $1';
        queryParams.push(start_date);
      }
      
      if (end_date) {
        whereClause += ` AND created_at <= $${queryParams.length + 1}`;
        queryParams.push(end_date);
      }

      const [totalResult, typeStatsResult, channelStatsResult, statusStatsResult] = await Promise.all([
        // Total notifications
        query(`SELECT COUNT(*) as total FROM notifications ${whereClause}`, queryParams),
        
        // By type
        query(`
          SELECT type, COUNT(*) as count 
          FROM notifications ${whereClause}
          GROUP BY type 
          ORDER BY count DESC
        `, queryParams),
        
        // By channel
        query(`
          SELECT 
            CASE 
              WHEN 'email' = ANY(sent_via) THEN 'email'
              WHEN 'sms' = ANY(sent_via) THEN 'sms'
              ELSE 'none'
            END as channel,
            COUNT(*) as count
          FROM notifications ${whereClause}
          GROUP BY channel
        `, queryParams),
        
        // By status
        query(`
          SELECT status, COUNT(*) as count 
          FROM notifications ${whereClause}
          GROUP BY status
        `, queryParams)
      ]);

      res.json({
        total: parseInt(totalResult.rows[0].total),
        by_type: typeStatsResult.rows,
        by_channel: channelStatsResult.rows,
        by_status: statusStatsResult.rows
      });
    } catch (error) {
      logger.error('Get notification stats error:', error);
      res.status(500).json({ error: 'Failed to get notification statistics' });
    }
  }
);

// Resend failed notifications (Admin only)
router.post('/resend-failed',
  authenticateJWT,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { notification_ids, resend_all_failed } = req.body;

      let whereClause = "WHERE status = 'failed'";
      const queryParams = [];

      if (!resend_all_failed && notification_ids && Array.isArray(notification_ids)) {
        whereClause += ' AND id = ANY($1)';
        queryParams.push(notification_ids);
      }

      const failedNotifications = await query(`
        SELECT * FROM notifications ${whereClause}
        ORDER BY created_at DESC
        LIMIT 100
      `, queryParams);

      const resendResults = [];

      for (const notification of failedNotifications.rows) {
        try {
          const result = await sendNotification({
            userId: notification.user_id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            channels: ['email', 'sms'],
            priority: notification.priority
          });

          resendResults.push({
            notification_id: notification.id,
            success: result.success,
            sent: result.sent
          });
        } catch (error) {
          resendResults.push({
            notification_id: notification.id,
            success: false,
            error: error.message
          });
        }
      }

      const successful = resendResults.filter(r => r.success).length;
      const failed = resendResults.filter(r => !r.success).length;

      res.json({
        message: 'Resend operation completed',
        total_processed: resendResults.length,
        successful,
        failed,
        results: resendResults
      });
    } catch (error) {
      logger.error('Resend failed notifications error:', error);
      res.status(500).json({ error: 'Failed to resend notifications' });
    }
  }
);

module.exports = router;