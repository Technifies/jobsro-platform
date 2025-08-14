const express = require('express');
const path = require('path');
const cors = require('cors');

// Import our API server logic
const { query, transaction, testConnection } = require('./config/database-simple');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (including our demo.html)
app.use(express.static(path.join(__dirname, '..')));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
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
    
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user || password !== user.password) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' }
      });
    }
    
    // Generate JWT token (simplified)
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
          firstName: user.firstName,
          lastName: user.lastName,
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

// Jobs endpoints
app.get('/api/jobs', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, location } = req.query;
    
    const result = await query('SELECT * FROM jobs WHERE status = $1', ['active']);
    let jobs = result.rows;
    
    // Simple filtering
    if (search) {
      jobs = jobs.filter(job => 
        job.title.toLowerCase().includes(search.toLowerCase()) ||
        job.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (location) {
      jobs = jobs.filter(job => 
        job.location.toLowerCase().includes(location.toLowerCase())
      );
    }
    
    // Simple pagination
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

// Get single job
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

// User dashboard
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

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'JobsRo API',
    version: '1.0.0',
    description: 'Complete Job Portal Platform API',
    demoUrl: `http://localhost:${PORT}/demo.html`,
    endpoints: {
      health: 'GET /health',
      auth: {
        login: 'POST /api/auth/login'
      },
      jobs: {
        list: 'GET /api/jobs',
        detail: 'GET /api/jobs/:id'
      },
      users: {
        dashboard: 'GET /api/users/dashboard'
      }
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.redirect('/demo.html');
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
    await testConnection();
    
    app.listen(PORT, () => {
      console.log(`
🚀 JobsRo Demo Server Started Successfully!
📍 Server: http://localhost:${PORT}
🌐 Demo App: http://localhost:${PORT}/demo.html
🏥 Health: http://localhost:${PORT}/health
📚 API: http://localhost:${PORT}/api
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();