describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('User Registration', () => {
    it('should register a new job seeker successfully', () => {
      cy.visit('/register');
      
      cy.get('[data-cy=first-name-input]').type('John');
      cy.get('[data-cy=last-name-input]').type('Doe');
      cy.get('[data-cy=email-input]').type('john.doe@example.com');
      cy.get('[data-cy=password-input]').type('Test123!@#');
      cy.get('[data-cy=confirm-password-input]').type('Test123!@#');
      cy.get('[data-cy=role-select]').select('job_seeker');
      cy.get('[data-cy=terms-checkbox]').check();
      
      cy.get('[data-cy=register-button]').click();
      
      cy.contains('Registration successful').should('be.visible');
      cy.url().should('include', '/verify-email');
    });

    it('should register a new employer successfully', () => {
      cy.visit('/register');
      
      cy.get('[data-cy=first-name-input]').type('Jane');
      cy.get('[data-cy=last-name-input]').type('Smith');
      cy.get('[data-cy=email-input]').type('jane.smith@company.com');
      cy.get('[data-cy=password-input]').type('Test123!@#');
      cy.get('[data-cy=confirm-password-input]').type('Test123!@#');
      cy.get('[data-cy=role-select]').select('employer');
      cy.get('[data-cy=company-name-input]').type('Test Company');
      cy.get('[data-cy=terms-checkbox]').check();
      
      cy.get('[data-cy=register-button]').click();
      
      cy.contains('Registration successful').should('be.visible');
    });

    it('should show validation errors for invalid input', () => {
      cy.visit('/register');
      
      cy.get('[data-cy=email-input]').type('invalid-email');
      cy.get('[data-cy=password-input]').type('weak');
      cy.get('[data-cy=register-button]').click();
      
      cy.contains('Please enter a valid email address').should('be.visible');
      cy.contains('Password must be at least 8 characters').should('be.visible');
    });

    it('should prevent registration with mismatched passwords', () => {
      cy.visit('/register');
      
      cy.get('[data-cy=password-input]').type('Test123!@#');
      cy.get('[data-cy=confirm-password-input]').type('Different123!@#');
      cy.get('[data-cy=register-button]').click();
      
      cy.contains('Passwords do not match').should('be.visible');
    });
  });

  describe('User Login', () => {
    beforeEach(() => {
      // Register a test user first
      cy.register('jobSeeker');
    });

    it('should login with valid credentials', () => {
      const testUser = Cypress.env('testUsers').jobSeeker;
      
      cy.visit('/login');
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=login-button]').click();
      
      cy.url().should('include', '/dashboard');
      cy.contains('Welcome back').should('be.visible');
    });

    it('should show error for invalid credentials', () => {
      cy.visit('/login');
      cy.get('[data-cy=email-input]').type('wrong@example.com');
      cy.get('[data-cy=password-input]').type('wrongpassword');
      cy.get('[data-cy=login-button]').click();
      
      cy.contains('Invalid credentials').should('be.visible');
      cy.url().should('include', '/login');
    });

    it('should redirect to intended page after login', () => {
      cy.visit('/jobs/123'); // Protected route
      cy.url().should('include', '/login');
      
      const testUser = Cypress.env('testUsers').jobSeeker;
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=login-button]').click();
      
      cy.url().should('include', '/jobs/123');
    });

    it('should remember user session after page refresh', () => {
      cy.login('jobSeeker');
      cy.reload();
      cy.url().should('include', '/dashboard');
    });
  });

  describe('Password Reset', () => {
    beforeEach(() => {
      cy.register('jobSeeker');
    });

    it('should send password reset email', () => {
      cy.visit('/forgot-password');
      
      const testUser = Cypress.env('testUsers').jobSeeker;
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=reset-button]').click();
      
      cy.contains('Password reset email sent').should('be.visible');
    });

    it('should handle non-existent email gracefully', () => {
      cy.visit('/forgot-password');
      
      cy.get('[data-cy=email-input]').type('nonexistent@example.com');
      cy.get('[data-cy=reset-button]').click();
      
      cy.contains('If an account exists').should('be.visible');
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      cy.register('jobSeeker');
      cy.login('jobSeeker');
    });

    it('should logout successfully', () => {
      cy.get('[data-cy=user-menu]').click();
      cy.get('[data-cy=logout-button]').click();
      
      cy.url().should('include', '/login');
      cy.window().its('localStorage.jobsro_tokens').should('not.exist');
    });

    it('should redirect to login when accessing protected routes after logout', () => {
      cy.logout();
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });
  });

  describe('Social Authentication', () => {
    it('should show Google login option', () => {
      cy.visit('/login');
      cy.get('[data-cy=google-login-button]').should('be.visible');
    });

    it('should show LinkedIn login option', () => {
      cy.visit('/login');
      cy.get('[data-cy=linkedin-login-button]').should('be.visible');
    });
  });

  describe('Account Verification', () => {
    it('should display email verification page after registration', () => {
      cy.register('jobSeeker');
      cy.url().should('include', '/verify-email');
      cy.contains('Please check your email').should('be.visible');
    });

    it('should allow resending verification email', () => {
      cy.register('jobSeeker');
      cy.get('[data-cy=resend-verification-button]').click();
      cy.contains('Verification email sent').should('be.visible');
    });
  });
});