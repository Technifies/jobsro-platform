// Test setup file - runs before all tests
require('dotenv').config({ path: '.env.test' });

// Mock external services for testing
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'test-sms-sid' })
    }
  }))
}));

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_test123',
        amount: 100000,
        currency: 'INR',
        status: 'created'
      })
    },
    payments: {
      fetch: jest.fn().mockResolvedValue({
        id: 'pay_test123',
        order_id: 'order_test123',
        status: 'captured',
        amount: 100000
      })
    }
  }));
});

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                personal_info: { name: 'Test User', email: 'test@example.com' },
                skills: { technical: ['JavaScript', 'Node.js'] },
                experience: []
              })
            }
          }]
        })
      }
    }
  }))
}));

// Global test helpers
global.testHelpers = {
  // Create test user payload
  createUserPayload: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'Test123!@#',
    first_name: 'Test',
    last_name: 'User',
    role: 'job_seeker',
    ...overrides
  }),

  // Create test job payload
  createJobPayload: (overrides = {}) => ({
    title: 'Test Job Title',
    description: 'Test job description with required content for posting',
    location: 'Mumbai, Maharashtra',
    employment_type: 'full_time',
    experience_min: 1,
    experience_max: 3,
    salary_min: 500000,
    salary_max: 800000,
    skills_required: ['JavaScript', 'Node.js'],
    industry: 'Technology',
    ...overrides
  }),

  // Generate JWT token for testing
  generateTestToken: (userId = 1, role = 'job_seeker') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  },

  // Wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'postgresql://test_user:test_pass@localhost:5432/jobsro_test';
process.env.BCRYPT_ROUNDS = '1'; // Faster hashing for tests
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';

// Console log suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Database cleanup helpers
global.setupTestDatabase = async () => {
  // This would set up a clean test database
  // For now, we'll use mocked database operations
};

global.cleanupTestDatabase = async () => {
  // This would clean up the test database
  // For now, we'll reset mocks
  jest.clearAllMocks();
};