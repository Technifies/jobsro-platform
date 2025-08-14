const request = require('supertest');
const app = require('../server/index');

describe('AI Services API', () => {
  let server;
  let jobSeekerToken;
  let employerToken;
  let testJobId;
  let testJobSeekerId;

  beforeAll(async () => {
    await global.setupTestDatabase();

    // Create test users
    const jobSeekerData = global.testHelpers.createUserPayload({
      email: 'jobseeker@example.com',
      role: 'job_seeker'
    });

    const employerData = global.testHelpers.createUserPayload({
      email: 'employer@example.com',
      role: 'employer'
    });

    // Register users
    await request(app).post('/api/auth/register').send(jobSeekerData);
    await request(app).post('/api/auth/register').send(employerData);

    // Login and get tokens
    const jobSeekerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: jobSeekerData.email, password: jobSeekerData.password });
    jobSeekerToken = jobSeekerLogin.body.tokens.accessToken;

    const employerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: employerData.email, password: employerData.password });
    employerToken = employerLogin.body.tokens.accessToken;

    // Create a test job
    const jobData = global.testHelpers.createJobPayload();
    const jobResponse = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send(jobData);
    testJobId = jobResponse.body.job.id;

    // Get job seeker profile ID
    const profileResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${jobSeekerToken}`);
    testJobSeekerId = profileResponse.body.user.id;
  });

  afterAll(async () => {
    await global.cleanupTestDatabase();
    if (server) {
      server.close();
    }
  });

  describe('POST /api/ai/parse-resume', () => {
    it('should parse resume with valid file', async () => {
      // Create a mock file buffer
      const mockResumeContent = `
        John Doe
        john.doe@example.com
        +91-9876543210
        
        Experience:
        Software Engineer at TechCorp (2020-2023)
        - Developed web applications using JavaScript and Node.js
        - Worked with React and MongoDB
        
        Education:
        B.Tech Computer Science from XYZ University (2016-2020)
        
        Skills:
        JavaScript, Node.js, React, MongoDB, Python
      `;

      const response = await request(app)
        .post('/api/ai/parse-resume')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .attach('resume', Buffer.from(mockResumeContent), 'resume.txt')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Resume parsed successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('personal_info');
      expect(response.body.data).toHaveProperty('skills');
      expect(response.body.data.personal_info).toHaveProperty('name');
      expect(response.body.data.personal_info).toHaveProperty('email');
    });

    it('should reject resume parsing for non-job-seekers', async () => {
      const mockResumeContent = 'Resume content';

      const response = await request(app)
        .post('/api/ai/parse-resume')
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('resume', Buffer.from(mockResumeContent), 'resume.txt')
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should reject request without resume file', async () => {
      const response = await request(app)
        .post('/api/ai/parse-resume')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Resume file is required');
    });

    it('should reject invalid file types', async () => {
      const mockContent = 'Invalid content';

      const response = await request(app)
        .post('/api/ai/parse-resume')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .attach('resume', Buffer.from(mockContent), 'resume.exe')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should parse resume and update profile when requested', async () => {
      const mockResumeContent = 'Resume with profile update';

      const response = await request(app)
        .post('/api/ai/parse-resume')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .field('update_profile', 'true')
        .attach('resume', Buffer.from(mockResumeContent), 'resume.txt')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Resume parsed successfully');
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/ai/job-recommendations', () => {
    it('should get job recommendations for job seeker', async () => {
      const response = await request(app)
        .get('/api/ai/job-recommendations')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('parameters');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });

    it('should filter recommendations by minimum score', async () => {
      const response = await request(app)
        .get('/api/ai/job-recommendations?min_score=80')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body.parameters).toHaveProperty('min_score', 80);
    });

    it('should limit number of recommendations', async () => {
      const response = await request(app)
        .get('/api/ai/job-recommendations?limit=5')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body.parameters).toHaveProperty('limit', 5);
      expect(response.body.recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should reject recommendation request for employers', async () => {
      const response = await request(app)
        .get('/api/ai/job-recommendations')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should handle job seeker with no profile gracefully', async () => {
      // This would test a job seeker without a complete profile
      const response = await request(app)
        .get('/api/ai/job-recommendations')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('profile not found');
    });
  });

  describe('GET /api/ai/candidate-recommendations/:jobId', () => {
    it('should get candidate recommendations for job owner', async () => {
      const response = await request(app)
        .get(`/api/ai/candidate-recommendations/${testJobId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('job_id', testJobId);
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('parameters');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });

    it('should filter candidate recommendations by minimum score', async () => {
      const response = await request(app)
        .get(`/api/ai/candidate-recommendations/${testJobId}?min_score=75`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(response.body.parameters).toHaveProperty('min_score', 75);
    });

    it('should limit number of candidate recommendations', async () => {
      const response = await request(app)
        .get(`/api/ai/candidate-recommendations/${testJobId}?limit=3`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(response.body.parameters).toHaveProperty('limit', 3);
      expect(response.body.recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should reject candidate recommendations for non-job-owner', async () => {
      const response = await request(app)
        .get(`/api/ai/candidate-recommendations/${testJobId}`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/ai/candidate-recommendations/99999')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/ai/match-score', () => {
    it('should calculate match score for valid job and candidate', async () => {
      const matchData = {
        job_id: testJobId,
        job_seeker_profile_id: testJobSeekerId
      };

      const response = await request(app)
        .post('/api/ai/match-score')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(matchData)
        .expect(200);

      expect(response.body).toHaveProperty('job_id', testJobId);
      expect(response.body).toHaveProperty('job_seeker_profile_id', testJobSeekerId);
      expect(response.body).toHaveProperty('match_score');
      expect(response.body.match_score).toHaveProperty('total_score');
      expect(response.body.match_score).toHaveProperty('skills_match');
      expect(response.body.match_score).toHaveProperty('experience_match');
    });

    it('should reject match score calculation for job seekers', async () => {
      const matchData = {
        job_id: testJobId,
        job_seeker_profile_id: testJobSeekerId
      };

      const response = await request(app)
        .post('/api/ai/match-score')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send(matchData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with missing parameters', async () => {
      const response = await request(app)
        .post('/api/ai/match-score')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should reject match score for non-owned job', async () => {
      // Create another employer and job
      const otherEmployerData = global.testHelpers.createUserPayload({
        email: 'other-employer@example.com',
        role: 'employer'
      });
      
      await request(app).post('/api/auth/register').send(otherEmployerData);
      
      const otherEmployerLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: otherEmployerData.email, password: otherEmployerData.password });
      
      const otherJobData = global.testHelpers.createJobPayload({
        title: 'Other Job'
      });
      
      const otherJobResponse = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${otherEmployerLogin.body.tokens.accessToken}`)
        .send(otherJobData);

      const matchData = {
        job_id: otherJobResponse.body.job.id,
        job_seeker_profile_id: testJobSeekerId
      };

      const response = await request(app)
        .post('/api/ai/match-score')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(matchData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/ai/search-suggestions', () => {
    it('should get search suggestions for job seeker', async () => {
      const response = await request(app)
        .get('/api/ai/search-suggestions')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('suggestions');
      expect(response.body).toHaveProperty('generated_at');
      expect(response.body.suggestions).toHaveProperty('keywords');
      expect(response.body.suggestions).toHaveProperty('job_titles');
      expect(Array.isArray(response.body.suggestions.keywords)).toBe(true);
      expect(Array.isArray(response.body.suggestions.job_titles)).toBe(true);
    });

    it('should reject search suggestions for employers', async () => {
      const response = await request(app)
        .get('/api/ai/search-suggestions')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle job seeker with no profile gracefully', async () => {
      const response = await request(app)
        .get('/api/ai/search-suggestions')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/ai/analyze-resume', () => {
    it('should analyze resume with file upload', async () => {
      const mockResumeContent = `
        John Doe - Software Engineer
        Email: john@example.com
        
        Experience:
        - 3 years at TechCorp
        - Built web applications
        - Used JavaScript, React, Node.js
        
        Education:
        - B.Tech Computer Science
        
        Skills: JavaScript, React, Node.js
      `;

      const response = await request(app)
        .post('/api/ai/analyze-resume')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .attach('resume', Buffer.from(mockResumeContent), 'resume.txt')
        .expect(200);

      expect(response.body).toHaveProperty('analysis');
      expect(response.body).toHaveProperty('analyzed_at');
      expect(response.body.analysis).toHaveProperty('score');
      expect(response.body.analysis).toHaveProperty('strengths');
      expect(response.body.analysis).toHaveProperty('weaknesses');
      expect(response.body.analysis).toHaveProperty('suggestions');
    });

    it('should analyze resume with text content', async () => {
      const resumeText = 'Software Engineer with 5 years experience in web development';

      const response = await request(app)
        .post('/api/ai/analyze-resume')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send({ resume_text: resumeText })
        .expect(200);

      expect(response.body).toHaveProperty('analysis');
      expect(response.body.analysis).toHaveProperty('score');
    });

    it('should reject analysis without resume data', async () => {
      const response = await request(app)
        .post('/api/ai/analyze-resume')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Resume file or text is required');
    });

    it('should reject analysis for employers', async () => {
      const response = await request(app)
        .post('/api/ai/analyze-resume')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ resume_text: 'test' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/ai/skill-suggestions', () => {
    it('should get skill suggestions based on market trends', async () => {
      const response = await request(app)
        .get('/api/ai/skill-suggestions')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('current_skills');
      expect(response.body).toHaveProperty('suggestions');
      expect(response.body).toHaveProperty('generated_at');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });

    it('should filter out existing skills from suggestions', async () => {
      const currentSkills = 'JavaScript,React,Node.js';

      const response = await request(app)
        .get(`/api/ai/skill-suggestions?current_skills=${currentSkills}`)
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .expect(200);

      expect(response.body.current_skills).toContain('JavaScript');
      expect(response.body.current_skills).toContain('React');
      expect(response.body.current_skills).toContain('Node.js');
    });

    it('should reject skill suggestions for employers', async () => {
      const response = await request(app)
        .get('/api/ai/skill-suggestions')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/ai/feedback', () => {
    it('should record feedback for AI match scores', async () => {
      const feedbackData = {
        match_id: 'test-match-123',
        feedback_score: 0.8,
        feedback_comments: 'Good match, candidate fits well'
      };

      const response = await request(app)
        .post('/api/ai/feedback')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(feedbackData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Feedback recorded successfully');
      expect(response.body).toHaveProperty('match_id', 'test-match-123');
      expect(response.body).toHaveProperty('feedback_score', 0.8);
    });

    it('should reject feedback without required fields', async () => {
      const response = await request(app)
        .post('/api/ai/feedback')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should reject invalid feedback score', async () => {
      const feedbackData = {
        match_id: 'test-match-123',
        feedback_score: 1.5 // Invalid: should be between 0 and 1
      };

      const response = await request(app)
        .post('/api/ai/feedback')
        .set('Authorization', `Bearer ${employerToken}`)
        .send(feedbackData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('between 0 and 1');
    });
  });
});