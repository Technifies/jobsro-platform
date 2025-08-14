const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const crypto = require('crypto');
const { dbOperations, query, transaction } = require('../config/database');
const { 
  generateTokens, 
  verifyRefreshToken, 
  authenticateJWT, 
  rateLimitByUser 
} = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { sendEmail } = require('../services/email');
const logger = require('../utils/logger');

const router = express.Router();

// Register new user
router.post('/register', 
  validate(schemas.userRegistration),
  rateLimitByUser(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  async (req, res) => {
    try {
      const { email, password, first_name, last_name, phone, role } = req.body;

      // Check if user already exists
      const existingUser = await dbOperations.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists with this email' });
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create user and profile in transaction
      const result = await transaction(async (client) => {
        // Create user
        const userResult = await client.query(
          `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, email, role, first_name, last_name, phone, status, created_at`,
          [email, password_hash, role, first_name, last_name, phone]
        );
        
        const user = userResult.rows[0];

        // Create role-specific profile
        if (role === 'job_seeker') {
          await client.query(
            'INSERT INTO job_seekers (user_id) VALUES ($1)',
            [user.id]
          );
        } else if (role === 'employer') {
          await client.query(
            'INSERT INTO employers (user_id) VALUES ($1)',
            [user.id]
          );
        } else if (role === 'recruiter') {
          await client.query(
            'INSERT INTO recruiters (user_id) VALUES ($1)',
            [user.id]
          );
        }

        return user;
      });

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await query(
        `INSERT INTO email_verifications (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [result.id, verificationToken, tokenExpiry]
      );

      // Send verification email
      try {
        await sendEmail({
          to: email,
          subject: 'Welcome to JobsRo - Verify Your Email',
          template: 'email-verification',
          data: {
            name: first_name,
            verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
          }
        });
      } catch (emailError) {
        logger.error('Email verification send failed:', emailError);
        // Don't fail registration if email fails
      }

      // Generate JWT tokens
      const tokens = generateTokens(result);

      logger.info(`New user registered: ${email} (${role})`);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: result.id,
          email: result.email,
          role: result.role,
          first_name: result.first_name,
          last_name: result.last_name,
          status: result.status,
          email_verified: false
        },
        tokens
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login user
router.post('/login',
  validate(schemas.userLogin),
  rateLimitByUser(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  async (req, res) => {
    try {
      const { email, password, remember_me } = req.body;

      // Find user
      const user = await dbOperations.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check account status
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account has been suspended' });
      }

      if (user.status === 'deactivated') {
        return res.status(403).json({ error: 'Account has been deactivated' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Generate JWT tokens
      const tokens = generateTokens(user);

      // Get user profile data based on role
      let profileData = {};
      try {
        if (user.role === 'job_seeker') {
          const profile = await query(
            'SELECT * FROM job_seekers WHERE user_id = $1',
            [user.id]
          );
          profileData = profile.rows[0] || {};
        } else if (user.role === 'employer') {
          const profile = await query(
            `SELECT e.*, c.name as company_name, c.logo_url as company_logo
             FROM employers e
             LEFT JOIN companies c ON e.company_id = c.id
             WHERE e.user_id = $1`,
            [user.id]
          );
          profileData = profile.rows[0] || {};
        } else if (user.role === 'recruiter') {
          const profile = await query(
            'SELECT * FROM recruiters WHERE user_id = $1',
            [user.id]
          );
          profileData = profile.rows[0] || {};
        }
      } catch (profileError) {
        logger.warn('Profile fetch error during login:', profileError);
      }

      logger.info(`User logged in: ${email}`);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          profile_image: user.profile_image,
          status: user.status,
          email_verified: user.email_verified,
          profile: profileData
        },
        tokens
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Refresh token
router.post('/refresh',
  rateLimitByUser(10, 15 * 60 * 1000),
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      
      // Find user
      const user = await dbOperations.findUserById(decoded.userId);
      if (!user || user.status !== 'active') {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Generate new tokens
      const tokens = generateTokens(user);

      res.json({ tokens });
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
);

// Logout (client-side token removal mostly, but we can blacklist if needed)
router.post('/logout', authenticateJWT, (req, res) => {
  // In a more complex setup, you might want to blacklist the token
  logger.info(`User logged out: ${req.user.email}`);
  res.json({ message: 'Logged out successfully' });
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const result = await query(
      `SELECT user_id FROM email_verifications 
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const userId = result.rows[0].user_id;

    await transaction(async (client) => {
      // Mark email as verified
      await client.query(
        'UPDATE users SET email_verified = TRUE WHERE id = $1',
        [userId]
      );

      // Mark token as used
      await client.query(
        'UPDATE email_verifications SET used_at = NOW() WHERE token = $1',
        [token]
      );
    });

    logger.info(`Email verified for user: ${userId}`);
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Request password reset
router.post('/forgot-password',
  validate(schemas.passwordResetRequest),
  rateLimitByUser(3, 60 * 60 * 1000), // 3 attempts per hour
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await dbOperations.findUserByEmail(email);
      if (!user) {
        // Return success even if user doesn't exist (security)
        return res.json({ message: 'If an account exists, a reset link has been sent' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await query(
        `INSERT INTO password_resets (user_id, token, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
         token = $2, expires_at = $3, created_at = NOW()`,
        [user.id, resetToken, tokenExpiry]
      );

      // Send reset email
      try {
        await sendEmail({
          to: email,
          subject: 'JobsRo - Password Reset Request',
          template: 'password-reset',
          data: {
            name: user.first_name,
            resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
          }
        });
      } catch (emailError) {
        logger.error('Password reset email send failed:', emailError);
        return res.status(500).json({ error: 'Failed to send reset email' });
      }

      logger.info(`Password reset requested for: ${email}`);
      res.json({ message: 'If an account exists, a reset link has been sent' });
    } catch (error) {
      logger.error('Password reset request error:', error);
      res.status(500).json({ error: 'Password reset request failed' });
    }
  }
);

// Reset password
router.post('/reset-password',
  validate(schemas.passwordReset),
  rateLimitByUser(5, 60 * 60 * 1000),
  async (req, res) => {
    try {
      const { token, new_password } = req.body;

      const result = await query(
        `SELECT user_id FROM password_resets 
         WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const userId = result.rows[0].user_id;

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const password_hash = await bcrypt.hash(new_password, saltRounds);

      await transaction(async (client) => {
        // Update password
        await client.query(
          'UPDATE users SET password_hash = $1 WHERE id = $2',
          [password_hash, userId]
        );

        // Mark reset token as used
        await client.query(
          'UPDATE password_resets SET used_at = NOW() WHERE token = $1',
          [token]
        );
      });

      logger.info(`Password reset completed for user: ${userId}`);
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  }
);

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const tokens = generateTokens(req.user);
      
      // Redirect to frontend with tokens
      const redirectUrl = new URL('/auth/callback', process.env.FRONTEND_URL);
      redirectUrl.searchParams.set('token', tokens.accessToken);
      redirectUrl.searchParams.set('refresh', tokens.refreshToken);
      
      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }
  }
);

// LinkedIn OAuth routes
router.get('/linkedin',
  passport.authenticate('linkedin', { scope: ['r_emailaddress', 'r_liteprofile'] })
);

router.get('/linkedin/callback',
  passport.authenticate('linkedin', { session: false }),
  async (req, res) => {
    try {
      const tokens = generateTokens(req.user);
      
      const redirectUrl = new URL('/auth/callback', process.env.FRONTEND_URL);
      redirectUrl.searchParams.set('token', tokens.accessToken);
      redirectUrl.searchParams.set('refresh', tokens.refreshToken);
      
      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('LinkedIn OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }
  }
);

// Get current user info
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    
    // Get profile data based on role
    let profileData = {};
    if (user.role === 'job_seeker') {
      const profile = await query(
        'SELECT * FROM job_seekers WHERE user_id = $1',
        [user.id]
      );
      profileData = profile.rows[0] || {};
    } else if (user.role === 'employer') {
      const profile = await query(
        `SELECT e.*, c.name as company_name, c.logo_url as company_logo
         FROM employers e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE e.user_id = $1`,
        [user.id]
      );
      profileData = profile.rows[0] || {};
    } else if (user.role === 'recruiter') {
      const profile = await query(
        'SELECT * FROM recruiters WHERE user_id = $1',
        [user.id]
      );
      profileData = profile.rows[0] || {};
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        profile_image: user.profile_image,
        status: user.status,
        email_verified: user.email_verified,
        profile: profileData
      }
    });
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

module.exports = router;