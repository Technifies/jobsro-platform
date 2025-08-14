const request = require('supertest');
const app = require('../server/index');

describe('Jobs API', () => {
  let server;
  let employerToken;
  let jobSeekerToken;
  let adminToken;
  let testJobId;

  beforeAll(async () => {
    await global.setupTestDatabase();

    // Create test users and get tokens
    const employerData = global.testHelpers.createUserPayload({
      email: 'employer@example.com',
      role: 'employer'
    });

    const jobSeekerData = global.testHelpers.createUserPayload({
      email: 'jobseeker@example.com',
      role: 'job_seeker'
    });

    const adminData = global.testHelpers.createUserPayload({
      email: 'admin@example.com',
      role: 'admin'
    });

    // Register users
    await request(app).post('/api/auth/register').send(employerData);
    await request(app).post('/api/auth/register').send(jobSeekerData);
    await request(app).post('/api/auth/register').send(adminData);

    // Login and get tokens
    const employerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: employerData.email, password: employerData.password });
    employerToken = employerLogin.body.tokens.accessToken;

    const jobSeekerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: jobSeekerData.email, password: jobSeekerData.password });
    jobSeekerToken = jobSeekerLogin.body.tokens.accessToken;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminData.email, password: adminData.password });
    adminToken = adminLogin.body.tokens.accessToken;
  });

  afterAll(async () => {
    await global.cleanupTestDatabase();
    if (server) {
      server.close();
    }
  });

  describe('POST /api/jobs', () => {
    it('should create a job with valid employer token', async () => {
      const jobData = global.testHelpers.createJobPayload();

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Job created successfully');
      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('id');
      expect(response.body.job).toHaveProperty('title', jobData.title);
      expect(response.body.job).toHaveProperty('status', 'active');

      testJobId = response.body.job.id;
    });

    it('should reject job creation from job seeker', async () => {
      const jobData = global.testHelpers.createJobPayload();

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(jobData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should reject job creation without authentication', async () => {
      const jobData = global.testHelpers.createJobPayload();

      const response = await request(app)
        .post('/api/jobs')
        .send(jobData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject job creation with invalid data', async () => {
      const invalidJobData = {
        title: '', // Invalid: empty title
        description: 'Short', // Invalid: too short
        location: '',
        employment_type: 'invalid_type',
        salary_min: -1000 // Invalid: negative salary
      };

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(invalidJobData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should create job with minimum required fields', async () => {
      const minimalJobData = {
        title: 'Minimal Job Title',
        description: 'This is a minimal job description that meets the minimum requirements for posting.',
        location: 'Remote',
        employment_type: 'full_time'
      };

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(minimalJobData)
        .expect(201);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('title', minimalJobData.title);
    });
  });

  describe('GET /api/jobs', () => {
    beforeEach(async () => {
      // Create a test job if needed
      if (!testJobId) {
        const jobData = global.testHelpers.createJobPayload();
        const response = await request(app)
          .post('/api/jobs')
          .set('Authorization', `Bearer ${employerToken}`)
          .send(jobData);
        testJobId = response.body.job.id;
      }
    });

    it('should get jobs without authentication', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });

    it('should filter jobs by location', async () => {
      const response = await request(app)
        .get('/api/jobs?location=Mumbai')
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(response.body.jobs.every(job => 
        job.location.toLowerCase().includes('mumbai')
      )).toBe(true);
    });

    it('should filter jobs by employment type', async () => {
      const response = await request(app)
        .get('/api/jobs?employment_type=full_time')
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(response.body.jobs.every(job => 
        job.employment_type === 'full_time'
      )).toBe(true);
    });

    it('should filter jobs by salary range', async () => {
      const response = await request(app)
        .get('/api/jobs?salary_min=500000&salary_max=1000000')
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(response.body.jobs.every(job => 
        job.salary_min >= 500000 && job.salary_max <= 1000000
      )).toBe(true);
    });

    it('should search jobs by keyword', async () => {
      const response = await request(app)
        .get('/api/jobs?search=JavaScript')
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      // Jobs should contain the search keyword in title, description, or skills
    });

    it('should paginate jobs correctly', async () => {
      const response = await request(app)
        .get('/api/jobs?page=1&limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 5);
      expect(response.body.jobs.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should get job details by ID', async () => {
      const response = await request(app)
        .get(`/api/jobs/${testJobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('id', testJobId);
      expect(response.body.job).toHaveProperty('title');
      expect(response.body.job).toHaveProperty('description');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/jobs/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should return 400 for invalid job ID format', async () => {
      const response = await request(app)
        .get('/api/jobs/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/jobs/:id', () => {
    it('should update job by owner', async () => {
      const updateData = {
        title: 'Updated Job Title',
        description: 'Updated job description with more detailed information about the role.',
        salary_max: 900000
      };

      const response = await request(app)
        .put(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Job updated successfully');
      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('title', updateData.title);
      expect(response.body.job).toHaveProperty('salary_max', updateData.salary_max);
    });

    it('should reject update by non-owner', async () => {
      const updateData = {
        title: 'Unauthorized Update'
      };

      const response = await request(app)
        .put(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should allow admin to update any job', async () => {
      const updateData = {
        title: 'Admin Updated Title'
      };

      const response = await request(app)
        .put(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('title', updateData.title);
    });

    it('should reject update with invalid data', async () => {
      const invalidUpdateData = {
        salary_min: -1000,
        employment_type: 'invalid_type'
      };

      const response = await request(app)
        .put(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    let jobToDeleteId;

    beforeEach(async () => {
      // Create a job to delete
      const jobData = global.testHelpers.createJobPayload({
        title: 'Job to Delete'
      });
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(jobData);
      jobToDeleteId = response.body.job.id;
    });

    it('should delete job by owner', async () => {
      const response = await request(app)
        .delete(`/api/jobs/${jobToDeleteId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Job deleted successfully');

      // Verify job is deleted
      const getResponse = await request(app)
        .get(`/api/jobs/${jobToDeleteId}`)
        .expect(404);
    });

    it('should reject delete by non-owner', async () => {
      const response = await request(app)
        .delete(`/api/jobs/${jobToDeleteId}`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should allow admin to delete any job', async () => {
      const response = await request(app)
        .delete(`/api/jobs/${jobToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Job deleted successfully');
    });
  });

  describe('POST /api/jobs/:id/apply', () => {
    it('should allow job seeker to apply to job', async () => {
      const applicationData = {
        cover_letter: 'This is my cover letter explaining why I am a great fit for this position.'
      };

      const response = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Application submitted successfully');
      expect(response.body).toHaveProperty('application');
      expect(response.body.application).toHaveProperty('cover_letter', applicationData.cover_letter);
    });

    it('should reject employer applying to job', async () => {
      const applicationData = {
        cover_letter: 'Employer trying to apply'
      };

      const response = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send(applicationData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should reject duplicate application', async () => {
      const applicationData = {
        cover_letter: 'Duplicate application attempt'
      };

      // First application
      await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData)
        .expect(201);

      // Duplicate application
      const response = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(applicationData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already applied');
    });

    it('should reject application without cover letter', async () => {
      const response = await request(app)
        .post(`/api/jobs/${testJobId}/apply`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('cover_letter');
    });
  });

  describe('POST /api/jobs/:id/save', () => {
    it('should allow job seeker to save job', async () => {
      const response = await request(app)
        .post(`/api/jobs/${testJobId}/save`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Job saved successfully');
    });

    it('should reject employer saving job', async () => {
      const response = await request(app)
        .post(`/api/jobs/${testJobId}/save`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/jobs/:id/save', () => {
    beforeEach(async () => {
      // Save the job first
      await request(app)
        .post(`/api/jobs/${testJobId}/save`)
        .set('Authorization', `Bearer ${jobSeekerToken}`);
    });

    it('should allow job seeker to unsave job', async () => {
      const response = await request(app)
        .delete(`/api/jobs/${testJobId}/save`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Job unsaved successfully');
    });
  });

  describe('GET /api/jobs/saved', () => {
    beforeEach(async () => {
      // Save a job
      await request(app)
        .post(`/api/jobs/${testJobId}/save`)
        .set('Authorization', `Bearer ${jobSeekerToken}`);
    });

    it('should get saved jobs for job seeker', async () => {
      const response = await request(app)
        .get('/api/jobs/saved')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(Array.isArray(response.body.jobs)).toBe(true);
      expect(response.body.jobs.some(job => job.id === testJobId)).toBe(true);
    });

    it('should reject employer accessing saved jobs', async () => {
      const response = await request(app)
        .get('/api/jobs/saved')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });
});