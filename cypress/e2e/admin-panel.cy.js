describe('Admin Panel', () => {
  beforeEach(() => {
    cy.register('admin');
    cy.login('admin');
    cy.navigateToAdmin();
  });

  describe('Admin Dashboard', () => {
    it('should display admin dashboard with key metrics', () => {
      cy.get('[data-cy=admin-dashboard]').should('be.visible');
      cy.get('[data-cy=total-users-metric]').should('be.visible');
      cy.get('[data-cy=total-jobs-metric]').should('be.visible');
      cy.get('[data-cy=total-applications-metric]').should('be.visible');
      cy.get('[data-cy=total-revenue-metric]').should('be.visible');
    });

    it('should show recent activity feed', () => {
      cy.get('[data-cy=recent-activity-section]').should('be.visible');
      cy.get('[data-cy=activity-item]').should('have.length.at.least', 1);
    });

    it('should display analytics charts', () => {
      cy.get('[data-cy=user-growth-chart]').should('be.visible');
      cy.get('[data-cy=job-statistics-chart]').should('be.visible');
      cy.get('[data-cy=revenue-chart]').should('be.visible');
    });

    it('should filter dashboard by time period', () => {
      cy.get('[data-cy=dashboard-period-filter]').select('7d');
      cy.get('[data-cy=dashboard-loading]').should('not.exist');
      cy.get('[data-cy=dashboard-metrics]').should('be.visible');
    });
  });

  describe('User Management', () => {
    beforeEach(() => {
      cy.get('[data-cy=nav-user-management]').click();
    });

    it('should display users list with filtering options', () => {
      cy.get('[data-cy=users-table]').should('be.visible');
      cy.get('[data-cy=user-role-filter]').should('be.visible');
      cy.get('[data-cy=user-status-filter]').should('be.visible');
      cy.get('[data-cy=user-search-input]').should('be.visible');
    });

    it('should filter users by role', () => {
      cy.get('[data-cy=user-role-filter]').select('job_seeker');
      cy.get('[data-cy=apply-user-filter-button]').click();
      
      cy.get('[data-cy=user-row]').each(($row) => {
        cy.wrap($row).find('[data-cy=user-role]').should('contain', 'Job Seeker');
      });
    });

    it('should filter users by status', () => {
      cy.get('[data-cy=user-status-filter]').select('active');
      cy.get('[data-cy=apply-user-filter-button]').click();
      
      cy.get('[data-cy=user-row]').each(($row) => {
        cy.wrap($row).find('[data-cy=user-status]').should('contain', 'Active');
      });
    });

    it('should search users by email/name', () => {
      cy.get('[data-cy=user-search-input]').type('test@example.com');
      cy.get('[data-cy=search-users-button]').click();
      
      cy.get('[data-cy=user-row]').should('have.length.at.least', 1);
    });

    it('should view user details', () => {
      cy.get('[data-cy=user-row]').first().find('[data-cy=view-user-button]').click();
      cy.get('[data-cy=user-details-modal]').should('be.visible');
      cy.get('[data-cy=user-profile-info]').should('be.visible');
      cy.get('[data-cy=user-activity-stats]').should('be.visible');
    });

    it('should update user status', () => {
      cy.get('[data-cy=user-row]').first().find('[data-cy=user-actions-menu]').click();
      cy.get('[data-cy=suspend-user-action]').click();
      
      cy.get('[data-cy=status-update-modal]').should('be.visible');
      cy.get('[data-cy=status-reason-input]').type('Test suspension');
      cy.get('[data-cy=confirm-status-update-button]').click();
      
      cy.contains('User status updated successfully').should('be.visible');
    });

    it('should perform bulk user operations', () => {
      cy.get('[data-cy=select-all-users-checkbox]').check();
      cy.get('[data-cy=bulk-user-actions-dropdown]').select('activate');
      cy.get('[data-cy=execute-bulk-action-button]').click();
      
      cy.get('[data-cy=bulk-action-confirmation]').should('be.visible');
      cy.get('[data-cy=confirm-bulk-action-button]').click();
      
      cy.contains('Bulk action completed successfully').should('be.visible');
    });
  });

  describe('Job Management', () => {
    beforeEach(() => {
      cy.get('[data-cy=nav-job-management]').click();
    });

    it('should display jobs list with admin controls', () => {
      cy.get('[data-cy=admin-jobs-table]').should('be.visible');
      cy.get('[data-cy=job-status-filter]').should('be.visible');
      cy.get('[data-cy=job-search-input]').should('be.visible');
    });

    it('should moderate job postings', () => {
      cy.get('[data-cy=job-row]').first().find('[data-cy=moderate-job-button]').click();
      cy.get('[data-cy=job-moderation-modal]').should('be.visible');
      cy.get('[data-cy=approve-job-button]').click();
      
      cy.contains('Job approved successfully').should('be.visible');
    });

    it('should update job status as admin', () => {
      cy.get('[data-cy=job-row]').first().find('[data-cy=job-actions-menu]').click();
      cy.get('[data-cy=deactivate-job-action]').click();
      
      cy.get('[data-cy=job-status-update-modal]').should('be.visible');
      cy.get('[data-cy=status-reason-input]').type('Admin deactivation');
      cy.get('[data-cy=confirm-job-status-update-button]').click();
      
      cy.contains('Job status updated successfully').should('be.visible');
    });

    it('should view job analytics', () => {
      cy.get('[data-cy=job-row]').first().find('[data-cy=view-job-analytics-button]').click();
      cy.get('[data-cy=job-analytics-modal]').should('be.visible');
      cy.get('[data-cy=job-performance-metrics]').should('be.visible');
    });
  });

  describe('Payment Management', () => {
    beforeEach(() => {
      cy.get('[data-cy=nav-payment-management]').click();
    });

    it('should display payments list', () => {
      cy.get('[data-cy=payments-table]').should('be.visible');
      cy.get('[data-cy=payment-status-filter]').should('be.visible');
      cy.get('[data-cy=payment-date-filter]').should('be.visible');
    });

    it('should filter payments by status', () => {
      cy.get('[data-cy=payment-status-filter]').select('completed');
      cy.get('[data-cy=apply-payment-filter-button]').click();
      
      cy.get('[data-cy=payment-row]').each(($row) => {
        cy.wrap($row).find('[data-cy=payment-status]').should('contain', 'Completed');
      });
    });

    it('should view payment details', () => {
      cy.get('[data-cy=payment-row]').first().find('[data-cy=view-payment-button]').click();
      cy.get('[data-cy=payment-details-modal]').should('be.visible');
      cy.get('[data-cy=payment-transaction-info]').should('be.visible');
    });

    it('should refund payment', () => {
      cy.get('[data-cy=payment-row]').first().find('[data-cy=refund-payment-button]').click();
      cy.get('[data-cy=refund-confirmation-modal]').should('be.visible');
      cy.get('[data-cy=refund-reason-input]').type('Test refund');
      cy.get('[data-cy=confirm-refund-button]').click();
      
      cy.contains('Refund processed successfully').should('be.visible');
    });
  });

  describe('System Settings', () => {
    beforeEach(() => {
      cy.get('[data-cy=nav-system-settings]').click();
    });

    it('should display system settings categories', () => {
      cy.get('[data-cy=settings-categories]').should('be.visible');
      cy.get('[data-cy=general-settings-tab]').should('be.visible');
      cy.get('[data-cy=job-settings-tab]').should('be.visible');
      cy.get('[data-cy=payment-settings-tab]').should('be.visible');
    });

    it('should update general settings', () => {
      cy.get('[data-cy=general-settings-tab]').click();
      cy.get('[data-cy=site-name-input]').clear().type('Updated JobsRo');
      cy.get('[data-cy=save-general-settings-button]').click();
      
      cy.contains('Settings updated successfully').should('be.visible');
    });

    it('should update job posting settings', () => {
      cy.get('[data-cy=job-settings-tab]').click();
      cy.get('[data-cy=max-job-duration-input]').clear().type('60');
      cy.get('[data-cy=save-job-settings-button]').click();
      
      cy.contains('Job settings updated successfully').should('be.visible');
    });

    it('should toggle maintenance mode', () => {
      cy.get('[data-cy=general-settings-tab]').click();
      cy.get('[data-cy=maintenance-mode-toggle]').click();
      
      cy.get('[data-cy=maintenance-mode-confirmation]').should('be.visible');
      cy.get('[data-cy=confirm-maintenance-mode-button]').click();
      
      cy.contains('Maintenance mode enabled').should('be.visible');
    });
  });

  describe('System Health Monitoring', () => {
    beforeEach(() => {
      cy.get('[data-cy=nav-system-health]').click();
    });

    it('should display system health status', () => {
      cy.get('[data-cy=system-health-dashboard]').should('be.visible');
      cy.get('[data-cy=overall-health-status]').should('be.visible');
      cy.get('[data-cy=health-checks-table]').should('be.visible');
    });

    it('should show detailed health metrics', () => {
      cy.get('[data-cy=database-health-status]').should('be.visible');
      cy.get('[data-cy=api-health-status]').should('be.visible');
      cy.get('[data-cy=email-service-status]').should('be.visible');
      cy.get('[data-cy=payment-gateway-status]').should('be.visible');
    });

    it('should refresh health status', () => {
      cy.get('[data-cy=refresh-health-button]').click();
      cy.get('[data-cy=health-loading-indicator]').should('be.visible');
      cy.get('[data-cy=health-loading-indicator]').should('not.exist');
    });

    it('should toggle auto-refresh', () => {
      cy.get('[data-cy=auto-refresh-toggle]').click();
      cy.get('[data-cy=auto-refresh-status]').should('contain', 'ON');
    });
  });

  describe('Admin Actions Log', () => {
    beforeEach(() => {
      cy.get('[data-cy=nav-admin-actions]').click();
    });

    it('should display admin actions log', () => {
      cy.get('[data-cy=admin-actions-table]').should('be.visible');
      cy.get('[data-cy=action-type-filter]').should('be.visible');
      cy.get('[data-cy=admin-user-filter]').should('be.visible');
    });

    it('should filter actions by type', () => {
      cy.get('[data-cy=action-type-filter]').select('user_status_change');
      cy.get('[data-cy=apply-action-filter-button]').click();
      
      cy.get('[data-cy=action-row]').each(($row) => {
        cy.wrap($row).find('[data-cy=action-type]').should('contain', 'user_status_change');
      });
    });

    it('should view action details', () => {
      cy.get('[data-cy=action-row]').first().find('[data-cy=view-action-details-button]').click();
      cy.get('[data-cy=action-details-modal]').should('be.visible');
      cy.get('[data-cy=action-timestamp]').should('be.visible');
      cy.get('[data-cy=action-admin-info]').should('be.visible');
    });

    it('should export actions log', () => {
      cy.get('[data-cy=export-actions-button]').click();
      cy.get('[data-cy=export-format-select]').select('csv');
      cy.get('[data-cy=confirm-export-button]').click();
      
      cy.contains('Export started').should('be.visible');
    });
  });

  describe('Content Moderation', () => {
    beforeEach(() => {
      cy.get('[data-cy=nav-content-moderation]').click();
    });

    it('should display content moderation queue', () => {
      cy.get('[data-cy=moderation-queue]').should('be.visible');
      cy.get('[data-cy=pending-moderation-items]').should('be.visible');
    });

    it('should approve content', () => {
      cy.get('[data-cy=moderation-item]').first().find('[data-cy=approve-content-button]').click();
      cy.contains('Content approved').should('be.visible');
    });

    it('should reject content with reason', () => {
      cy.get('[data-cy=moderation-item]').first().find('[data-cy=reject-content-button]').click();
      cy.get('[data-cy=rejection-reason-modal]').should('be.visible');
      cy.get('[data-cy=rejection-reason-textarea]').type('Content violates community guidelines');
      cy.get('[data-cy=confirm-rejection-button]').click();
      
      cy.contains('Content rejected').should('be.visible');
    });
  });

  describe('Analytics and Reporting', () => {
    beforeEach(() => {
      cy.get('[data-cy=nav-analytics]').click();
    });

    it('should display platform analytics', () => {
      cy.get('[data-cy=analytics-dashboard]').should('be.visible');
      cy.get('[data-cy=user-growth-analytics]').should('be.visible');
      cy.get('[data-cy=job-posting-analytics]').should('be.visible');
      cy.get('[data-cy=revenue-analytics]').should('be.visible');
    });

    it('should generate custom reports', () => {
      cy.get('[data-cy=generate-report-button]').click();
      cy.get('[data-cy=report-type-select]').select('user_activity');
      cy.get('[data-cy=report-date-range-picker]').click();
      cy.get('[data-cy=last-30-days-option]').click();
      cy.get('[data-cy=generate-report-confirm-button]').click();
      
      cy.contains('Report generation started').should('be.visible');
    });

    it('should download reports', () => {
      cy.get('[data-cy=reports-list]').should('be.visible');
      cy.get('[data-cy=report-item]').first().find('[data-cy=download-report-button]').click();
      
      // Verify download initiation
      cy.get('[data-cy=download-notification]').should('be.visible');
    });
  });
});