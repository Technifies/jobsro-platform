// Custom commands for JobsRo testing

// Authentication commands
Cypress.Commands.add('login', (userType = 'jobSeeker') => {
  const users = Cypress.env('testUsers');
  const user = users[userType];
  
  cy.visit('/login');
  cy.get('[data-cy=email-input]').type(user.email);
  cy.get('[data-cy=password-input]').type(user.password);
  cy.get('[data-cy=login-button]').click();
  
  // Wait for successful login redirect
  cy.url().should('not.include', '/login');
  cy.window().its('localStorage').should('have.property', 'jobsro_tokens');
});

Cypress.Commands.add('logout', () => {
  cy.get('[data-cy=user-menu]').click();
  cy.get('[data-cy=logout-button]').click();
  cy.url().should('include', '/login');
});

Cypress.Commands.add('register', (userType = 'jobSeeker') => {
  const users = Cypress.env('testUsers');
  const user = users[userType];
  
  cy.visit('/register');
  cy.get('[data-cy=first-name-input]').type('Cypress');
  cy.get('[data-cy=last-name-input]').type('Test');
  cy.get('[data-cy=email-input]').type(user.email);
  cy.get('[data-cy=password-input]').type(user.password);
  cy.get('[data-cy=confirm-password-input]').type(user.password);
  cy.get('[data-cy=role-select]').select(user.role);
  cy.get('[data-cy=register-button]').click();
  
  // Check for successful registration
  cy.contains('Registration successful').should('be.visible');
});

// Job management commands
Cypress.Commands.add('createJob', (jobData) => {
  const job = jobData || Cypress.env('testJob');
  
  cy.get('[data-cy=post-job-button]').click();
  cy.get('[data-cy=job-title-input]').type(job.title);
  cy.get('[data-cy=job-description-textarea]').type(job.description);
  cy.get('[data-cy=job-location-input]').type(job.location);
  cy.get('[data-cy=employment-type-select]').select(job.employment_type);
  cy.get('[data-cy=experience-min-input]').type(job.experience_min.toString());
  cy.get('[data-cy=experience-max-input]').type(job.experience_max.toString());
  cy.get('[data-cy=salary-min-input]').type(job.salary_min.toString());
  cy.get('[data-cy=salary-max-input]').type(job.salary_max.toString());
  
  // Add skills
  job.skills_required.forEach(skill => {
    cy.get('[data-cy=skills-input]').type(`${skill}{enter}`);
  });
  
  cy.get('[data-cy=industry-select]').select(job.industry);
  cy.get('[data-cy=submit-job-button]').click();
  
  // Verify job creation
  cy.contains('Job posted successfully').should('be.visible');
});

Cypress.Commands.add('applyToJob', (coverLetter) => {
  const defaultCoverLetter = 'I am very interested in this position and believe my skills and experience make me a great fit for your team.';
  
  cy.get('[data-cy=apply-button]').click();
  cy.get('[data-cy=cover-letter-textarea]').type(coverLetter || defaultCoverLetter);
  cy.get('[data-cy=submit-application-button]').click();
  
  // Verify application submission
  cy.contains('Application submitted successfully').should('be.visible');
});

// Navigation commands
Cypress.Commands.add('navigateToJobs', () => {
  cy.get('[data-cy=nav-jobs]').click();
  cy.url().should('include', '/jobs');
});

Cypress.Commands.add('navigateToDashboard', () => {
  cy.get('[data-cy=nav-dashboard]').click();
  cy.url().should('include', '/dashboard');
});

Cypress.Commands.add('navigateToAdmin', () => {
  cy.get('[data-cy=nav-admin]').click();
  cy.url().should('include', '/admin');
});

// Search and filter commands
Cypress.Commands.add('searchJobs', (searchTerm) => {
  cy.get('[data-cy=job-search-input]').clear().type(searchTerm);
  cy.get('[data-cy=search-button]').click();
  cy.get('[data-cy=job-list]').should('exist');
});

Cypress.Commands.add('filterJobs', (filters) => {
  if (filters.location) {
    cy.get('[data-cy=location-filter]').select(filters.location);
  }
  if (filters.employmentType) {
    cy.get('[data-cy=employment-type-filter]').select(filters.employmentType);
  }
  if (filters.salaryRange) {
    cy.get('[data-cy=salary-min-filter]').type(filters.salaryRange.min.toString());
    cy.get('[data-cy=salary-max-filter]').type(filters.salaryRange.max.toString());
  }
  cy.get('[data-cy=apply-filters-button]').click();
});

// Admin commands
Cypress.Commands.add('adminUpdateUserStatus', (userId, status) => {
  cy.get(`[data-cy=user-${userId}-menu]`).click();
  cy.get(`[data-cy=update-status-${status}]`).click();
  cy.get('[data-cy=confirm-status-update]').click();
  cy.contains('Status updated successfully').should('be.visible');
});

Cypress.Commands.add('adminUpdateJobStatus', (jobId, status) => {
  cy.get(`[data-cy=job-${jobId}-menu]`).click();
  cy.get(`[data-cy=update-status-${status}]`).click();
  cy.get('[data-cy=confirm-status-update]').click();
  cy.contains('Status updated successfully').should('be.visible');
});

// Utility commands
Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('[data-cy=loading-spinner]').should('not.exist');
});

Cypress.Commands.add('checkAccessibility', () => {
  // Basic accessibility checks
  cy.get('img').should('have.attr', 'alt');
  cy.get('input').should('have.attr', 'aria-label').or('have.attr', 'aria-labelledby');
  cy.get('button').should('not.be.empty');
});

Cypress.Commands.add('checkResponsiveness', () => {
  // Test different viewport sizes
  const viewports = [
    { width: 320, height: 568 }, // iPhone SE
    { width: 768, height: 1024 }, // iPad
    { width: 1920, height: 1080 } // Desktop
  ];
  
  viewports.forEach(viewport => {
    cy.viewport(viewport.width, viewport.height);
    cy.get('[data-cy=header]').should('be.visible');
    cy.get('[data-cy=main-content]').should('be.visible');
  });
});

// API testing commands
Cypress.Commands.add('apiLogin', (userType = 'jobSeeker') => {
  const users = Cypress.env('testUsers');
  const user = users[userType];
  
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login`,
    body: {
      email: user.email,
      password: user.password
    }
  }).then((response) => {
    expect(response.status).to.eq(200);
    return response.body.tokens.accessToken;
  });
});

Cypress.Commands.add('apiCreateJob', (token, jobData) => {
  const job = jobData || Cypress.env('testJob');
  
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/jobs`,
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: job
  }).then((response) => {
    expect(response.status).to.eq(201);
    return response.body.job;
  });
});

Cypress.Commands.add('apiApplyToJob', (token, jobId, coverLetter) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/jobs/${jobId}/apply`,
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: {
      cover_letter: coverLetter || 'Test application via API'
    }
  }).then((response) => {
    expect(response.status).to.eq(201);
    return response.body.application;
  });
});

// Cleanup commands
Cypress.Commands.add('cleanupTestData', () => {
  // This would clean up any test data created during the test
  // For now, we'll just clear browser state
  cy.clearLocalStorage();
  cy.clearCookies();
  cy.reload();
});