describe('Job Management', () => {
  beforeEach(() => {
    cy.register('employer');
    cy.login('employer');
  });

  describe('Job Posting', () => {
    it('should create a new job posting successfully', () => {
      cy.navigateToDashboard();
      cy.get('[data-cy=post-job-button]').click();
      
      const job = Cypress.env('testJob');
      cy.get('[data-cy=job-title-input]').type(job.title);
      cy.get('[data-cy=job-description-textarea]').type(job.description);
      cy.get('[data-cy=job-location-input]').type(job.location);
      cy.get('[data-cy=employment-type-select]').select(job.employment_type);
      cy.get('[data-cy=experience-min-input]').type(job.experience_min.toString());
      cy.get('[data-cy=experience-max-input]').type(job.experience_max.toString());
      cy.get('[data-cy=salary-min-input]').type(job.salary_min.toString());
      cy.get('[data-cy=salary-max-input]').type(job.salary_max.toString());
      cy.get('[data-cy=industry-select]').select(job.industry);
      
      // Add skills
      job.skills_required.forEach(skill => {
        cy.get('[data-cy=skills-input]').type(`${skill}{enter}`);
      });
      
      cy.get('[data-cy=submit-job-button]').click();
      
      cy.contains('Job posted successfully').should('be.visible');
      cy.url().should('include', '/employer/jobs');
    });

    it('should show validation errors for incomplete job posting', () => {
      cy.navigateToDashboard();
      cy.get('[data-cy=post-job-button]').click();
      
      cy.get('[data-cy=submit-job-button]').click();
      
      cy.contains('Job title is required').should('be.visible');
      cy.contains('Job description is required').should('be.visible');
      cy.contains('Location is required').should('be.visible');
    });

    it('should save job as draft', () => {
      cy.navigateToDashboard();
      cy.get('[data-cy=post-job-button]').click();
      
      cy.get('[data-cy=job-title-input]').type('Draft Job Title');
      cy.get('[data-cy=job-description-textarea]').type('This is a draft job description');
      
      cy.get('[data-cy=save-draft-button]').click();
      
      cy.contains('Job saved as draft').should('be.visible');
    });

    it('should preview job before posting', () => {
      cy.navigateToDashboard();
      cy.get('[data-cy=post-job-button]').click();
      
      const job = Cypress.env('testJob');
      cy.createJob(job);
      
      cy.get('[data-cy=preview-job-button]').click();
      cy.get('[data-cy=job-preview-modal]').should('be.visible');
      cy.get('[data-cy=job-preview-title]').should('contain', job.title);
      cy.get('[data-cy=job-preview-description]').should('contain', job.description);
    });
  });

  describe('Job Management Dashboard', () => {
    beforeEach(() => {
      // Create a test job
      cy.createJob();
    });

    it('should display posted jobs in dashboard', () => {
      cy.navigateToDashboard();
      cy.get('[data-cy=employer-jobs-section]').should('be.visible');
      cy.get('[data-cy=job-card]').should('have.length.at.least', 1);
    });

    it('should show job statistics', () => {
      cy.navigateToDashboard();
      cy.get('[data-cy=jobs-stats]').should('be.visible');
      cy.get('[data-cy=total-jobs-count]').should('be.visible');
      cy.get('[data-cy=active-jobs-count]').should('be.visible');
      cy.get('[data-cy=applications-count]').should('be.visible');
    });

    it('should filter jobs by status', () => {
      cy.visit('/employer/jobs');
      cy.get('[data-cy=job-status-filter]').select('active');
      cy.get('[data-cy=apply-filter-button]').click();
      
      cy.get('[data-cy=job-card]').each(($card) => {
        cy.wrap($card).find('[data-cy=job-status]').should('contain', 'Active');
      });
    });

    it('should search jobs by title', () => {
      cy.visit('/employer/jobs');
      cy.get('[data-cy=job-search-input]').type('Software Engineer');
      cy.get('[data-cy=search-button]').click();
      
      cy.get('[data-cy=job-card]').should('have.length.at.least', 1);
    });
  });

  describe('Job Editing', () => {
    let jobId;

    beforeEach(() => {
      cy.apiLogin('employer').then(token => {
        cy.apiCreateJob(token).then(job => {
          jobId = job.id;
        });
      });
    });

    it('should edit job details successfully', () => {
      cy.visit('/employer/jobs');
      cy.get(`[data-cy=job-${jobId}-edit-button]`).click();
      
      cy.get('[data-cy=job-title-input]').clear().type('Updated Job Title');
      cy.get('[data-cy=job-description-textarea]').clear().type('Updated job description with new requirements and responsibilities.');
      cy.get('[data-cy=salary-max-input]').clear().type('1200000');
      
      cy.get('[data-cy=update-job-button]').click();
      
      cy.contains('Job updated successfully').should('be.visible');
    });

    it('should not allow editing published job critical fields', () => {
      cy.visit('/employer/jobs');
      cy.get(`[data-cy=job-${jobId}-edit-button]`).click();
      
      cy.get('[data-cy=employment-type-select]').should('be.disabled');
      cy.get('[data-cy=experience-min-input]').should('be.disabled');
    });

    it('should show confirmation before deleting job', () => {
      cy.visit('/employer/jobs');
      cy.get(`[data-cy=job-${jobId}-delete-button]`).click();
      
      cy.get('[data-cy=delete-confirmation-modal]').should('be.visible');
      cy.get('[data-cy=confirm-delete-button]').click();
      
      cy.contains('Job deleted successfully').should('be.visible');
    });
  });

  describe('Job Status Management', () => {
    let jobId;

    beforeEach(() => {
      cy.apiLogin('employer').then(token => {
        cy.apiCreateJob(token).then(job => {
          jobId = job.id;
        });
      });
    });

    it('should pause and resume job posting', () => {
      cy.visit('/employer/jobs');
      
      // Pause job
      cy.get(`[data-cy=job-${jobId}-pause-button]`).click();
      cy.contains('Job paused successfully').should('be.visible');
      cy.get(`[data-cy=job-${jobId}-status]`).should('contain', 'Paused');
      
      // Resume job
      cy.get(`[data-cy=job-${jobId}-resume-button]`).click();
      cy.contains('Job resumed successfully').should('be.visible');
      cy.get(`[data-cy=job-${jobId}-status]`).should('contain', 'Active');
    });

    it('should mark job as filled', () => {
      cy.visit('/employer/jobs');
      cy.get(`[data-cy=job-${jobId}-mark-filled-button]`).click();
      
      cy.get('[data-cy=mark-filled-modal]').should('be.visible');
      cy.get('[data-cy=confirm-mark-filled-button]').click();
      
      cy.contains('Job marked as filled').should('be.visible');
      cy.get(`[data-cy=job-${jobId}-status]`).should('contain', 'Filled');
    });

    it('should expire old jobs automatically', () => {
      // This would be tested with a job that has an expiry date in the past
      cy.visit('/employer/jobs');
      cy.get('[data-cy=expired-jobs-section]').should('be.visible');
    });
  });

  describe('Job Performance Analytics', () => {
    let jobId;

    beforeEach(() => {
      cy.apiLogin('employer').then(token => {
        cy.apiCreateJob(token).then(job => {
          jobId = job.id;
        });
      });
    });

    it('should display job analytics', () => {
      cy.visit(`/employer/jobs/${jobId}/analytics`);
      
      cy.get('[data-cy=job-views-chart]').should('be.visible');
      cy.get('[data-cy=applications-chart]').should('be.visible');
      cy.get('[data-cy=job-performance-metrics]').should('be.visible');
    });

    it('should show application funnel', () => {
      cy.visit(`/employer/jobs/${jobId}/analytics`);
      
      cy.get('[data-cy=application-funnel]').should('be.visible');
      cy.get('[data-cy=views-count]').should('be.visible');
      cy.get('[data-cy=applications-count]').should('be.visible');
      cy.get('[data-cy=interviews-count]').should('be.visible');
    });

    it('should filter analytics by date range', () => {
      cy.visit(`/employer/jobs/${jobId}/analytics`);
      
      cy.get('[data-cy=date-range-picker]').click();
      cy.get('[data-cy=last-30-days-option]').click();
      
      cy.get('[data-cy=analytics-loading]').should('not.exist');
      cy.get('[data-cy=analytics-data]').should('be.visible');
    });
  });

  describe('Bulk Job Operations', () => {
    beforeEach(() => {
      // Create multiple jobs
      cy.apiLogin('employer').then(token => {
        cy.apiCreateJob(token, { title: 'Bulk Test Job 1' });
        cy.apiCreateJob(token, { title: 'Bulk Test Job 2' });
        cy.apiCreateJob(token, { title: 'Bulk Test Job 3' });
      });
    });

    it('should select multiple jobs for bulk operations', () => {
      cy.visit('/employer/jobs');
      
      cy.get('[data-cy=select-all-jobs-checkbox]').check();
      cy.get('[data-cy=job-checkbox]').should('be.checked');
      cy.get('[data-cy=bulk-actions-toolbar]').should('be.visible');
    });

    it('should pause multiple jobs at once', () => {
      cy.visit('/employer/jobs');
      
      cy.get('[data-cy=job-checkbox]').first().check();
      cy.get('[data-cy=job-checkbox]').eq(1).check();
      cy.get('[data-cy=bulk-pause-button]').click();
      
      cy.get('[data-cy=bulk-action-confirmation]').should('be.visible');
      cy.get('[data-cy=confirm-bulk-action-button]').click();
      
      cy.contains('Jobs paused successfully').should('be.visible');
    });

    it('should delete multiple jobs at once', () => {
      cy.visit('/employer/jobs');
      
      cy.get('[data-cy=job-checkbox]').first().check();
      cy.get('[data-cy=job-checkbox]').eq(1).check();
      cy.get('[data-cy=bulk-delete-button]').click();
      
      cy.get('[data-cy=bulk-delete-confirmation]').should('be.visible');
      cy.get('[data-cy=confirm-bulk-delete-button]').click();
      
      cy.contains('Jobs deleted successfully').should('be.visible');
    });
  });
});