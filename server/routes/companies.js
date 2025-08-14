const express = require('express');
const { query } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all companies with pagination
router.get('/',
  optionalAuth,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, industry, company_size, verified } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramCount = 0;

      if (industry) {
        whereClause += ` AND industry ILIKE $${++paramCount}`;
        queryParams.push(`%${industry}%`);
      }

      if (company_size) {
        whereClause += ` AND company_size = $${++paramCount}`;
        queryParams.push(company_size);
      }

      if (verified !== undefined) {
        whereClause += ` AND verified = $${++paramCount}`;
        queryParams.push(verified === 'true');
      }

      // Get companies
      const companiesResult = await query(`
        SELECT c.*,
               COUNT(j.id) as active_jobs_count,
               AVG(cr.rating) as avg_rating,
               COUNT(cr.id) as review_count
        FROM companies c
        LEFT JOIN jobs j ON c.id = j.company_id AND j.status = 'active' AND j.deleted_at IS NULL
        LEFT JOIN company_reviews cr ON c.id = cr.company_id
        ${whereClause}
        GROUP BY c.id
        ORDER BY c.verified DESC, active_jobs_count DESC, c.name ASC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...queryParams, limit, offset]);

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM companies c
        ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        companies: companiesResult.rows,
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
      logger.error('Get companies error:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  }
);

// Get single company by ID or slug
router.get('/:identifier',
  optionalAuth,
  async (req, res) => {
    try {
      const { identifier } = req.params;
      
      // Check if identifier is UUID or slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      const companyQuery = `
        SELECT c.*,
               COUNT(j.id) as active_jobs_count,
               AVG(cr.rating) as avg_rating,
               COUNT(cr.id) as review_count
        FROM companies c
        LEFT JOIN jobs j ON c.id = j.company_id AND j.status = 'active' AND j.deleted_at IS NULL
        LEFT JOIN company_reviews cr ON c.id = cr.company_id
        WHERE ${isUUID ? 'c.id = $1' : 'c.slug = $1'}
        GROUP BY c.id
      `;

      const result = await query(companyQuery, [identifier]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const company = result.rows[0];

      // Get recent jobs
      const jobsResult = await query(`
        SELECT id, title, slug, location, employment_type, posted_at, 
               salary_min, salary_max, salary_disclosed, currency,
               applications_count, is_featured, is_premium
        FROM jobs
        WHERE company_id = $1 AND status = 'active' AND deleted_at IS NULL
        ORDER BY posted_at DESC
        LIMIT 10
      `, [company.id]);

      company.recent_jobs = jobsResult.rows;

      // Get company reviews (sample)
      const reviewsResult = await query(`
        SELECT rating, title, pros, cons, job_title, employment_status,
               years_at_company, created_at
        FROM company_reviews
        WHERE company_id = $1 AND is_verified = true
        ORDER BY created_at DESC
        LIMIT 5
      `, [company.id]);

      company.recent_reviews = reviewsResult.rows;

      res.json({ company });
    } catch (error) {
      logger.error('Get company error:', error);
      res.status(500).json({ error: 'Failed to fetch company' });
    }
  }
);

// Get company jobs
router.get('/:id/jobs',
  optionalAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, employment_type } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE j.company_id = $1 AND j.status = $2 AND j.deleted_at IS NULL';
      let queryParams = [id, 'active'];

      if (employment_type) {
        whereClause += ' AND j.employment_type = $3';
        queryParams.push(employment_type);
      }

      const jobsResult = await query(`
        SELECT j.*, c.name as company_name, c.logo_url as company_logo,
               c.verified as company_verified
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        ${whereClause}
        ORDER BY j.is_featured DESC, j.is_premium DESC, j.posted_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

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
      logger.error('Get company jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch company jobs' });
    }
  }
);

module.exports = router;