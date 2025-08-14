const request = require('supertest');
const app = require('../server/index');

describe('Admin API', () => {
  let server;
  let adminToken;
  let userToken;
  let testUserId;
  let testJobId;

  beforeAll(async () => {
    await global.setupTestDatabase();

    // Create admin user
    const adminData = global.testHelpers.createUserPayload({
      email: 'admin@example.com',
      role: 'admin'
    });

    // Create regular user
    const userData = global.testHelpers.createUserPayload({
      email: 'user@example.com',
      role: 'job_seeker'
    });

    // Register users
    await request(app).post('/api/auth/register').send(adminData);
    const userResponse = await request(app).post('/api/auth/register').send(userData);
    testUserId = userResponse.body.user.id;

    // Login and get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminData.email, password: adminData.password });
    adminToken = adminLogin.body.tokens.accessToken;

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: userData.email, password: userData.password });
    userToken = userLogin.body.tokens.accessToken;

    // Create a test job
    const employerData = global.testHelpers.createUserPayload({
      email: 'employer@example.com',
      role: 'employer'
    });
    await request(app).post('/api/auth/register').send(employerData);
    
    const employerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: employerData.email, password: employerData.password });
    
    const jobData = global.testHelpers.createJobPayload();
    const jobResponse = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerLogin.body.tokens.accessToken}`)
      .send(jobData);
    testJobId = jobResponse.body.job.id;
  });

  afterAll(async () => {
    await global.cleanupTestDatabase();
    if (server) {
      server.close();
    }
  });

  describe('GET /api/admin/dashboard', () => {
    it('should get dashboard data with admin token', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('applications');
      expect(response.body).toHaveProperty('payments');
      expect(response.body).toHaveProperty('interviews');
      expect(response.body).toHaveProperty('recent_activity');

      // Check user stats structure
      expect(response.body.users).toHaveProperty('total_users');
      expect(response.body.users).toHaveProperty('active_users');
      expect(response.body.users).toHaveProperty('job_seekers');
      expect(response.body.users).toHaveProperty('employers');
    });

    it('should get dashboard data with period filter', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard?period=7d')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period', '7d');
      expect(response.body).toHaveProperty('users');
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should reject unauthenticated access', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/users', () => {
    it('should get users list with admin token', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=job_seeker')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users.every(user => user.role === 'job_seeker')).toBe(true);
    });

    it('should filter users by status', async () => {
      const response = await request(app)
        .get('/api/admin/users?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users.every(user => user.status === 'active')).toBe(true);
    });

    it('should search users by email/name', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=user@example.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users.some(user => 
        user.email.includes('user@example.com')
      )).toBe(true);
    });

    it('should paginate users correctly', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 2);
      expect(response.body.users.length).toBeLessThanOrEqual(2);
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/users/:id', () => {
    it('should get user details with admin token', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', testUserId);
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('activity_stats');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/admin/users/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/admin/users/:id/status', () => {
    it('should update user status with admin token', async () => {
      const statusData = {
        status: 'suspended',
        reason: 'Test suspension'
      };

      const response = await request(app)
        .patch(`/api/admin/users/${testUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'User status updated successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('status', 'suspended');
    });

    it('should reject invalid status values', async () => {
      const statusData = {
        status: 'invalid_status'
      };

      const response = await request(app)
        .patch(`/api/admin/users/${testUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid status');
    });

    it('should reject non-admin access', async () => {
      const statusData = {
        status: 'active'
      };

      const response = await request(app)
        .patch(`/api/admin/users/${testUserId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(statusData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/jobs', () => {
    it('should get jobs list with admin token', async () => {
      const response = await request(app)
        .get('/api/admin/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });

    it('should filter jobs by status', async () => {
      const response = await request(app)
        .get('/api/admin/jobs?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.jobs.every(job => job.status === 'active')).toBe(true);
    });

    it('should search jobs by title/description', async () => {
      const response = await request(app)
        .get('/api/admin/jobs?search=Test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/admin/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/admin/jobs/:id/status', () => {
    it('should update job status with admin token', async () => {
      const statusData = {
        status: 'inactive',
        reason: 'Admin deactivation'
      };

      const response = await request(app)
        .patch(`/api/admin/jobs/${testJobId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Job status updated successfully');
      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('status', 'inactive');
    });

    it('should reject invalid job status', async () => {
      const statusData = {
        status: 'invalid_status'
      };

      const response = await request(app)
        .patch(`/api/admin/jobs/${testJobId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-admin access', async () => {
      const statusData = {
        status: 'active'
      };

      const response = await request(app)
        .patch(`/api/admin/jobs/${testJobId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(statusData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/payments', () => {
    it('should get payments list with admin token', async () => {
      const response = await request(app)
        .get('/api/admin/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('payments');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.payments)).toBe(true);
    });

    it('should filter payments by status', async () => {
      const response = await request(app)
        .get('/api/admin/payments?status=completed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('payments');
    });

    it('should filter payments by user', async () => {
      const response = await request(app)
        .get(`/api/admin/payments?user_id=${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('payments');
    });

    it('should filter payments by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/admin/payments?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('payments');
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/admin/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/settings', () => {
    it('should get system settings with admin token', async () => {
      const response = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('settings');
      expect(typeof response.body.settings).toBe('object');
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/admin/settings/:category/:key', () => {
    it('should update system setting with admin token', async () => {
      const newValue = 'Updated Test Value';

      const response = await request(app)
        .put('/api/admin/settings/general/site_name')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: newValue })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Setting updated successfully');
      expect(response.body).toHaveProperty('setting');
    });

    it('should reject invalid setting updates', async () => {
      const response = await request(app)
        .put('/api/admin/settings/invalid/invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'test' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .put('/api/admin/settings/general/site_name')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ value: 'test' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/actions', () => {
    it('should get admin actions log with admin token', async () => {
      const response = await request(app)
        .get('/api/admin/actions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('actions');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.actions)).toBe(true);
    });

    it('should filter actions by admin user', async () => {
      const response = await request(app)
        .get(`/api/admin/actions?admin_user_id=${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('actions');
    });

    it('should filter actions by action type', async () => {
      const response = await request(app)
        .get('/api/admin/actions?action_type=user_status_change')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('actions');
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/admin/actions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/health', () => {
    it('should get system health status with admin token', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(['healthy', 'unhealthy', 'warning']).toContain(response.body.status);
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });
});