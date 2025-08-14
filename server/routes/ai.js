const express = require('express');
const multer = require('multer');
const { query } = require('../config/database');
const { 
  authenticateJWT, 
  requireRole, 
  requireVerifiedEmail, 
  requireActiveAccount 
} = require('../middleware/auth');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for resume uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

// Parse resume
router.post('/parse-resume',
  authenticateJWT,
  requireRole('job_seeker'),
  requireVerifiedEmail,
  requireActiveAccount,
  upload.single('resume'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Resume file is required' });
      }

      const parsedData = await aiService.parseResume(req.file.buffer, req.file.originalname);
      
      // Update job seeker profile with parsed data if requested
      if (req.body.update_profile === 'true') {
        const jobSeekerResult = await query(
          'SELECT id FROM job_seekers WHERE user_id = $1',
          [req.user.id]
        );

        if (jobSeekerResult.rows.length > 0) {
          const jobSeekerId = jobSeekerResult.rows[0].id;
          
          // Update profile with parsed data
          await query(`
            UPDATE job_seekers SET
              resume_parsed_data = $1,
              headline = COALESCE(NULLIF($2, ''), headline),
              summary = COALESCE(NULLIF($3, ''), summary),
              skills = COALESCE($4, skills),
              updated_at = NOW()
            WHERE id = $5
          `, [
            JSON.stringify(parsedData),
            parsedData.personal_info?.name,
            parsedData.summary,
            [...(parsedData.skills?.technical || []), ...(parsedData.skills?.soft || [])],
            jobSeekerId
          ]);

          // Add education records
          if (parsedData.education && parsedData.education.length > 0) {
            for (const edu of parsedData.education) {
              await query(`
                INSERT INTO education (job_seeker_id, institution, degree, field_of_study, start_date, end_date, grade)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT DO NOTHING
              `, [
                jobSeekerId,
                edu.institution,
                edu.degree,
                edu.field_of_study,
                edu.start_date || null,
                edu.end_date || null,
                edu.grade
              ]);
            }
          }

          // Add experience records
          if (parsedData.experience && parsedData.experience.length > 0) {
            for (const exp of parsedData.experience) {
              await query(`
                INSERT INTO work_experience (job_seeker_id, company_name, position, location, start_date, end_date, is_current, description)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT DO NOTHING
              `, [
                jobSeekerId,
                exp.company,
                exp.position,
                exp.location,
                exp.start_date || null,
                exp.end_date || null,
                exp.is_current || false,
                exp.description
              ]);
            }
          }
        }
      }

      logger.info(`Resume parsed successfully for user: ${req.user.id}`);

      res.json({
        message: 'Resume parsed successfully',
        data: parsedData
      });
    } catch (error) {
      logger.error('Resume parsing error:', error);
      res.status(500).json({ error: 'Failed to parse resume' });
    }
  }
);

// Get job recommendations for current user
router.get('/job-recommendations',
  authenticateJWT,
  requireRole('job_seeker'),
  requireActiveAccount,
  async (req, res) => {
    try {
      const { limit = 10, min_score = 60 } = req.query;

      // Get job seeker profile
      const jobSeekerResult = await query(
        'SELECT id FROM job_seekers WHERE user_id = $1',
        [req.user.id]
      );

      if (jobSeekerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job seeker profile not found' });
      }

      const jobSeekerProfileId = jobSeekerResult.rows[0].id;

      const recommendations = await aiService.getJobRecommendations(jobSeekerProfileId, {
        limit: parseInt(limit),
        minScore: parseInt(min_score)
      });

      res.json({
        recommendations,
        total: recommendations.length,
        parameters: {
          limit: parseInt(limit),
          min_score: parseInt(min_score)
        }
      });
    } catch (error) {
      logger.error('Job recommendations error:', error);
      res.status(500).json({ error: 'Failed to get job recommendations' });
    }
  }
);

// Get candidate recommendations for a job (Employers only)
router.get('/candidate-recommendations/:jobId',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  requireActiveAccount,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const { limit = 10, min_score = 60 } = req.query;

      // Verify job ownership for employers
      if (req.user.role === 'employer') {
        const jobCheck = await query(`
          SELECT j.id
          FROM jobs j
          JOIN employers e ON j.employer_id = e.id
          WHERE j.id = $1 AND e.user_id = $2
        `, [jobId, req.user.id]);

        if (jobCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Permission denied or job not found' });
        }
      }

      const recommendations = await aiService.getCandidateRecommendations(jobId, {
        limit: parseInt(limit),
        minScore: parseInt(min_score)
      });

      res.json({
        job_id: jobId,
        recommendations,
        total: recommendations.length,
        parameters: {
          limit: parseInt(limit),
          min_score: parseInt(min_score)
        }
      });
    } catch (error) {
      logger.error('Candidate recommendations error:', error);
      res.status(500).json({ error: 'Failed to get candidate recommendations' });
    }
  }
);

// Calculate match score between job and candidate
router.post('/match-score',
  authenticateJWT,
  requireRole(['employer', 'admin']),
  requireActiveAccount,
  async (req, res) => {
    try {
      const { job_id, job_seeker_profile_id } = req.body;

      if (!job_id || !job_seeker_profile_id) {
        return res.status(400).json({ error: 'job_id and job_seeker_profile_id are required' });
      }

      // Verify job ownership for employers
      if (req.user.role === 'employer') {
        const jobCheck = await query(`
          SELECT j.id
          FROM jobs j
          JOIN employers e ON j.employer_id = e.id
          WHERE j.id = $1 AND e.user_id = $2
        `, [job_id, req.user.id]);

        if (jobCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Permission denied or job not found' });
        }
      }

      const matchScore = await aiService.calculateMatchScore(job_id, job_seeker_profile_id);

      res.json({
        job_id,
        job_seeker_profile_id,
        match_score: matchScore
      });
    } catch (error) {
      logger.error('Match score calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate match score' });
    }
  }
);

// Get job search suggestions
router.get('/search-suggestions',
  authenticateJWT,
  requireRole('job_seeker'),
  requireActiveAccount,
  async (req, res) => {
    try {
      // Get job seeker profile
      const jobSeekerResult = await query(
        'SELECT id FROM job_seekers WHERE user_id = $1',
        [req.user.id]
      );

      if (jobSeekerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job seeker profile not found' });
      }

      const jobSeekerProfileId = jobSeekerResult.rows[0].id;

      const suggestions = await aiService.generateJobSearchSuggestions(jobSeekerProfileId);

      res.json({
        suggestions,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Job search suggestions error:', error);
      res.status(500).json({ error: 'Failed to generate search suggestions' });
    }
  }
);

// Analyze resume for improvements
router.post('/analyze-resume',
  authenticateJWT,
  requireRole('job_seeker'),
  requireVerifiedEmail,
  requireActiveAccount,
  upload.single('resume'),
  async (req, res) => {
    try {
      let resumeText;

      if (req.file) {
        // Extract text from uploaded file
        resumeText = await aiService.extractTextFromResume(req.file.buffer, req.file.originalname);
      } else if (req.body.resume_text) {
        // Use provided text
        resumeText = req.body.resume_text;
      } else {
        return res.status(400).json({ error: 'Resume file or text is required' });
      }

      const analysis = await aiService.analyzeResumeForImprovements(resumeText);

      res.json({
        analysis,
        analyzed_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Resume analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze resume' });
    }
  }
);

// Get AI training data statistics (Admin only)
router.get('/training-stats',
  authenticateJWT,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      
      let whereClause = 'WHERE 1=1';
      const queryParams = [];
      
      if (start_date) {
        whereClause += ' AND created_at >= $1';
        queryParams.push(start_date);
      }
      
      if (end_date) {
        whereClause += ` AND created_at <= $${queryParams.length + 1}`;
        queryParams.push(end_date);
      }

      const [totalResult, typeStatsResult, feedbackStatsResult] = await Promise.all([
        // Total training records
        query(`SELECT COUNT(*) as total FROM ai_training_data ${whereClause}`, queryParams),
        
        // By data type
        query(`
          SELECT data_type, COUNT(*) as count 
          FROM ai_training_data ${whereClause}
          GROUP BY data_type 
          ORDER BY count DESC
        `, queryParams),
        
        // Feedback scores distribution
        query(`
          SELECT 
            CASE 
              WHEN feedback_score >= 0.8 THEN 'excellent'
              WHEN feedback_score >= 0.6 THEN 'good'
              WHEN feedback_score >= 0.4 THEN 'average'
              WHEN feedback_score >= 0.2 THEN 'poor'
              ELSE 'very_poor'
            END as score_range,
            COUNT(*) as count
          FROM ai_training_data 
          ${whereClause} AND feedback_score IS NOT NULL
          GROUP BY score_range
        `, queryParams)
      ]);

      res.json({
        total: parseInt(totalResult.rows[0].total),
        by_type: typeStatsResult.rows,
        feedback_distribution: feedbackStatsResult.rows,
        period: {
          start_date: start_date || null,
          end_date: end_date || null
        }
      });
    } catch (error) {
      logger.error('AI training stats error:', error);
      res.status(500).json({ error: 'Failed to get training statistics' });
    }
  }
);

// Provide feedback on AI match scores (for training)
router.post('/feedback',
  authenticateJWT,
  requireActiveAccount,
  async (req, res) => {
    try {
      const { match_id, feedback_score, feedback_comments } = req.body;

      if (!match_id || feedback_score === undefined) {
        return res.status(400).json({ error: 'match_id and feedback_score are required' });
      }

      // Validate feedback score (0-1)
      const score = parseFloat(feedback_score);
      if (score < 0 || score > 1) {
        return res.status(400).json({ error: 'feedback_score must be between 0 and 1' });
      }

      // Update training data with feedback
      const result = await query(`
        UPDATE ai_training_data 
        SET feedback_score = $1, 
            feedback_comments = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [score, feedback_comments || null, match_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Match record not found' });
      }

      logger.info(`AI feedback received: match_id=${match_id}, score=${score}, user=${req.user.id}`);

      res.json({
        message: 'Feedback recorded successfully',
        match_id,
        feedback_score: score
      });
    } catch (error) {
      logger.error('AI feedback error:', error);
      res.status(500).json({ error: 'Failed to record feedback' });
    }
  }
);

// Get skill suggestions based on job market trends
router.get('/skill-suggestions',
  authenticateJWT,
  requireRole('job_seeker'),
  requireActiveAccount,
  async (req, res) => {
    try {
      const { current_skills } = req.query;
      const skills = current_skills ? current_skills.split(',').map(s => s.trim()) : [];

      // Get trending skills from job postings
      const trendingSkillsResult = await query(`
        SELECT 
          skill,
          COUNT(*) as job_count,
          AVG(salary_max) as avg_salary
        FROM (
          SELECT 
            unnest(skills_required) as skill,
            salary_max
          FROM jobs 
          WHERE status = 'active' 
            AND created_at >= NOW() - INTERVAL '3 months'
            AND skills_required IS NOT NULL
        ) skill_jobs
        GROUP BY skill
        HAVING COUNT(*) >= 5
        ORDER BY job_count DESC, avg_salary DESC
        LIMIT 20
      `);

      // Filter out skills the user already has
      const suggestions = trendingSkillsResult.rows
        .filter(row => !skills.some(userSkill => 
          userSkill.toLowerCase() === row.skill.toLowerCase()
        ))
        .slice(0, 10);

      res.json({
        current_skills: skills,
        suggestions: suggestions.map(row => ({
          skill: row.skill,
          demand: parseInt(row.job_count),
          average_salary: row.avg_salary ? Math.round(row.avg_salary) : null
        })),
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Skill suggestions error:', error);
      res.status(500).json({ error: 'Failed to get skill suggestions' });
    }
  }
);

module.exports = router;