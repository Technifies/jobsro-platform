const Joi = require('joi');
const logger = require('../utils/logger');

// Custom validation middleware
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context.value
      }));

      logger.warn('Validation failed:', { errors, property });
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace the original data with validated/sanitized data
    req[property] = value;
    next();
  };
};

// Common validation schemas
const schemas = {
  // User Registration
  userRegistration: Joi.object({
    email: Joi.string().email().max(255).required(),
    password: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    first_name: Joi.string().max(100).required(),
    last_name: Joi.string().max(100).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    role: Joi.string().valid('job_seeker', 'employer', 'recruiter').required()
  }),

  // User Login
  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    remember_me: Joi.boolean().default(false)
  }),

  // Password Reset Request
  passwordResetRequest: Joi.object({
    email: Joi.string().email().required()
  }),

  // Password Reset
  passwordReset: Joi.object({
    token: Joi.string().required(),
    new_password: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  }),

  // Profile Update
  profileUpdate: Joi.object({
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    profile_image: Joi.string().uri().optional()
  }),

  // Job Seeker Profile
  jobSeekerProfile: Joi.object({
    headline: Joi.string().max(200).optional(),
    summary: Joi.string().max(2000).optional(),
    current_location: Joi.string().max(100).optional(),
    preferred_locations: Joi.array().items(Joi.string().max(100)).max(10).optional(),
    expected_salary_min: Joi.number().integer().min(0).optional(),
    expected_salary_max: Joi.number().integer().min(0).optional(),
    currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP').default('INR'),
    experience_years: Joi.number().integer().min(0).max(50).optional(),
    current_company: Joi.string().max(100).optional(),
    current_position: Joi.string().max(100).optional(),
    notice_period_days: Joi.number().integer().min(0).max(365).optional(),
    skills: Joi.array().items(Joi.string().max(50)).max(50).optional(),
    languages: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    availability_status: Joi.string().valid(
      'actively_looking', 'open_to_opportunities', 'not_looking'
    ).default('actively_looking')
  }),

  // Job Posting
  jobPosting: Joi.object({
    title: Joi.string().max(200).required(),
    description: Joi.string().min(100).max(5000).required(),
    requirements: Joi.string().max(2000).optional(),
    responsibilities: Joi.string().max(2000).optional(),
    location: Joi.string().max(100).required(),
    remote_ok: Joi.boolean().default(false),
    employment_type: Joi.string().valid(
      'full_time', 'part_time', 'contract', 'internship', 'temporary'
    ).required(),
    experience_min: Joi.number().integer().min(0).max(50).optional(),
    experience_max: Joi.number().integer().min(0).max(50).optional(),
    salary_min: Joi.number().integer().min(0).optional(),
    salary_max: Joi.number().integer().min(0).optional(),
    salary_disclosed: Joi.boolean().default(false),
    currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP').default('INR'),
    skills_required: Joi.array().items(Joi.string().max(50)).max(20).optional(),
    education_level: Joi.string().max(100).optional(),
    industry: Joi.string().max(100).optional(),
    job_function: Joi.string().max(100).optional(),
    application_deadline: Joi.date().min('now').optional(),
    openings_count: Joi.number().integer().min(1).max(100).default(1),
    is_featured: Joi.boolean().default(false),
    is_premium: Joi.boolean().default(false)
  }),

  // Job Application
  jobApplication: Joi.object({
    cover_letter: Joi.string().max(2000).optional(),
    resume_url: Joi.string().uri().optional(),
    applied_salary_expectation: Joi.number().integer().min(0).optional()
  }),

  // Job Search
  jobSearch: Joi.object({
    keywords: Joi.string().max(200).optional(),
    location: Joi.string().max(100).optional(),
    skills: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    employment_type: Joi.array().items(
      Joi.string().valid('full_time', 'part_time', 'contract', 'internship', 'temporary')
    ).max(5).optional(),
    experience_min: Joi.number().integer().min(0).max(50).optional(),
    experience_max: Joi.number().integer().min(0).max(50).optional(),
    salary_min: Joi.number().integer().min(0).optional(),
    salary_max: Joi.number().integer().min(0).optional(),
    remote_ok: Joi.boolean().optional(),
    company_id: Joi.string().uuid().optional(),
    industry: Joi.string().max(100).optional(),
    posted_after: Joi.date().optional(),
    sort_by: Joi.string().valid('relevance', 'date', 'salary').default('relevance'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),

  // Company Profile
  companyProfile: Joi.object({
    name: Joi.string().max(200).required(),
    description: Joi.string().max(2000).optional(),
    website: Joi.string().uri().optional(),
    industry: Joi.string().max(100).optional(),
    company_size: Joi.string().valid(
      '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
    ).optional(),
    founded_year: Joi.number().integer().min(1800).max(new Date().getFullYear()).optional(),
    headquarters: Joi.string().max(100).optional(),
    company_type: Joi.string().valid(
      'startup', 'corporate', 'non_profit', 'government', 'agency'
    ).optional()
  }),

  // Video Interview
  videoInterview: Joi.object({
    application_id: Joi.string().uuid().required(),
    scheduled_at: Joi.date().min('now').required(),
    duration_minutes: Joi.number().integer().min(15).max(180).default(60),
    meeting_platform: Joi.string().valid('google_meet', 'zoom').required(),
    notes: Joi.string().max(1000).optional()
  }),

  // Subscription
  subscription: Joi.object({
    plan_id: Joi.string().uuid().required(),
    payment_method: Joi.string().valid('razorpay').required()
  }),

  // Notification Preferences
  notificationPreferences: Joi.object({
    email_job_alerts: Joi.boolean().default(true),
    email_applications: Joi.boolean().default(true),
    email_interviews: Joi.boolean().default(true),
    email_marketing: Joi.boolean().default(false),
    sms_interviews: Joi.boolean().default(true),
    sms_urgent: Joi.boolean().default(true)
  })
};

// Validation for pagination
const validatePagination = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort_by: Joi.string().optional(),
  sort_order: Joi.string().valid('asc', 'desc').default('desc')
});

// UUID validation
const validateUUID = Joi.string().uuid().required();

// File upload validation
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];
    
    for (const file of files) {
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: 'Invalid file type',
          allowed: allowedTypes,
          received: file.mimetype
        });
      }

      if (file.size > maxSize) {
        return res.status(400).json({
          error: 'File too large',
          maxSize: `${maxSize / (1024 * 1024)}MB`,
          received: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
        });
      }
    }

    next();
  };
};

module.exports = {
  validate,
  schemas,
  validatePagination,
  validateUUID,
  validateFileUpload
};