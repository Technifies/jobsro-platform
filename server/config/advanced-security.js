const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const validator = require('validator');
const jwt = require('jsonwebtoken');

/**
 * Advanced Security Configuration for JobsRo Platform
 * Comprehensive security hardening, threat detection, and protection
 */

class SecurityManager {
  constructor() {
    this.suspiciousIPs = new Set();
    this.rateLimitStore = new Map();
    this.securityEvents = [];
    this.activeThreats = new Map();
  }

  // Advanced rate limiting with adaptive thresholds
  createAdaptiveRateLimit(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
      },
      onLimitReached: (req, res, options) => {
        this.logSecurityEvent('rate_limit_exceeded', {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          path: req.path,
          timestamp: Date.now()
        });
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  // Comprehensive security headers
  getSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://checkout.razorpay.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "https://api.razorpay.com", "wss:"],
          frameSrc: ["https://js.stripe.com", "https://checkout.razorpay.com"],
          mediaSrc: ["'self'", "blob:"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: "same-origin" },
      xssFilter: true
    });
  }

  // Advanced input validation and sanitization
  validateAndSanitize = {
    email: (email) => {
      if (!email || typeof email !== 'string') return null;
      const sanitized = validator.normalizeEmail(email.trim().toLowerCase());
      return validator.isEmail(sanitized) ? sanitized : null;
    },

    password: (password) => {
      if (!password || typeof password !== 'string') return null;
      // Check password strength
      const minLength = 8;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasNonalphas = /\W/.test(password);
      
      if (password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas) {
        return password;
      }
      return null;
    },

    name: (name) => {
      if (!name || typeof name !== 'string') return null;
      const sanitized = validator.escape(name.trim());
      return validator.isLength(sanitized, { min: 1, max: 50 }) ? sanitized : null;
    },

    phone: (phone) => {
      if (!phone || typeof phone !== 'string') return null;
      const sanitized = phone.replace(/\D/g, ''); // Remove non-digits
      return validator.isMobilePhone(sanitized, 'any') ? sanitized : null;
    },

    url: (url) => {
      if (!url || typeof url !== 'string') return null;
      return validator.isURL(url, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_host: true,
        require_valid_protocol: true,
        allow_underscores: false,
        host_whitelist: false,
        host_blacklist: false,
        allow_trailing_dot: false,
        allow_protocol_relative_urls: false
      }) ? url : null;
    },

    jobTitle: (title) => {
      if (!title || typeof title !== 'string') return null;
      const sanitized = validator.escape(title.trim());
      return validator.isLength(sanitized, { min: 3, max: 100 }) ? sanitized : null;
    },

    jobDescription: (description) => {
      if (!description || typeof description !== 'string') return null;
      const sanitized = validator.escape(description.trim());
      return validator.isLength(sanitized, { min: 50, max: 5000 }) ? sanitized : null;
    },

    salary: (salary) => {
      if (!salary) return null;
      const numericSalary = parseInt(salary);
      return (numericSalary >= 0 && numericSalary <= 10000000) ? numericSalary : null;
    }
  };

  // SQL injection prevention
  preventSQLInjection(query) {
    const sqlInjectionPatterns = [
      /('|(\\'))|(;\s*(drop|alter|create|delete|insert|update)\s)/i,
      /union\s+select/i,
      /exec\s*\(/i,
      /script\s*:/i,
      /<\s*script/i,
      /javascript\s*:/i
    ];

    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(query)) {
        this.logSecurityEvent('sql_injection_attempt', {
          query: query.substring(0, 100),
          timestamp: Date.now()
        });
        return false;
      }
    }
    return true;
  }

  // XSS prevention
  preventXSS(input) {
    const xssPatterns = [
      /<\s*script/i,
      /javascript\s*:/i,
      /on\w+\s*=/i,
      /<\s*iframe/i,
      /<\s*object/i,
      /<\s*embed/i,
      /<\s*link/i
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(input)) {
        this.logSecurityEvent('xss_attempt', {
          input: input.substring(0, 100),
          timestamp: Date.now()
        });
        return false;
      }
    }
    return true;
  }

  // CSRF token generation and validation
  generateCSRFToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHmac('sha256', process.env.CSRF_SECRET || 'csrf-secret')
      .update(sessionId + token)
      .digest('hex');
    
    return `${token}.${hash}`;
  }

  validateCSRFToken(token, sessionId) {
    if (!token || !sessionId) return false;
    
    const [tokenPart, hashPart] = token.split('.');
    if (!tokenPart || !hashPart) return false;
    
    const expectedHash = crypto.createHmac('sha256', process.env.CSRF_SECRET || 'csrf-secret')
      .update(sessionId + tokenPart)
      .digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(hashPart, 'hex'), Buffer.from(expectedHash, 'hex'));
  }

  // Advanced JWT security
  createSecureJWT(payload, options = {}) {
    const defaultOptions = {
      expiresIn: '15m', // Short expiry for access tokens
      issuer: 'jobsro-api',
      audience: 'jobsro-client',
      algorithm: 'HS256'
    };

    const jwtOptions = { ...defaultOptions, ...options };
    const token = jwt.sign(payload, process.env.JWT_SECRET, jwtOptions);
    
    // Create refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    return {
      accessToken: token,
      refreshToken: refreshToken,
      expiresIn: jwtOptions.expiresIn
    };
  }

  // Enhanced password hashing
  async hashPassword(password, rounds = 12) {
    const bcrypt = require('bcryptjs');
    
    // Add pepper (additional secret)
    const pepper = process.env.PASSWORD_PEPPER || 'default-pepper';
    const passwordWithPepper = password + pepper;
    
    // Hash with salt and rounds
    const salt = await bcrypt.genSalt(rounds);
    return await bcrypt.hash(passwordWithPepper, salt);
  }

  async verifyPassword(password, hash) {
    const bcrypt = require('bcryptjs');
    const pepper = process.env.PASSWORD_PEPPER || 'default-pepper';
    const passwordWithPepper = password + pepper;
    
    return await bcrypt.compare(passwordWithPepper, hash);
  }

  // Threat detection and response
  detectThreat(req, threatType) {
    const clientIP = req.ip;
    const userAgent = req.get('user-agent');
    const timestamp = Date.now();
    
    const threatKey = `${clientIP}-${threatType}`;
    
    if (!this.activeThreats.has(threatKey)) {
      this.activeThreats.set(threatKey, {
        count: 0,
        firstSeen: timestamp,
        lastSeen: timestamp
      });
    }
    
    const threat = this.activeThreats.get(threatKey);
    threat.count++;
    threat.lastSeen = timestamp;
    
    // Auto-block after 5 threats in 15 minutes
    if (threat.count >= 5 && (timestamp - threat.firstSeen) <= 15 * 60 * 1000) {
      this.suspiciousIPs.add(clientIP);
      this.logSecurityEvent('ip_blocked', {
        ip: clientIP,
        threatType,
        count: threat.count,
        timestamp
      });
      
      // Auto-unblock after 1 hour
      setTimeout(() => {
        this.suspiciousIPs.delete(clientIP);
        this.activeThreats.delete(threatKey);
      }, 60 * 60 * 1000);
    }
  }

  // Security event logging
  logSecurityEvent(type, details) {
    const event = {
      type,
      details,
      timestamp: Date.now(),
      severity: this.getEventSeverity(type)
    };
    
    this.securityEvents.push(event);
    
    // Log to system logger
    const logger = require('../utils/logger');
    logger.warn('Security Event', event);
    
    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-500);
    }
    
    // Send alerts for critical events
    if (event.severity === 'critical') {
      this.sendSecurityAlert(event);
    }
  }

  getEventSeverity(type) {
    const severityMap = {
      'rate_limit_exceeded': 'low',
      'xss_attempt': 'high',
      'sql_injection_attempt': 'critical',
      'ip_blocked': 'medium',
      'brute_force_attempt': 'high',
      'unauthorized_access': 'critical',
      'suspicious_activity': 'medium'
    };
    
    return severityMap[type] || 'low';
  }

  // Send security alerts
  async sendSecurityAlert(event) {
    // In production, this would send alerts via email/SMS/Slack
    console.error('🚨 CRITICAL SECURITY ALERT:', event);
    
    // Could integrate with external monitoring services
    // await this.sendToMonitoringService(event);
  }

  // Security middleware factory
  createSecurityMiddleware() {
    return (req, res, next) => {
      // Block suspicious IPs
      if (this.suspiciousIPs.has(req.ip)) {
        this.logSecurityEvent('blocked_request', {
          ip: req.ip,
          path: req.path,
          timestamp: Date.now()
        });
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Validate common inputs for XSS
      const inputsToCheck = [req.query, req.body, req.params];
      for (const inputs of inputsToCheck) {
        if (inputs) {
          for (const [key, value] of Object.entries(inputs)) {
            if (typeof value === 'string' && !this.preventXSS(value)) {
              this.detectThreat(req, 'xss_attempt');
              return res.status(400).json({ error: 'Invalid input detected' });
            }
          }
        }
      }
      
      next();
    };
  }

  // Get security status
  getSecurityStatus() {
    return {
      suspiciousIPs: Array.from(this.suspiciousIPs),
      activeThreats: this.activeThreats.size,
      recentEvents: this.securityEvents.slice(-10),
      totalEvents: this.securityEvents.length,
      criticalEvents: this.securityEvents.filter(e => e.severity === 'critical').length
    };
  }

  // Security audit report
  generateSecurityAudit() {
    const now = Date.now();
    const last24Hours = this.securityEvents.filter(e => now - e.timestamp <= 24 * 60 * 60 * 1000);
    
    const eventTypes = {};
    last24Hours.forEach(event => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });
    
    return {
      timestamp: new Date().toISOString(),
      period: '24_hours',
      totalEvents: last24Hours.length,
      eventBreakdown: eventTypes,
      blockedIPs: Array.from(this.suspiciousIPs),
      activeThreats: this.activeThreats.size,
      recommendations: this.getSecurityRecommendations()
    };
  }

  getSecurityRecommendations() {
    const recommendations = [];
    
    if (this.suspiciousIPs.size > 10) {
      recommendations.push('High number of blocked IPs detected. Consider implementing additional DDoS protection.');
    }
    
    if (this.securityEvents.filter(e => e.type === 'sql_injection_attempt').length > 0) {
      recommendations.push('SQL injection attempts detected. Ensure all database queries use parameterized statements.');
    }
    
    if (this.securityEvents.filter(e => e.type === 'xss_attempt').length > 5) {
      recommendations.push('Multiple XSS attempts detected. Review input validation and output encoding.');
    }
    
    return recommendations;
  }
}

// Create global security manager instance
const securityManager = new SecurityManager();

module.exports = {
  SecurityManager,
  securityManager
};