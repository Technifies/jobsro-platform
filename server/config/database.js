const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Connection event handlers
pool.on('connect', (client) => {
  logger.info(`Connected to PostgreSQL database`);
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

// Database connection function
const connectDB = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info(`Database connected at: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    throw error;
  }
};

// Query function with error handling
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms:`, { text, params, rowCount: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Database query error:', { text, params, error: error.message });
    throw error;
  }
};

// Transaction function
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Common database operations
const dbOperations = {
  // User operations
  async findUserByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    return result.rows[0];
  },

  async findUserById(id) {
    const result = await query(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0];
  },

  async createUser(userData) {
    const { email, password_hash, role, first_name, last_name, phone } = userData;
    const result = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, first_name, last_name, phone, created_at`,
      [email, password_hash, role, first_name, last_name, phone]
    );
    return result.rows[0];
  },

  // Job operations
  async findJobs(filters = {}, limit = 20, offset = 0) {
    let whereClause = 'WHERE j.status = $1 AND j.deleted_at IS NULL';
    let queryParams = ['active'];
    let paramCount = 1;

    if (filters.location) {
      whereClause += ` AND j.location ILIKE $${++paramCount}`;
      queryParams.push(`%${filters.location}%`);
    }

    if (filters.skills && filters.skills.length > 0) {
      whereClause += ` AND j.skills_required && $${++paramCount}`;
      queryParams.push(filters.skills);
    }

    if (filters.experience_min !== undefined) {
      whereClause += ` AND j.experience_min <= $${++paramCount}`;
      queryParams.push(filters.experience_min);
    }

    if (filters.salary_min !== undefined) {
      whereClause += ` AND j.salary_max >= $${++paramCount}`;
      queryParams.push(filters.salary_min);
    }

    const result = await query(
      `SELECT j.*, c.name as company_name, c.logo_url as company_logo
       FROM jobs j
       LEFT JOIN companies c ON j.company_id = c.id
       ${whereClause}
       ORDER BY j.created_at DESC
       LIMIT $${++paramCount} OFFSET $${++paramCount}`,
      [...queryParams, limit, offset]
    );

    return result.rows;
  },

  async getJobById(jobId) {
    const result = await query(
      `SELECT j.*, c.name as company_name, c.logo_url as company_logo,
              c.description as company_description, c.website as company_website
       FROM jobs j
       LEFT JOIN companies c ON j.company_id = c.id
       WHERE j.id = $1 AND j.deleted_at IS NULL`,
      [jobId]
    );
    return result.rows[0];
  },

  // Application operations
  async createApplication(applicationData) {
    const { job_id, job_seeker_id, cover_letter, resume_url, applied_salary_expectation } = applicationData;
    const result = await query(
      `INSERT INTO applications (job_id, job_seeker_id, cover_letter, resume_url, applied_salary_expectation)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [job_id, job_seeker_id, cover_letter, resume_url, applied_salary_expectation]
    );
    return result.rows[0];
  },

  async getApplicationsByJobSeeker(jobSeekerId, limit = 20, offset = 0) {
    const result = await query(
      `SELECT a.*, j.title as job_title, j.location as job_location,
              c.name as company_name, c.logo_url as company_logo
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN companies c ON j.company_id = c.id
       WHERE a.job_seeker_id = $1
       ORDER BY a.applied_at DESC
       LIMIT $2 OFFSET $3`,
      [jobSeekerId, limit, offset]
    );
    return result.rows;
  },

  // Company operations
  async getCompanies(limit = 20, offset = 0) {
    const result = await query(
      `SELECT * FROM companies
       ORDER BY name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  },

  async getCompanyById(companyId) {
    const result = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
    return result.rows[0];
  }
};

module.exports = {
  pool,
  query,
  transaction,
  connectDB,
  dbOperations
};