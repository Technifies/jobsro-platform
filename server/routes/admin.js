const express = require('express');
const { query, transaction } = require('../config/database');
const { 
  authenticateJWT, 
  requireRole, 
  requireActiveAccount 
} = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// All admin routes require admin role
router.use(authenticateJWT);
router.use(requireRole('admin'));
router.use(requireActiveAccount);

// Admin Dashboard Analytics
router.get('/dashboard',
  async (req, res) => {
    try {
      const { period = '30d' } = req.query;
      
      let dateFilter = '';
      switch (period) {
        case '7d':
          dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'";
          break;
        case '30d':
          dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'";
          break;
        case '90d':
          dateFilter = "AND created_at >= NOW() - INTERVAL '90 days'";
          break;
        case '1y':
          dateFilter = "AND created_at >= NOW() - INTERVAL '1 year'";
          break;
        default:
          dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'";
      }

      const [
        userStats,
        jobStats,
        applicationStats,
        paymentStats,
        interviewStats,
        recentActivity
      ] = await Promise.all([
        // User statistics
        query(`
          SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
            COUNT(CASE WHEN role = 'job_seeker' THEN 1 END) as job_seekers,
            COUNT(CASE WHEN role = 'employer' THEN 1 END) as employers,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week
          FROM users
          WHERE 1=1 ${dateFilter}
        `),

        // Job statistics
        query(`
          SELECT 
            COUNT(*) as total_jobs,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_jobs,
            COUNT(CASE WHEN status = 'filled' THEN 1 END) as filled_jobs,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_jobs_week,
            AVG(salary_max) as avg_salary
          FROM jobs
          WHERE deleted_at IS NULL ${dateFilter}
        `),

        // Application statistics
        query(`
          SELECT 
            COUNT(*) as total_applications,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_applications,
            COUNT(CASE WHEN status = 'hired' THEN 1 END) as hired_applications,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_applications_week
          FROM applications
          WHERE 1=1 ${dateFilter}
        `),

        // Payment statistics
        query(`
          SELECT 
            COUNT(*) as total_transactions,
            SUM(amount) as total_revenue,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payments,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
          FROM payments
          WHERE 1=1 ${dateFilter}
        `),

        // Interview statistics
        query(`
          SELECT 
            COUNT(*) as total_interviews,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_interviews,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_interviews,
            AVG(rating) as avg_rating
          FROM video_interviews
          WHERE 1=1 ${dateFilter}
        `),

        // Recent activity
        query(`
          SELECT 
            'user' as type, 
            CONCAT(first_name, ' ', last_name) as description,
            created_at
          FROM users 
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          UNION ALL
          SELECT 
            'job' as type,
            title as description,
            created_at
          FROM jobs 
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          UNION ALL
          SELECT 
            'application' as type,
            'New application submitted' as description,
            created_at
          FROM applications 
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          ORDER BY created_at DESC
          LIMIT 10
        `)
      ]);

      res.json({
        period,
        users: userStats.rows[0],
        jobs: jobStats.rows[0],
        applications: applicationStats.rows[0],
        payments: paymentStats.rows[0],
        interviews: interviewStats.rows[0],
        recent_activity: recentActivity.rows
      });
    } catch (error) {
      logger.error('Admin dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard data' });
    }
  }
);

// User Management - Get all users with filtering
router.get('/users',
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        role, 
        status, 
        search,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const queryParams = [];

      if (role) {
        whereClause += ` AND role = $${queryParams.length + 1}`;
        queryParams.push(role);
      }

      if (status) {
        whereClause += ` AND status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      if (search) {
        whereClause += ` AND (first_name ILIKE $${queryParams.length + 1} OR last_name ILIKE $${queryParams.length + 1} OR email ILIKE $${queryParams.length + 1})`;
        queryParams.push(`%${search}%`);
      }

      const orderClause = `ORDER BY ${sort_by} ${sort_order.toUpperCase()}`;

      const [usersResult, countResult] = await Promise.all([
        query(`
          SELECT 
            u.*,
            CASE 
              WHEN u.role = 'job_seeker' THEN js.current_position
              WHEN u.role = 'employer' THEN c.name
              ELSE NULL
            END as additional_info
          FROM users u
          LEFT JOIN job_seekers js ON u.id = js.user_id
          LEFT JOIN employers e ON u.id = e.user_id
          LEFT JOIN companies c ON e.company_id = c.id
          ${whereClause}
          ${orderClause}
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `, [...queryParams, limit, offset]),

        query(`
          SELECT COUNT(*) as total
          FROM users u
          ${whereClause}
        `, queryParams)
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        users: usersResult.rows,
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
      logger.error('Admin get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// User Management - Get user details
router.get('/users/:id',
  async (req, res) => {
    try {
      const { id } = req.params;

      const userResult = await query(`
        SELECT 
          u.*,
          CASE 
            WHEN u.role = 'job_seeker' THEN json_build_object(
              'id', js.id,
              'headline', js.headline,
              'summary', js.summary,
              'experience_years', js.experience_years,
              'skills', js.skills,
              'current_position', js.current_position,
              'current_company', js.current_company,
              'availability_status', js.availability_status
            )
            WHEN u.role = 'employer' THEN json_build_object(
              'id', e.id,
              'company_id', e.company_id,
              'position', e.position,
              'department', e.department,
              'company_name', c.name
            )
            ELSE NULL
          END as profile_data
        FROM users u
        LEFT JOIN job_seekers js ON u.id = js.user_id
        LEFT JOIN employers e ON u.id = e.user_id
        LEFT JOIN companies c ON e.company_id = c.id
        WHERE u.id = $1
      `, [id]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Get user activity stats
      const [jobsCount, applicationsCount, paymentsSum] = await Promise.all([
        // Jobs posted (for employers)
        query(`
          SELECT COUNT(*) as count
          FROM jobs j
          JOIN employers e ON j.employer_id = e.id
          WHERE e.user_id = $1
        `, [id]),

        // Applications made (for job seekers) or received (for employers)
        query(`
          SELECT COUNT(*) as count
          FROM applications a
          LEFT JOIN job_seekers js ON a.job_seeker_id = js.id
          LEFT JOIN jobs j ON a.job_id = j.id
          LEFT JOIN employers e ON j.employer_id = e.id
          WHERE js.user_id = $1 OR e.user_id = $1
        `, [id]),

        // Total payments made
        query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM payments
          WHERE user_id = $1 AND status = 'completed'
        `, [id])
      ]);

      user.activity_stats = {
        jobs_posted: parseInt(jobsCount.rows[0].count),
        applications: parseInt(applicationsCount.rows[0].count),
        total_payments: parseFloat(paymentsSum.rows[0].total)
      };

      res.json({ user });
    } catch (error) {
      logger.error('Admin get user details error:', error);
      res.status(500).json({ error: 'Failed to fetch user details' });
    }
  }
);

// User Management - Update user status
router.patch('/users/:id/status',
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      const validStatuses = ['active', 'suspended', 'banned', 'inactive'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      const result = await query(`
        UPDATE users 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, status
      `, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Log admin action
      await query(`
        INSERT INTO admin_actions (admin_user_id, action_type, target_type, target_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        req.user.id,
        'user_status_change',
        'user',
        id,
        JSON.stringify({ old_status: status, new_status: status, reason })
      ]);

      logger.info(`User status updated: ${id} -> ${status} by admin ${req.user.id}`);

      res.json({
        message: 'User status updated successfully',
        user: result.rows[0]
      });
    } catch (error) {
      logger.error('Admin update user status error:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }
);

// Job Management - Get all jobs with filtering
router.get('/jobs',
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status, 
        search,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      let whereClause = 'WHERE j.deleted_at IS NULL';
      const queryParams = [];

      if (status) {
        whereClause += ` AND j.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      if (search) {
        whereClause += ` AND (j.title ILIKE $${queryParams.length + 1} OR j.description ILIKE $${queryParams.length + 1})`;
        queryParams.push(`%${search}%`);
      }

      const orderClause = `ORDER BY j.${sort_by} ${sort_order.toUpperCase()}`;

      const [jobsResult, countResult] = await Promise.all([
        query(`
          SELECT 
            j.*,
            c.name as company_name,
            u.email as employer_email,
            (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as application_count
          FROM jobs j
          LEFT JOIN companies c ON j.company_id = c.id
          LEFT JOIN employers e ON j.employer_id = e.id
          LEFT JOIN users u ON e.user_id = u.id
          ${whereClause}
          ${orderClause}
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `, [...queryParams, limit, offset]),

        query(`
          SELECT COUNT(*) as total
          FROM jobs j
          ${whereClause}
        `, queryParams)
      ]);

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
      logger.error('Admin get jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  }
);

// Job Management - Update job status
router.patch('/jobs/:id/status',
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      const validStatuses = ['active', 'inactive', 'filled', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      const result = await query(`
        UPDATE jobs 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, title, status
      `, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Log admin action
      await query(`
        INSERT INTO admin_actions (admin_user_id, action_type, target_type, target_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        req.user.id,
        'job_status_change',
        'job',
        id,
        JSON.stringify({ new_status: status, reason })
      ]);

      logger.info(`Job status updated: ${id} -> ${status} by admin ${req.user.id}`);

      res.json({
        message: 'Job status updated successfully',
        job: result.rows[0]
      });
    } catch (error) {
      logger.error('Admin update job status error:', error);
      res.status(500).json({ error: 'Failed to update job status' });
    }
  }
);

// Payment Management
router.get('/payments',
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status, 
        user_id,
        start_date,
        end_date
      } = req.query;

      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const queryParams = [];

      if (status) {
        whereClause += ` AND p.status = $${queryParams.length + 1}`;
        queryParams.push(status);
      }

      if (user_id) {
        whereClause += ` AND p.user_id = $${queryParams.length + 1}`;
        queryParams.push(user_id);
      }

      if (start_date) {
        whereClause += ` AND p.created_at >= $${queryParams.length + 1}`;
        queryParams.push(start_date);
      }

      if (end_date) {
        whereClause += ` AND p.created_at <= $${queryParams.length + 1}`;
        queryParams.push(end_date);
      }

      const [paymentsResult, countResult] = await Promise.all([
        query(`
          SELECT 
            p.*,
            u.email as user_email,
            u.first_name,
            u.last_name
          FROM payments p
          JOIN users u ON p.user_id = u.id
          ${whereClause}
          ORDER BY p.created_at DESC
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `, [...queryParams, limit, offset]),

        query(`
          SELECT COUNT(*) as total
          FROM payments p
          JOIN users u ON p.user_id = u.id
          ${whereClause}
        `, queryParams)
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        payments: paymentsResult.rows,
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
      logger.error('Admin get payments error:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }
);

// System Settings Management
router.get('/settings',
  async (req, res) => {
    try {
      const settingsResult = await query(`
        SELECT * FROM system_settings ORDER BY category, key
      `);

      const settings = {};
      settingsResult.rows.forEach(setting => {
        if (!settings[setting.category]) {
          settings[setting.category] = {};
        }
        settings[setting.category][setting.key] = {
          value: setting.value,
          description: setting.description,
          data_type: setting.data_type
        };
      });

      res.json({ settings });
    } catch (error) {
      logger.error('Admin get settings error:', error);
      res.status(500).json({ error: 'Failed to fetch system settings' });
    }
  }
);

// Update system setting
router.put('/settings/:category/:key',
  async (req, res) => {
    try {
      const { category, key } = req.params;
      const { value } = req.body;

      const result = await query(`
        UPDATE system_settings 
        SET value = $1, updated_at = NOW()
        WHERE category = $2 AND key = $3
        RETURNING *
      `, [value, category, key]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Setting not found' });
      }

      // Log admin action
      await query(`
        INSERT INTO admin_actions (admin_user_id, action_type, target_type, target_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        req.user.id,
        'system_setting_update',
        'setting',
        `${category}.${key}`,
        JSON.stringify({ new_value: value })
      ]);

      logger.info(`System setting updated: ${category}.${key} by admin ${req.user.id}`);

      res.json({
        message: 'Setting updated successfully',
        setting: result.rows[0]
      });
    } catch (error) {
      logger.error('Admin update setting error:', error);
      res.status(500).json({ error: 'Failed to update setting' });
    }
  }
);

// Admin Actions Log
router.get('/actions',
  async (req, res) => {
    try {
      const { page = 1, limit = 50, admin_user_id, action_type } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams = [];

      if (admin_user_id) {
        whereClause += ` AND aa.admin_user_id = $${queryParams.length + 1}`;
        queryParams.push(admin_user_id);
      }

      if (action_type) {
        whereClause += ` AND aa.action_type = $${queryParams.length + 1}`;
        queryParams.push(action_type);
      }

      const [actionsResult, countResult] = await Promise.all([
        query(`
          SELECT 
            aa.*,
            u.email as admin_email,
            u.first_name as admin_first_name,
            u.last_name as admin_last_name
          FROM admin_actions aa
          JOIN users u ON aa.admin_user_id = u.id
          ${whereClause}
          ORDER BY aa.created_at DESC
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `, [...queryParams, limit, offset]),

        query(`
          SELECT COUNT(*) as total
          FROM admin_actions aa
          ${whereClause}
        `, queryParams)
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        actions: actionsResult.rows,
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
      logger.error('Admin get actions error:', error);
      res.status(500).json({ error: 'Failed to fetch admin actions' });
    }
  }
);

// System Health Check
router.get('/health',
  async (req, res) => {
    try {
      const healthChecks = await Promise.allSettled([
        // Database connection
        query('SELECT 1'),
        
        // Check critical tables
        query('SELECT COUNT(*) FROM users'),
        query('SELECT COUNT(*) FROM jobs'),
        query('SELECT COUNT(*) FROM applications'),
        
        // Check recent activity
        query(`
          SELECT COUNT(*) as recent_activity
          FROM (
            SELECT created_at FROM users WHERE created_at >= NOW() - INTERVAL '1 hour'
            UNION ALL
            SELECT created_at FROM jobs WHERE created_at >= NOW() - INTERVAL '1 hour'
            UNION ALL
            SELECT created_at FROM applications WHERE created_at >= NOW() - INTERVAL '1 hour'
          ) recent
        `)
      ]);

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: healthChecks[0].status === 'fulfilled' ? 'ok' : 'error',
          tables: healthChecks.slice(1, 4).every(check => check.status === 'fulfilled') ? 'ok' : 'error',
          recent_activity: healthChecks[4].status === 'fulfilled' ? 'ok' : 'error'
        }
      };

      // Overall status
      const hasErrors = Object.values(health.checks).some(status => status === 'error');
      if (hasErrors) {
        health.status = 'unhealthy';
      }

      res.json(health);
    } catch (error) {
      logger.error('Admin health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;