const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database configuration - will use PostgreSQL in production
let dbConfig;
if (process.env.NODE_ENV === 'production') {
  // Production database (PostgreSQL from Render)
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  dbConfig = {
    query: async (text, params) => {
      const client = await pool.connect();
      try {
        const result = await client.query(text, params);
        return result;
      } finally {
        client.release();
      }
    },
    
    testConnection: async () => {
      try {
        await pool.query('SELECT NOW()');
        return true;
      } catch (error) {
        console.error('Database connection failed:', error);
        return false;
      }
    }
  };
} else {
  // Development database (in-memory)
  dbConfig = require('./config/database-simple');
}

const { query, testConnection } = dbConfig;

// Trust proxy for deployment
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "*"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT || 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Compression
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || [
    'http://localhost:3000',
    'https://localhost:3000',
    /\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      services: {
        database: dbStatus ? 'connected' : 'disconnected',
        server: 'running'
      },
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// API Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password are required' }
      });
    }
    
    let result;
    if (process.env.NODE_ENV === 'production') {
      result = await query('SELECT * FROM users WHERE email = $1', [email]);
    } else {
      result = await query('SELECT * FROM users WHERE email = $1', [email]);
    }
    
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' }
      });
    }
    
    // Password verification
    let isValidPassword;
    if (process.env.NODE_ENV === 'production') {
      const bcrypt = require('bcryptjs');
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      isValidPassword = password === user.password; // Simple check for demo
    }
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' }
      });
    }
    
    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || user.first_name,
          lastName: user.lastName || user.last_name,
          role: user.role
        },
        tokens: {
          accessToken: token,
          expiresIn: '24h'
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, location } = req.query;
    
    let queryText = 'SELECT * FROM jobs WHERE status = $1';
    let queryParams = ['active'];
    
    const result = await query(queryText, queryParams);
    let jobs = result.rows;
    
    // Client-side filtering for demo (in production, use SQL WHERE clauses)
    if (search) {
      jobs = jobs.filter(job => 
        job.title.toLowerCase().includes(search.toLowerCase()) ||
        (job.description && job.description.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    if (location) {
      jobs = jobs.filter(job => 
        job.location && job.location.toLowerCase().includes(location.toLowerCase())
      );
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedJobs = jobs.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        jobs: paginatedJobs.map(job => ({
          ...job,
          company: { name: 'TechCorp Inc.', logo: null }
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(jobs.length / limit),
          totalJobs: jobs.length,
          hasNext: endIndex < jobs.length,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Jobs error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    const job = result.rows[0];
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: { message: 'Job not found' }
      });
    }
    
    res.json({
      success: true,
      data: {
        ...job,
        company: {
          name: 'TechCorp Inc.',
          logo: null,
          description: 'Leading technology company',
          website: 'https://techcorp.com'
        }
      }
    });
  } catch (error) {
    console.error('Job detail error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

app.get('/api/users/dashboard', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        stats: {
          totalApplications: 0,
          pendingApplications: 0,
          interviewsScheduled: 0,
          profileViews: 0
        },
        recentApplications: [],
        recommendedJobs: [],
        upcomingInterviews: []
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'JobsRo API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV,
    frontend: process.env.FRONTEND_URL || 'Not configured'
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'JobsRo API',
    version: '1.0.0',
    description: 'Complete Job Portal Platform API',
    environment: process.env.NODE_ENV,
    endpoints: {
      health: 'GET /health',
      auth: { login: 'POST /api/auth/login' },
      jobs: { list: 'GET /api/jobs', detail: 'GET /api/jobs/:id' },
      users: { dashboard: 'GET /api/users/dashboard' }
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: { message: 'Internal server error' }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Endpoint not found' }
  });
});

// Start server
const startServer = async () => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      await testConnection();
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
🚀 JobsRo API Server Started!
📍 Port: ${PORT}
🌐 Environment: ${process.env.NODE_ENV || 'development'}
🔗 Frontend: ${process.env.FRONTEND_URL || 'Not configured'}
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

startServer();

module.exports = app;