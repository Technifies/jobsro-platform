const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Test helper utilities for JobsRo testing
 */

class TestHelpers {
  /**
   * Generate a test JWT token
   */
  generateToken(userId = 1, role = 'job_seeker', expiresIn = '1h') {
    return jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn }
    );
  }

  /**
   * Hash a password for testing
   */
  async hashPassword(password) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 1;
    return await bcrypt.hash(password, rounds);
  }

  /**
   * Create a test user payload
   */
  createUserPayload(overrides = {}) {
    return {
      email: 'test@example.com',
      password: 'Test123!@#',
      first_name: 'Test',
      last_name: 'User',
      role: 'job_seeker',
      phone: '+91-9876543210',
      ...overrides
    };
  }

  /**
   * Create a test job payload
   */
  createJobPayload(overrides = {}) {
    return {
      title: 'Test Job Title',
      description: 'This is a comprehensive test job description that meets all the requirements for posting. It includes detailed information about the role, responsibilities, and expectations.',
      location: 'Mumbai, Maharashtra',
      employment_type: 'full_time',
      experience_min: 1,
      experience_max: 3,
      salary_min: 500000,
      salary_max: 800000,
      skills_required: ['JavaScript', 'Node.js', 'React'],
      industry: 'Technology',
      education_level: 'bachelor',
      benefits: ['Health Insurance', 'Flexible Hours'],
      remote_option: false,
      ...overrides
    };
  }

  /**
   * Create a test application payload
   */
  createApplicationPayload(jobId, overrides = {}) {
    return {
      job_id: jobId,
      cover_letter: 'I am very interested in this position and believe my skills and experience make me a great fit for your team. I have relevant experience in the required technologies.',
      ...overrides
    };
  }

  /**
   * Create a test company payload
   */
  createCompanyPayload(overrides = {}) {
    return {
      name: 'Test Company Ltd',
      description: 'Test company description for automated testing purposes.',
      industry: 'Technology',
      size: '51-200',
      location: 'Mumbai, Maharashtra',
      website: 'https://testcompany.com',
      ...overrides
    };
  }

  /**
   * Create a mock file buffer for testing
   */
  createMockFile(content = 'Test file content', filename = 'test.txt', mimetype = 'text/plain') {
    return {
      buffer: Buffer.from(content),
      originalname: filename,
      mimetype: mimetype,
      size: Buffer.byteLength(content)
    };
  }

  /**
   * Create a mock resume file
   */
  createMockResume(overrides = {}) {
    const resumeContent = `
      John Doe
      Software Engineer
      john.doe@example.com
      +91-9876543210
      
      EXPERIENCE:
      Software Engineer at TechCorp (2020-2023)
      - Developed web applications using JavaScript and React
      - Worked with Node.js and MongoDB
      - Led a team of 3 developers
      
      Frontend Developer at StartupXYZ (2018-2020)
      - Built responsive user interfaces
      - Collaborated with design team
      
      EDUCATION:
      B.Tech Computer Science, ABC University (2014-2018)
      CGPA: 8.5/10
      
      SKILLS:
      Technical: JavaScript, React, Node.js, MongoDB, Python, AWS
      Soft Skills: Leadership, Communication, Problem Solving
      
      PROJECTS:
      E-commerce Platform
      - Built using React and Node.js
      - Integrated payment gateway
      - https://github.com/johndoe/ecommerce
      
      CERTIFICATIONS:
      AWS Certified Developer
      MongoDB Certified Developer
    `;

    return this.createMockFile(
      overrides.content || resumeContent,
      overrides.filename || 'resume.txt',
      overrides.mimetype || 'text/plain'
    );
  }

  /**
   * Generate test interview data
   */
  createInterviewPayload(applicationId, overrides = {}) {
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 7); // Schedule for next week

    return {
      application_id: applicationId,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: 60,
      meeting_platform: 'google_meet',
      notes: 'Test interview scheduled via automation',
      ...overrides
    };
  }

  /**
   * Generate test payment data
   */
  createPaymentPayload(overrides = {}) {
    return {
      amount: 99900, // ₹999.00 in paisa
      currency: 'INR',
      payment_for: 'job_posting',
      description: 'Test payment for job posting',
      ...overrides
    };
  }

  /**
   * Wait for a specified time
   */
  wait(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random test data
   */
  generateRandomEmail() {
    const timestamp = Date.now();
    return `test.${timestamp}@example.com`;
  }

  generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  generateRandomNumber(min = 1, max = 1000000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Create test database seeds
   */
  async createTestSeeds(query) {
    // Create test users
    const hashedPassword = await this.hashPassword('Test123!@#');
    
    const users = [
      {
        email: 'admin@test.com',
        password: hashedPassword,
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        status: 'active',
        email_verified: true
      },
      {
        email: 'employer@test.com',
        password: hashedPassword,
        first_name: 'Employer',
        last_name: 'User',
        role: 'employer',
        status: 'active',
        email_verified: true
      },
      {
        email: 'jobseeker@test.com',
        password: hashedPassword,
        first_name: 'Job',
        last_name: 'Seeker',
        role: 'job_seeker',
        status: 'active',
        email_verified: true
      }
    ];

    const createdUsers = [];
    for (const user of users) {
      const result = await query(`
        INSERT INTO users (email, password, first_name, last_name, role, status, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, role
      `, [user.email, user.password, user.first_name, user.last_name, user.role, user.status, user.email_verified]);
      
      createdUsers.push(result.rows[0]);
    }

    return createdUsers;
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(query) {
    // Clean up in reverse order of dependencies
    await query('DELETE FROM ai_training_data WHERE 1=1');
    await query('DELETE FROM video_interviews WHERE 1=1');
    await query('DELETE FROM notifications WHERE 1=1');
    await query('DELETE FROM payments WHERE 1=1');
    await query('DELETE FROM saved_jobs WHERE 1=1');
    await query('DELETE FROM applications WHERE 1=1');
    await query('DELETE FROM jobs WHERE 1=1');
    await query('DELETE FROM companies WHERE 1=1');
    await query('DELETE FROM work_experience WHERE 1=1');
    await query('DELETE FROM education WHERE 1=1');
    await query('DELETE FROM job_seekers WHERE 1=1');
    await query('DELETE FROM employers WHERE 1=1');
    await query('DELETE FROM users WHERE email LIKE \'%@test.com\' OR email LIKE \'%@example.com\'');
  }

  /**
   * Assert database state
   */
  async assertDatabaseState(query, table, conditions = {}) {
    let whereClause = '';
    const params = [];
    
    if (Object.keys(conditions).length > 0) {
      const conditionStrings = Object.entries(conditions).map(([key, value], index) => {
        params.push(value);
        return `${key} = $${index + 1}`;
      });
      whereClause = `WHERE ${conditionStrings.join(' AND ')}`;
    }

    const result = await query(`SELECT COUNT(*) as count FROM ${table} ${whereClause}`, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Mock external service responses
   */
  mockExternalServices() {
    // Mock email service
    const mockEmailTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-email-123' })
    };

    // Mock SMS service
    const mockTwilioClient = {
      messages: {
        create: jest.fn().mockResolvedValue({ sid: 'test-sms-123' })
      }
    };

    // Mock payment gateway
    const mockRazorpayClient = {
      orders: {
        create: jest.fn().mockResolvedValue({
          id: 'order_test123',
          amount: 100000,
          currency: 'INR'
        })
      },
      payments: {
        fetch: jest.fn().mockResolvedValue({
          id: 'pay_test123',
          status: 'captured'
        })
      }
    };

    // Mock AI service
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  personal_info: { name: 'Test User', email: 'test@example.com' },
                  skills: { technical: ['JavaScript', 'React'] }
                })
              }
            }]
          })
        }
      }
    };

    return {
      email: mockEmailTransporter,
      sms: mockTwilioClient,
      payment: mockRazorpayClient,
      ai: mockOpenAI
    };
  }
}

module.exports = new TestHelpers();