const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');
require('dotenv').config();

// Import configurations
const { connectDB } = require('./config/database');
const { setupPassport } = require('./config/passport');
const logger = require('./utils/logger');
const { securityManager } = require('./config/advanced-security');
const { cacheManager } = require('./config/cache');
const { performanceMonitor } = require('./utils/performance');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const companyRoutes = require('./routes/companies');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const interviewRoutes = require('./routes/interviews');
const notificationRoutes = require('./routes/notifications');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const securityMiddleware = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for deployment
app.set('trust proxy', 1);

// Initialize performance monitoring
if (process.env.NODE_ENV === 'production') {
  performanceMonitor.start();
  app.use(performanceMonitor.trackRequest.bind(performanceMonitor));
}

// Global request tracker for clustering
app.use((req, res, next) => {
  if (global.trackRequest) {
    global.trackRequest();
  }
  next();
});

// Advanced security middleware
app.use(securityManager.getSecurityHeaders());
app.use(securityManager.createSecurityMiddleware());

// Advanced adaptive rate limiting
const limiter = securityManager.createAdaptiveRateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use('/api', limiter);

// Cache middleware for static responses
app.use('/api/jobs/categories', cacheManager.createCacheMiddleware({ ttl: 3600 }));
app.use('/api/jobs/locations', cacheManager.createCacheMiddleware({ ttl: 1800 }));

// Compression middleware
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature']
}));

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing middleware with security
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Check for potential payload attacks
    const bodyStr = buf.toString();
    if (!securityManager.preventXSS(bodyStr) || !securityManager.preventSQLInjection(bodyStr)) {
      throw new Error('Invalid request payload');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Redis session store setup
let redisClient;
if (process.env.NODE_ENV === 'production') {
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  });
  
  redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });
  
  redisClient.connect().catch(console.error);
}

// Session configuration
app.use(session({
  store: redisClient ? new RedisStore({ client: redisClient }) : undefined,
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Initialize passport
setupPassport(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    if (redisClient) {
      redisClient.quit();
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    if (redisClient) {
      redisClient.quit();
    }
    process.exit(0);
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 JobsRo Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 API Base URL: http://localhost:${PORT}/api`);
    });
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;