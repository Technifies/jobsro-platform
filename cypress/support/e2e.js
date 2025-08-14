// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from failing the test
  return false;
});

// Custom commands for common test operations
beforeEach(() => {
  // Clear local storage and cookies before each test
  cy.clearLocalStorage();
  cy.clearCookies();
});

// Global test data
Cypress.env('testUsers', {
  admin: {
    email: 'cypress-admin@example.com',
    password: 'Test123!@#',
    role: 'admin'
  },
  employer: {
    email: 'cypress-employer@example.com',
    password: 'Test123!@#',
    role: 'employer'
  },
  jobSeeker: {
    email: 'cypress-jobseeker@example.com',
    password: 'Test123!@#',
    role: 'job_seeker'
  }
});

Cypress.env('testJob', {
  title: 'Cypress Test Job - Software Engineer',
  description: 'This is a test job posting created by Cypress for automated testing. The position requires experience in JavaScript, React, and Node.js development.',
  location: 'Mumbai, Maharashtra',
  employment_type: 'full_time',
  experience_min: 2,
  experience_max: 5,
  salary_min: 600000,
  salary_max: 1000000,
  skills_required: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
  industry: 'Technology'
});