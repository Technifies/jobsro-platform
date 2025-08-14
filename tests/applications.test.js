const request = require('supertest');
const app = require('../server/index');

describe('Job Applications API', () => {
  let server;
  let jobSeekerToken;
  let employerToken;
  let adminToken;
  let testJobId;
  let testApplicationId;

  beforeAll(async () => {
    await global.setupTestDatabase();

    // Create test users
    const jobSeekerData = global.testHelpers.createUserPayload({
      email: 'applicant@example.com',
      role: 'job_seeker'
    });

    const employerData = global.testHelpers.createUserPayload({
      email: 'hiring@example.com',
      role: 'employer'
    });

    const adminData = global.testHelpers.createUserPayload({
      email: 'admin@example.com',
      role: 'admin'
    });

    // Register users
    await request(app).post('/api/auth/register').send(jobSeekerData);
    await request(app).post('/api/auth/register').send(employerData);
    await request(app).post('/api/auth/register').send(adminData);

    // Login and get tokens
    const jobSeekerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: jobSeekerData.email, password: jobSeekerData.password });
    jobSeekerToken = jobSeekerLogin.body.tokens.accessToken;

    const employerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: employerData.email, password: employerData.password });
    employerToken = employerLogin.body.tokens.accessToken;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminData.email, password: adminData.password });
    adminToken = adminLogin.body.tokens.accessToken;

    // Create a test job
    const jobData = global.testHelpers.createJobPayload();
    const jobResponse = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send(jobData);
    testJobId = jobResponse.body.job.id;
  });

  afterAll(async () => {
    await global.cleanupTestDatabase();
    if (server) {
      server.close();
    }
  });

  describe('POST /api/applications', () => {
    it('should submit application with valid data', async () => {
      const applicationData = {
        job_id: testJobId,
        cover_letter: 'I am very interested in this position. I have relevant experience in JavaScript and Node.js development, and I believe I would be a great fit for your team.'
      };

      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Application submitted successfully');
      expect(response.body).toHaveProperty('application');
      expect(response.body.application).toHaveProperty('id');
      expect(response.body.application).toHaveProperty('status', 'pending');
      expect(response.body.application).toHaveProperty('cover_letter', applicationData.cover_letter);

      testApplicationId = response.body.application.id;
    });

    it('should reject application from employers', async () => {
      const applicationData = {
        job_id: testJobId,
        cover_letter: 'Employer trying to apply'
      };

      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(applicationData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should reject application without job_id', async () => {
      const applicationData = {
        cover_letter: 'Great cover letter'
      };

      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('job_id');
    });

    it('should reject application without cover letter', async () => {
      const applicationData = {
        job_id: testJobId
      };

      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('cover_letter');
    });

    it('should reject duplicate application', async () => {
      const applicationData = {
        job_id: testJobId,
        cover_letter: 'Duplicate application attempt'
      };

      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already applied');
    });

    it('should reject application to non-existent job', async () => {
      const applicationData = {
        job_id: 99999,
        cover_letter: 'Application to non-existent job'
      };

      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Job not found');
    });
  });

  describe('GET /api/applications', () => {
    it('should get applications for job seeker', async () => {
      const response = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('applications');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.applications)).toBe(true);
      expect(response.body.applications.some(app => app.id === testApplicationId)).toBe(true);
    });

    it('should filter applications by status', async () => {
      const response = await request(app)
        .get('/api/applications?status=pending')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body.applications.every(app => app.status === 'pending')).toBe(true);
    });

    it('should paginate applications correctly', async () => {
      const response = await request(app)
        .get('/api/applications?page=1&limit=5')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 5);
      expect(response.body.applications.length).toBeLessThanOrEqual(5);
    });

    it('should get applications received by employer', async () => {
      const response = await request(app)
        .get('/api/applications?received=true')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('applications');
      expect(response.body.applications.some(app => 
        app.job_id === testJobId
      )).toBe(true);
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/applications')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/applications/:id', () => {
    it('should get application details for applicant', async () => {
      const response = await request(app)
        .get(`/api/applications/${testApplicationId}`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('application');
      expect(response.body.application).toHaveProperty('id', testApplicationId);
      expect(response.body.application).toHaveProperty('job_title');
      expect(response.body.application).toHaveProperty('company_name');
    });

    it('should get application details for job owner', async () => {
      const response = await request(app)
        .get(`/api/applications/${testApplicationId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('application');
      expect(response.body.application).toHaveProperty('candidate_name');
      expect(response.body.application).toHaveProperty('candidate_email');
    });

    it('should allow admin to view any application', async () => {
      const response = await request(app)
        .get(`/api/applications/${testApplicationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('application');
    });

    it('should reject access from unauthorized user', async () => {
      // Create another job seeker
      const otherJobSeekerData = global.testHelpers.createUserPayload({
        email: 'other-jobseeker@example.com',
        role: 'job_seeker'
      });

      await request(app).post('/api/auth/register').send(otherJobSeekerData);

      const otherLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: otherJobSeekerData.email, password: otherJobSeekerData.password });

      const response = await request(app)
        .get(`/api/applications/${testApplicationId}`)
        .set('Authorization', `Bearer ${otherLogin.body.tokens.accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should return 404 for non-existent application', async () => {
      const response = await request(app)
        .get('/api/applications/99999')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('PATCH /api/applications/:id/status', () => {
    it('should update application status by job owner', async () => {
      const statusUpdate = {
        status: 'reviewed',
        notes: 'Good candidate, moving to next round'
      };

      const response = await request(app)
        .patch(`/api/applications/${testApplicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Application status updated successfully');
      expect(response.body).toHaveProperty('application');
      expect(response.body.application).toHaveProperty('status', 'reviewed');
      expect(response.body.application).toHaveProperty('employer_notes', statusUpdate.notes);
    });

    it('should reject status update by applicant', async () => {
      const statusUpdate = {
        status: 'hired'
      };

      const response = await request(app)
        .patch(`/api/applications/${testApplicationId}/status`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(statusUpdate)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should allow admin to update any application status', async () => {
      const statusUpdate = {
        status: 'shortlisted',
        notes: 'Admin updated status'
      };

      const response = await request(app)
        .patch(`/api/applications/${testApplicationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body.application).toHaveProperty('status', 'shortlisted');
    });

    it('should reject invalid status values', async () => {
      const statusUpdate = {
        status: 'invalid_status'
      };

      const response = await request(app)
        .patch(`/api/applications/${testApplicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send(statusUpdate)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid status');
    });

    it('should reject status update without status field', async () => {
      const response = await request(app)
        .patch(`/api/applications/${testApplicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('status');
    });
  });

  describe('DELETE /api/applications/:id', () => {
    let applicationToDeleteId;

    beforeEach(async () => {
      // Create another job for testing deletion
      const jobData = global.testHelpers.createJobPayload({
        title: 'Job for Application Deletion Test'
      });
      const jobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(jobData);

      // Apply to the job
      const applicationData = {
        job_id: jobResponse.body.job.id,
        cover_letter: 'Application to be deleted'
      };
      const appResponse = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData);
      
      applicationToDeleteId = appResponse.body.application.id;
    });

    it('should allow applicant to withdraw application', async () => {
      const response = await request(app)
        .delete(`/api/applications/${applicationToDeleteId}`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Application withdrawn successfully');

      // Verify application is deleted
      const getResponse = await request(app)
        .get(`/api/applications/${applicationToDeleteId}`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(404);
    });

    it('should allow admin to delete any application', async () => {
      const response = await request(app)
        .delete(`/api/applications/${applicationToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Application withdrawn successfully');
    });

    it('should reject deletion by employer', async () => {
      const response = await request(app)
        .delete(`/api/applications/${applicationToDeleteId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should reject deletion by unauthorized user', async () => {
      // Create another job seeker
      const otherJobSeekerData = global.testHelpers.createUserPayload({
        email: 'other-applicant@example.com',
        role: 'job_seeker'
      });

      await request(app).post('/api/auth/register').send(otherJobSeekerData);

      const otherLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: otherJobSeekerData.email, password: otherJobSeekerData.password });

      const response = await request(app)
        .delete(`/api/applications/${applicationToDeleteId}`)
        .set('Authorization', `Bearer ${otherLogin.body.tokens.accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/applications/bulk-update', () => {
    let bulkApplicationIds = [];

    beforeEach(async () => {
      // Create multiple applications for bulk testing
      const jobData1 = global.testHelpers.createJobPayload({ title: 'Bulk Test Job 1' });
      const jobData2 = global.testHelpers.createJobPayload({ title: 'Bulk Test Job 2' });
      
      const job1Response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(jobData1);
      
      const job2Response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(jobData2);

      // Create another job seeker for applications
      const bulkJobSeekerData = global.testHelpers.createUserPayload({
        email: 'bulk-applicant@example.com',
        role: 'job_seeker'
      });

      await request(app).post('/api/auth/register').send(bulkJobSeekerData);

      const bulkLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: bulkJobSeekerData.email, password: bulkJobSeekerData.password });

      // Apply to jobs
      const app1Response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${bulkLogin.body.tokens.accessToken}`)
        .send({
          job_id: job1Response.body.job.id,
          cover_letter: 'Bulk application 1'
        });

      const app2Response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${bulkLogin.body.tokens.accessToken}`)
        .send({
          job_id: job2Response.body.job.id,
          cover_letter: 'Bulk application 2'
        });

      bulkApplicationIds = [app1Response.body.application.id, app2Response.body.application.id];
    });

    it('should bulk update application statuses by employer', async () => {
      const bulkUpdate = {
        application_ids: bulkApplicationIds,
        status: 'reviewed',
        notes: 'Bulk reviewed applications'
      };

      const response = await request(app)
        .post('/api/applications/bulk-update')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(bulkUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Applications updated successfully');
      expect(response.body).toHaveProperty('updated_count', 2);
    });

    it('should reject bulk update by job seekers', async () => {
      const bulkUpdate = {
        application_ids: bulkApplicationIds,
        status: 'withdrawn'
      };

      const response = await request(app)
        .post('/api/applications/bulk-update')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(bulkUpdate)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject bulk update with invalid application IDs', async () => {
      const bulkUpdate = {
        application_ids: [99999, 99998],
        status: 'reviewed'
      };

      const response = await request(app)
        .post('/api/applications/bulk-update')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(bulkUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('updated_count', 0);
    });

    it('should reject bulk update without application IDs', async () => {
      const bulkUpdate = {
        status: 'reviewed'
      };

      const response = await request(app)
        .post('/api/applications/bulk-update')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(bulkUpdate)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('application_ids');
    });
  });

  describe('GET /api/applications/stats', () => {
    it('should get application statistics for job seeker', async () => {
      const response = await request(app)
        .get('/api/applications/stats')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_applications');
      expect(response.body).toHaveProperty('by_status');
      expect(response.body).toHaveProperty('recent_activity');
      expect(Array.isArray(response.body.by_status)).toBe(true);
    });

    it('should get application statistics for employer', async () => {
      const response = await request(app)
        .get('/api/applications/stats')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_applications');
      expect(response.body).toHaveProperty('by_status');
      expect(response.body.total_applications).toBeGreaterThan(0);
    });

    it('should filter statistics by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/applications/stats?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_applications');
    });

    it('should reject unauthorized access to stats', async () => {
      const response = await request(app)
        .get('/api/applications/stats')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});