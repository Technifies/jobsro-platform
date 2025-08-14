const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');

/**
 * Security Configuration for JobsRo Platform
 * Comprehensive security middleware and configurations
 */

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator: (req) => {
      // Use IP + user ID for authenticated requests
      return req.user ? `${req.ip}_${req.user.id}` : req.ip;
    }
  });
};

// Different rate limits for different endpoints
const rateLimiters = {
  // General API rate limiting
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many requests from this IP, please try again later.'
  ),

  // Strict rate limiting for authentication endpoints
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts per window
    'Too many authentication attempts, please try again later.',
    true // Skip successful requests
  ),

  // Password reset rate limiting
  passwordReset: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 requests per hour
    'Too many password reset requests, please try again later.'
  ),

  // File upload rate limiting
  upload: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    10, // 10 uploads per hour
    'Too many file uploads, please try again later.'
  ),

  // Email/SMS sending rate limiting
  messaging: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    20, // 20 messages per hour
    'Too many messages sent, please try again later.'
  ),

  // Job posting rate limiting
  jobPosting: createRateLimiter(
    24 * 60 * 60 * 1000, // 24 hours
    10, // 10 job posts per day
    'Too many job postings, please try again tomorrow.'
  ),

  // Application rate limiting
  applications: createRateLimiter(
    24 * 60 * 60 * 1000, // 24 hours
    50, // 50 applications per day
    'Too many applications submitted, please try again tomorrow.'
  )
};

// Speed limiting (progressive delays)
const speedLimiters = {
  general: slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per window without delay
    delayMs: 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // Maximum delay of 20 seconds
  }),

  auth: slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 2, // Start delaying after 2 requests
    delayMs: 1000, // 1 second delay per request
    maxDelayMs: 10000, // Maximum delay of 10 seconds
  })
};

// Security headers configuration
const securityHeaders = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://api.razorpay.com", 
        "https://api.openai.com",
        "https://api.zoom.us",
        "https://www.googleapis.com"
      ],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://meet.google.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
};

// Input sanitization and validation
const sanitizationConfig = {
  // XSS protection
  xss: {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  },

  // NoSQL injection protection
  mongoSanitize: {
    replaceWith: '_',
    onSanitize: (key, value) => {
      console.warn(`Sanitized input: ${key} = ${value}`);
    }
  },

  // HTTP Parameter Pollution protection
  hpp: {
    whitelist: ['skills', 'locations', 'tags'] // Allow arrays for these fields
  }
};

// File upload security
const fileUploadSecurity = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Single file upload
    fields: 10, // Maximum form fields
    parts: 50 // Maximum multipart parts
  },
  
  allowedMimeTypes: {
    resumes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ],
    images: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ]
  },

  fileFilter: (allowedTypes) => (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  }
};

// Session security configuration
const sessionSecurity = {
  name: 'jobsro_session', // Change default session name
  secret: process.env.SESSION_SECRET || 'complex-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS access to cookies
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
};

// CORS security configuration
const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ].filter(Boolean);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-razorpay-signature'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

// Database security configuration
const databaseSecurity = {
  // Connection pool configuration
  pool: {
    max: 20, // Maximum connections
    min: 5,  // Minimum connections
    acquire: 30000, // Maximum time to get connection
    idle: 10000, // Maximum idle time
  },

  // Query timeout
  queryTimeout: 30000, // 30 seconds

  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    require: true,
    rejectUnauthorized: false
  } : false,

  // Prepared statement configuration
  preparedStatements: true
};

// API security middleware
const apiSecurity = {
  // Request validation middleware
  validateRequest: (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  },

  // Request logging middleware
  requestLogger: (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || 'anonymous'
      };
      
      console.log(JSON.stringify(logData));
    });
    
    next();
  },

  // Security headers middleware
  securityHeaders: (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  }
};

// Password security configuration
const passwordSecurity = {
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLength: 128
  },

  passwordValidation: (password) => {
    const policy = passwordSecurity.passwordPolicy;
    const errors = [];

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (password.length > policy.maxLength) {
      errors.push(`Password must not exceed ${policy.maxLength} characters`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

module.exports = {
  rateLimiters,
  speedLimiters,
  securityHeaders,
  sanitizationConfig,
  fileUploadSecurity,
  sessionSecurity,
  corsConfig,
  databaseSecurity,
  apiSecurity,
  passwordSecurity
};