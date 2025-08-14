const jwt = require('jsonwebtoken');
const passport = require('passport');
const { dbOperations } = require('../config/database');
const logger = require('../utils/logger');

// JWT Authentication Middleware
const authenticateJWT = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('JWT Authentication Error:', err);
      return res.status(500).json({ error: 'Authentication error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - Invalid or expired token' });
    }
    
    req.user = user;
    next();
  })(req, res, next);
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('Optional Auth Error:', err);
    }
    
    if (user) {
      req.user = user;
    }
    
    next();
  })(req, res, next);
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Check if user owns resource or is admin
const requireOwnershipOrAdmin = (resourceIdParam = 'id', userIdField = 'user_id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Admin can access everything
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceId = req.params[resourceIdParam];
      
      // If checking user's own profile
      if (resourceIdParam === 'id' && resourceId === req.user.id) {
        return next();
      }

      // Check resource ownership
      const resource = await dbOperations.query(
        `SELECT ${userIdField} FROM ${req.resourceTable} WHERE id = $1`,
        [resourceId]
      );

      if (!resource.rows[0]) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      if (resource.rows[0][userIdField] !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

// Verify email middleware
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  next();
};

// Account status check middleware
const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.status !== 'active') {
    let message = 'Account access restricted';
    
    switch (req.user.status) {
      case 'pending':
        message = 'Account activation pending';
        break;
      case 'suspended':
        message = 'Account has been suspended';
        break;
      case 'deactivated':
        message = 'Account has been deactivated';
        break;
    }

    return res.status(403).json({ 
      error: message,
      code: 'ACCOUNT_RESTRICTED',
      status: req.user.status
    });
  }

  next();
};

// Rate limiting for sensitive operations
const rateLimitByUser = (maxRequests = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const userAttempts = attempts.get(userId) || [];

    // Clean old attempts
    const recentAttempts = userAttempts.filter(time => now - time < windowMs);

    if (recentAttempts.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000)
      });
    }

    recentAttempts.push(now);
    attempts.set(userId, recentAttempts);

    next();
  };
};

// Generate JWT tokens
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256'
  });

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  });

  return { accessToken, refreshToken };
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, {
      algorithms: ['HS256']
    });
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Extract user info from token without verification (for logging)
const extractUserFromToken = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.decode(token);
    return decoded;
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateJWT,
  optionalAuth,
  requireRole,
  requireOwnershipOrAdmin,
  requireVerifiedEmail,
  requireActiveAccount,
  rateLimitByUser,
  generateTokens,
  verifyRefreshToken,
  extractUserFromToken
};