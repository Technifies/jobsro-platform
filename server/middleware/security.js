const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const hpp = require('hpp');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { securityConfig } = require('../config/security');

/**
 * Security Middleware for JobsRo Platform
 * Comprehensive security protection and monitoring
 */

// Advanced rate limiting with dynamic thresholds
const createDynamicRateLimit = (baseConfig) => {
  return (req, res, next) => {
    // Adjust rate limits based on user authentication and role
    let config = { ...baseConfig };
    
    if (req.user) {
      // Authenticated users get higher limits
      config.max = config.max * 2;
      
      // Premium users get even higher limits
      if (req.user.subscription === 'premium') {
        config.max = config.max * 1.5;
      }
      
      // Admin users get unlimited access (with logging)
      if (req.user.role === 'admin') {
        config.max = Number.MAX_SAFE_INTEGER;
      }
    }
    
    const limiter = rateLimit(config);
    return limiter(req, res, next);
  };
};

// IP reputation and blocking system
class IPReputationManager {
  constructor() {
    this.suspiciousIPs = new Map(); // IP -> { score, lastSeen, violations }
    this.blockedIPs = new Set();
    this.whitelistedIPs = new Set([
      '127.0.0.1',
      '::1',
      // Add trusted IPs here
    ]);
  }

  addViolation(ip, violationType, severity = 1) {
    if (this.whitelistedIPs.has(ip)) return;
    
    const current = this.suspiciousIPs.get(ip) || { score: 0, lastSeen: Date.now(), violations: [] };
    current.score += severity;
    current.lastSeen = Date.now();
    current.violations.push({ type: violationType, timestamp: Date.now(), severity });
    
    this.suspiciousIPs.set(ip, current);
    
    // Auto-block if score exceeds threshold
    if (current.score >= 50) {
      this.blockIP(ip, `Auto-blocked for suspicious activity: ${violationType}`);
    }
    
    logger.warn(`Security violation: ${violationType} from IP ${ip}, score: ${current.score}`);
  }

  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    logger.error(`IP blocked: ${ip}, reason: ${reason}`);
    
    // Store in database for persistence
    query(`
      INSERT INTO blocked_ips (ip_address, reason, blocked_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (ip_address) DO UPDATE SET
        reason = $2,
        blocked_at = NOW()
    `, [ip, reason]).catch(err => logger.error('Failed to store blocked IP:', err));
  }

  isBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  getReputation(ip) {
    const data = this.suspiciousIPs.get(ip);
    if (!data) return { score: 0, risk: 'low' };
    
    let risk = 'low';
    if (data.score >= 30) risk = 'high';
    else if (data.score >= 15) risk = 'medium';
    
    return { score: data.score, risk, violations: data.violations };
  }

  cleanup() {
    // Clean up old entries (older than 24 hours)
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (data.lastSeen < cutoff) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }
}

const ipReputationManager = new IPReputationManager();

// Run cleanup every hour
setInterval(() => ipReputationManager.cleanup(), 60 * 60 * 1000);

// IP blocking middleware
const ipBlockingMiddleware = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (ipReputationManager.isBlocked(clientIP)) {
    logger.warn(`Blocked IP attempted access: ${clientIP}`);
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked due to suspicious activity'
    });
  }
  
  next();
};

// Advanced input validation middleware
const advancedInputValidation = (req, res, next) => {
  const validateInput = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string') {
        // Check for common attack patterns
        const suspiciousPatterns = [
          /<script/i,
          /javascript:/i,
          /vbscript:/i,
          /onload=/i,
          /onerror=/i,
          /eval\(/i,
          /expression\(/i,
          /UNION.*SELECT/i,
          /DROP.*TABLE/i,
          /INSERT.*INTO/i,
          /DELETE.*FROM/i,
          /'.*OR.*'.*='.*'/i,
          /\.\.\//,
          /\/etc\/passwd/,
          /cmd\.exe/i,
          /powershell/i
        ];
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(value)) {
            ipReputationManager.addViolation(req.ip, `malicious_input_${currentPath}`, 10);
            logger.warn(`Malicious input detected in ${currentPath}: ${value.substring(0, 100)}`);
            return res.status(400).json({
              error: 'Invalid input detected',
              field: currentPath
            });
          }
        }
        
        // Check for excessive length
        if (value.length > 10000) {
          ipReputationManager.addViolation(req.ip, `excessive_input_length_${currentPath}`, 3);
          return res.status(400).json({
            error: 'Input too long',
            field: currentPath,
            maxLength: 10000
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        const result = validateInput(value, currentPath);
        if (result) return result;
      }
    }
  };
  
  // Validate request body
  if (req.body && typeof req.body === 'object') {
    const result = validateInput(req.body);
    if (result) return result;
  }
  
  // Validate query parameters
  if (req.query && typeof req.query === 'object') {
    const result = validateInput(req.query, 'query');
    if (result) return result;
  }
  
  next();
};

// File upload security middleware
const secureFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) return next();
    
    const files = req.files ? Object.values(req.files).flat() : [req.file];
    
    for (const file of files) {
      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        ipReputationManager.addViolation(req.ip, 'invalid_file_type', 5);
        return res.status(400).json({
          error: 'Invalid file type',
          allowed: allowedTypes,
          received: file.mimetype
        });
      }
      
      // Check file size
      if (file.size > maxSize) {
        ipReputationManager.addViolation(req.ip, 'file_too_large', 3);
        return res.status(400).json({
          error: 'File too large',
          maxSize,
          received: file.size
        });
      }
      
      // Check for malicious file names
      const suspiciousFilePatterns = [
        /\.exe$/i,
        /\.bat$/i,
        /\.cmd$/i,
        /\.scr$/i,
        /\.vbs$/i,
        /\.js$/i,
        /\.jar$/i,
        /\.php$/i,
        /\.asp$/i,
        /\.jsp$/i
      ];
      
      for (const pattern of suspiciousFilePatterns) {
        if (pattern.test(file.originalname)) {
          ipReputationManager.addViolation(req.ip, 'malicious_file_upload', 15);
          return res.status(400).json({
            error: 'Suspicious file name detected',
            filename: file.originalname
          });
        }
      }
      
      // Scan file content for basic malware signatures
      if (file.buffer) {
        const content = file.buffer.toString('hex').toLowerCase();
        const malwareSignatures = [
          '4d5a', // PE header
          '504b', // ZIP header (potential malware in archives)
          '89504e47', // PNG header with unusual content
        ];
        
        // This is a basic check - in production, use a proper antivirus service
        const hasHeader = malwareSignatures.some(sig => content.startsWith(sig));
        if (hasHeader && file.mimetype !== 'application/zip' && !file.mimetype.startsWith('image/')) {
          ipReputationManager.addViolation(req.ip, 'potential_malware_upload', 20);
          return res.status(400).json({
            error: 'File failed security scan'
          });
        }
      }
    }
    
    next();
  };
};

// SQL injection detection middleware
const sqlInjectionDetection = (req, res, next) => {
  const checkForSQLInjection = (value) => {
    if (typeof value !== 'string') return false;
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(\b(UNION|JOIN)\b.*\b(SELECT)\b)/i,
      /'.*OR.*'.*='.*'/i,
      /;\s*(DROP|DELETE|INSERT|UPDATE)/i,
      /\b(AND|OR)\s+\d+\s*=\s*\d+/i,
      /\b(AND|OR)\s+'.*'='.*'/i,
      /\/\*.*\*\//,
      /--[^\r\n]*/,
      /\bxp_cmdshell\b/i,
      /\bsp_executesql\b/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(value));
  };
  
  const checkObject = (obj) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && checkForSQLInjection(value)) {
        return { field: key, value };
      } else if (typeof value === 'object' && value !== null) {
        const result = checkObject(value);
        if (result) return result;
      }
    }
    return null;
  };
  
  // Check body
  if (req.body) {
    const sqlInjection = checkObject(req.body);
    if (sqlInjection) {
      ipReputationManager.addViolation(req.ip, 'sql_injection_attempt', 25);
      logger.error(`SQL injection attempt detected: ${sqlInjection.field} = ${sqlInjection.value}`);
      return res.status(400).json({
        error: 'Malicious input detected'
      });
    }
  }
  
  // Check query parameters
  if (req.query) {
    const sqlInjection = checkObject(req.query);
    if (sqlInjection) {
      ipReputationManager.addViolation(req.ip, 'sql_injection_attempt', 25);
      logger.error(`SQL injection attempt detected in query: ${sqlInjection.field} = ${sqlInjection.value}`);
      return res.status(400).json({
        error: 'Malicious input detected'
      });
    }
  }
  
  next();
};

// Enhanced authentication monitoring
const authenticationMonitoring = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Monitor failed authentication attempts
    if (req.path.includes('/auth/') && res.statusCode === 401) {
      ipReputationManager.addViolation(req.ip, 'failed_authentication', 3);
      
      // Log detailed authentication failure
      logger.warn('Authentication failure', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
    
    // Monitor successful logins
    if (req.path.includes('/auth/login') && res.statusCode === 200) {
      logger.info('Successful login', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET requests and API endpoints with proper authentication
  if (req.method === 'GET' || req.path.startsWith('/api/')) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    ipReputationManager.addViolation(req.ip, 'csrf_violation', 8);
    return res.status(403).json({
      error: 'CSRF token invalid'
    });
  }
  
  next();
};

// Request signature validation for webhooks
const validateWebhookSignature = (secret) => {
  return (req, res, next) => {
    const signature = req.headers['x-webhook-signature'] || req.headers['x-razorpay-signature'];
    
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    const payload = JSON.stringify(req.body);
    const expectedSignature = require('crypto')
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      ipReputationManager.addViolation(req.ip, 'invalid_webhook_signature', 10);
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
  };
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Set comprehensive security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.razorpay.com https://api.openai.com",
      "frame-src 'self' https://api.razorpay.com"
    ].join('; ')
  });
  
  next();
};

// Request timeout middleware
const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout'
        });
      }
    }, timeout);
    
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    
    next();
  };
};

// Security audit logging
const securityAuditLog = (req, res, next) => {
  const startTime = Date.now();
  
  // Log security-relevant events
  if (req.path.includes('/admin/') || req.path.includes('/auth/')) {
    logger.info('Security audit', {
      type: 'access_attempt',
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log failed requests
    if (res.statusCode >= 400) {
      logger.warn('Failed request', {
        path: req.path,
        method: req.method,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userId: req.user?.id
      });
    }
  });
  
  next();
};

module.exports = {
  ipReputationManager,
  ipBlockingMiddleware,
  advancedInputValidation,
  secureFileUpload,
  sqlInjectionDetection,
  authenticationMonitoring,
  csrfProtection,
  validateWebhookSignature,
  securityHeaders,
  requestTimeout,
  securityAuditLog,
  createDynamicRateLimit
};