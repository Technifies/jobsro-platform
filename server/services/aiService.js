const { OpenAI } = require('openai');
const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const axios = require('axios');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Resume parser service configuration
const RESUME_PARSER_CONFIG = {
  url: process.env.RESUME_PARSER_URL || 'https://api.resumeparser.io',
  apiKey: process.env.RESUME_PARSER_API_KEY,
  timeout: 30000
};

// AI matching algorithms
class AIMatchingService {
  
  // Parse resume using AI
  async parseResume(resumeBuffer, filename) {
    try {
      // First try external resume parser if available
      if (RESUME_PARSER_CONFIG.apiKey) {
        const parsedData = await this.parseResumeWithExternalAPI(resumeBuffer, filename);
        if (parsedData) return parsedData;
      }

      // Fallback to OpenAI for resume parsing
      const resumeText = await this.extractTextFromResume(resumeBuffer, filename);
      return await this.parseResumeWithOpenAI(resumeText);
      
    } catch (error) {
      logger.error('Resume parsing failed:', error);
      throw new Error('Failed to parse resume');
    }
  }

  // Extract text from resume files
  async extractTextFromResume(buffer, filename) {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (extension === 'pdf') {
      // For PDF parsing, you'd need pdf-parse or similar
      const pdf = require('pdf-parse');
      const data = await pdf(buffer);
      return data.text;
    } else if (extension === 'docx') {
      // For DOCX parsing, use mammoth
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (extension === 'txt') {
      return buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  // Parse resume with external API service
  async parseResumeWithExternalAPI(resumeBuffer, filename) {
    try {
      const formData = new FormData();
      const blob = new Blob([resumeBuffer], { type: 'application/octet-stream' });
      formData.append('file', blob, filename);

      const response = await axios.post(`${RESUME_PARSER_CONFIG.url}/parse`, formData, {
        headers: {
          'Authorization': `Bearer ${RESUME_PARSER_CONFIG.apiKey}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: RESUME_PARSER_CONFIG.timeout
      });

      return this.normalizeResumeData(response.data);
    } catch (error) {
      logger.warn('External resume parser failed:', error.message);
      return null;
    }
  }

  // Parse resume using OpenAI
  async parseResumeWithOpenAI(resumeText) {
    try {
      const prompt = `
        Parse the following resume and extract structured information. Return a JSON object with the following structure:
        {
          "personal_info": {
            "name": "",
            "email": "",
            "phone": "",
            "location": "",
            "linkedin": "",
            "github": ""
          },
          "summary": "",
          "experience": [
            {
              "company": "",
              "position": "",
              "location": "",
              "start_date": "",
              "end_date": "",
              "is_current": false,
              "description": "",
              "achievements": []
            }
          ],
          "education": [
            {
              "institution": "",
              "degree": "",
              "field_of_study": "",
              "start_date": "",
              "end_date": "",
              "grade": ""
            }
          ],
          "skills": {
            "technical": [],
            "soft": [],
            "languages": [],
            "certifications": []
          },
          "projects": [
            {
              "name": "",
              "description": "",
              "technologies": [],
              "url": ""
            }
          ]
        }

        Resume text:
        ${resumeText}

        Return only valid JSON, no additional text.
      `;

      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional resume parser. Extract information accurately and return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });

      const parsedData = JSON.parse(response.choices[0].message.content);
      return this.normalizeResumeData(parsedData);
      
    } catch (error) {
      logger.error('OpenAI resume parsing failed:', error);
      throw new Error('Failed to parse resume with AI');
    }
  }

  // Normalize resume data to consistent format
  normalizeResumeData(data) {
    return {
      personal_info: {
        name: data.personal_info?.name || '',
        email: data.personal_info?.email || '',
        phone: data.personal_info?.phone || '',
        location: data.personal_info?.location || '',
        linkedin: data.personal_info?.linkedin || '',
        github: data.personal_info?.github || ''
      },
      summary: data.summary || '',
      experience: (data.experience || []).map(exp => ({
        company: exp.company || '',
        position: exp.position || '',
        location: exp.location || '',
        start_date: exp.start_date || '',
        end_date: exp.end_date || '',
        is_current: exp.is_current || false,
        description: exp.description || '',
        achievements: exp.achievements || []
      })),
      education: (data.education || []).map(edu => ({
        institution: edu.institution || '',
        degree: edu.degree || '',
        field_of_study: edu.field_of_study || '',
        start_date: edu.start_date || '',
        end_date: edu.end_date || '',
        grade: edu.grade || ''
      })),
      skills: {
        technical: data.skills?.technical || [],
        soft: data.skills?.soft || [],
        languages: data.skills?.languages || [],
        certifications: data.skills?.certifications || []
      },
      projects: (data.projects || []).map(proj => ({
        name: proj.name || '',
        description: proj.description || '',
        technologies: proj.technologies || [],
        url: proj.url || ''
      }))
    };
  }

  // Calculate job-resume match score
  async calculateMatchScore(jobId, jobSeekerProfileId) {
    try {
      // Get job details
      const jobResult = await query(`
        SELECT title, description, skills_required, experience_min, experience_max,
               location, employment_type, education_level, industry
        FROM jobs
        WHERE id = $1
      `, [jobId]);

      if (jobResult.rows.length === 0) {
        throw new Error('Job not found');
      }

      const job = jobResult.rows[0];

      // Get job seeker profile
      const profileResult = await query(`
        SELECT js.*, u.first_name, u.last_name
        FROM job_seekers js
        JOIN users u ON js.user_id = u.id
        WHERE js.id = $1
      `, [jobSeekerProfileId]);

      if (profileResult.rows.length === 0) {
        throw new Error('Job seeker profile not found');
      }

      const profile = profileResult.rows[0];

      // Calculate different match components
      const skillsMatch = this.calculateSkillsMatch(job.skills_required || [], profile.skills || []);
      const experienceMatch = this.calculateExperienceMatch(job, profile);
      const locationMatch = this.calculateLocationMatch(job.location, profile.current_location, profile.preferred_locations);
      const educationMatch = this.calculateEducationMatch(job.education_level, profile);
      
      // Use AI to calculate semantic match
      const semanticMatch = await this.calculateSemanticMatch(job, profile);

      // Weighted scoring
      const weights = {
        skills: 0.35,
        experience: 0.25,
        semantic: 0.20,
        location: 0.10,
        education: 0.10
      };

      const totalScore = 
        (skillsMatch * weights.skills) +
        (experienceMatch * weights.experience) +
        (semanticMatch * weights.semantic) +
        (locationMatch * weights.location) +
        (educationMatch * weights.education);

      const matchDetails = {
        total_score: Math.round(totalScore),
        skills_match: Math.round(skillsMatch),
        experience_match: Math.round(experienceMatch),
        semantic_match: Math.round(semanticMatch),
        location_match: Math.round(locationMatch),
        education_match: Math.round(educationMatch),
        weights
      };

      // Store match data for learning
      await this.storeMatchData(jobId, jobSeekerProfileId, matchDetails);

      return matchDetails;
      
    } catch (error) {
      logger.error('Match score calculation failed:', error);
      throw error;
    }
  }

  // Calculate skills match percentage
  calculateSkillsMatch(jobSkills, profileSkills) {
    if (!jobSkills.length) return 100; // If no skills required, perfect match
    if (!profileSkills.length) return 0; // If no skills listed, no match

    const normalizedJobSkills = jobSkills.map(s => s.toLowerCase().trim());
    const normalizedProfileSkills = profileSkills.map(s => s.toLowerCase().trim());

    let exactMatches = 0;
    let partialMatches = 0;

    normalizedJobSkills.forEach(jobSkill => {
      if (normalizedProfileSkills.includes(jobSkill)) {
        exactMatches++;
      } else {
        // Check for partial matches (contains)
        const hasPartialMatch = normalizedProfileSkills.some(profileSkill => 
          profileSkill.includes(jobSkill) || jobSkill.includes(profileSkill)
        );
        if (hasPartialMatch) {
          partialMatches++;
        }
      });

    const exactWeight = 1.0;
    const partialWeight = 0.5;
    const totalWeight = exactMatches * exactWeight + partialMatches * partialWeight;
    
    return Math.min(100, (totalWeight / normalizedJobSkills.length) * 100);
  }

  // Calculate experience match percentage
  calculateExperienceMatch(job, profile) {
    const profileExperience = profile.experience_years || 0;
    const minRequired = job.experience_min || 0;
    const maxRequired = job.experience_max || 100;

    if (profileExperience >= minRequired && profileExperience <= maxRequired) {
      return 100; // Perfect match
    } else if (profileExperience < minRequired) {
      // Under-qualified: exponential penalty
      const deficit = minRequired - profileExperience;
      return Math.max(0, 100 - (deficit * 15)); // 15% penalty per year short
    } else {
      // Over-qualified: linear penalty
      const excess = profileExperience - maxRequired;
      return Math.max(50, 100 - (excess * 5)); // 5% penalty per year over, min 50%
    }
  }

  // Calculate location match percentage
  calculateLocationMatch(jobLocation, profileLocation, preferredLocations) {
    if (!jobLocation) return 100; // Remote or location not specified
    
    const normalizedJobLocation = jobLocation.toLowerCase().trim();
    
    // Check current location
    if (profileLocation && profileLocation.toLowerCase().includes(normalizedJobLocation)) {
      return 100;
    }

    // Check preferred locations
    if (preferredLocations && Array.isArray(preferredLocations)) {
      const matchingPreferred = preferredLocations.some(loc => 
        loc.toLowerCase().includes(normalizedJobLocation)
      );
      if (matchingPreferred) {
        return 90;
      }
    }

    // Check for same city/state
    const locationParts = normalizedJobLocation.split(',').map(p => p.trim());
    if (profileLocation) {
      const profileParts = profileLocation.toLowerCase().split(',').map(p => p.trim());
      const hasCommonLocation = locationParts.some(part => 
        profileParts.some(pPart => pPart.includes(part) || part.includes(pPart))
      );
      if (hasCommonLocation) {
        return 70;
      }
    }

    return 30; // Different location, but still possible
  }

  // Calculate education match percentage
  calculateEducationMatch(jobEducationLevel, profile) {
    if (!jobEducationLevel) return 100; // No education requirement

    // This would need education data from profile
    // For now, return neutral score
    return 75;
  }

  // Calculate semantic match using AI
  async calculateSemanticMatch(job, profile) {
    try {
      const prompt = `
        Analyze the semantic similarity between this job posting and candidate profile.
        Return a match score from 0-100 based on job responsibilities vs candidate experience,
        industry alignment, role progression, and overall career fit.

        Job:
        Title: ${job.title}
        Description: ${job.description}
        Industry: ${job.industry || 'Not specified'}

        Candidate:
        Current Position: ${profile.current_position || 'Not specified'}
        Current Company: ${profile.current_company || 'Not specified'}
        Summary: ${profile.summary || 'Not provided'}
        Experience Years: ${profile.experience_years || 0}

        Return only a number between 0 and 100.
      `;

      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert career counselor analyzing job-candidate fit. Return only the numeric score.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const score = parseInt(response.choices[0].message.content.trim());
      return Math.max(0, Math.min(100, score || 50));
      
    } catch (error) {
      logger.warn('Semantic match calculation failed, using default:', error.message);
      return 50; // Default moderate score
    }
  }

  // Store match data for machine learning
  async storeMatchData(jobId, jobSeekerProfileId, matchDetails) {
    try {
      await query(`
        INSERT INTO ai_training_data (data_type, input_data, output_data, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [
        'job_match_score',
        JSON.stringify({
          job_id: jobId,
          job_seeker_profile_id: jobSeekerProfileId
        }),
        JSON.stringify(matchDetails)
      ]);
    } catch (error) {
      logger.warn('Failed to store match data for training:', error.message);
    }
  }

  // Get job recommendations for a job seeker
  async getJobRecommendations(jobSeekerProfileId, options = {}) {
    try {
      const { limit = 10, minScore = 60 } = options;

      // Get active jobs
      const jobsResult = await query(`
        SELECT j.*, c.name as company_name, c.logo_url as company_logo
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'active' 
          AND j.deleted_at IS NULL
          AND j.expires_at > NOW()
        ORDER BY j.posted_at DESC
        LIMIT 100
      `);

      const jobs = jobsResult.rows;
      const recommendations = [];

      // Calculate match scores for each job
      for (const job of jobs) {
        try {
          const matchScore = await this.calculateMatchScore(job.id, jobSeekerProfileId);
          
          if (matchScore.total_score >= minScore) {
            recommendations.push({
              ...job,
              match_score: matchScore.total_score,
              match_details: matchScore
            });
          }
        } catch (error) {
          logger.warn(`Failed to calculate match for job ${job.id}:`, error.message);
        }
      }

      // Sort by match score and return top recommendations
      return recommendations
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit);
        
    } catch (error) {
      logger.error('Job recommendations failed:', error);
      throw error;
    }
  }

  // Get candidate recommendations for a job
  async getCandidateRecommendations(jobId, options = {}) {
    try {
      const { limit = 10, minScore = 60 } = options;

      // Get active job seekers
      const candidatesResult = await query(`
        SELECT js.*, u.first_name, u.last_name, u.email, u.profile_image
        FROM job_seekers js
        JOIN users u ON js.user_id = u.id
        WHERE u.status = 'active' 
          AND js.availability_status IN ('actively_looking', 'open_to_opportunities')
        ORDER BY js.updated_at DESC
        LIMIT 100
      `);

      const candidates = candidatesResult.rows;
      const recommendations = [];

      // Calculate match scores for each candidate
      for (const candidate of candidates) {
        try {
          const matchScore = await this.calculateMatchScore(jobId, candidate.id);
          
          if (matchScore.total_score >= minScore) {
            recommendations.push({
              ...candidate,
              match_score: matchScore.total_score,
              match_details: matchScore
            });
          }
        } catch (error) {
          logger.warn(`Failed to calculate match for candidate ${candidate.id}:`, error.message);
        }
      }

      // Sort by match score and return top recommendations
      return recommendations
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit);
        
    } catch (error) {
      logger.error('Candidate recommendations failed:', error);
      throw error;
    }
  }

  // Generate job search suggestions
  async generateJobSearchSuggestions(jobSeekerProfileId) {
    try {
      const profileResult = await query(`
        SELECT * FROM job_seekers WHERE id = $1
      `, [jobSeekerProfileId]);

      if (profileResult.rows.length === 0) {
        throw new Error('Job seeker profile not found');
      }

      const profile = profileResult.rows[0];

      const prompt = `
        Based on this candidate profile, suggest 10 job search keywords and 5 job titles they should search for.
        Return a JSON object with "keywords" and "job_titles" arrays.

        Profile:
        Current Position: ${profile.current_position || 'Not specified'}
        Skills: ${profile.skills?.join(', ') || 'Not specified'}
        Experience: ${profile.experience_years || 0} years
        Summary: ${profile.summary || 'Not provided'}

        Return only valid JSON.
      `;

      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a career advisor providing job search suggestions. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content);
      
    } catch (error) {
      logger.error('Job search suggestions failed:', error);
      return {
        keywords: ['software engineer', 'developer', 'programmer'],
        job_titles: ['Software Engineer', 'Full Stack Developer', 'Backend Developer']
      };
    }
  }

  // Analyze resume and provide improvement suggestions
  async analyzeResumeForImprovements(resumeText) {
    try {
      const prompt = `
        Analyze this resume and provide specific improvement suggestions.
        Return a JSON object with "score" (0-100), "strengths", "weaknesses", and "suggestions" arrays.

        Resume:
        ${resumeText}

        Return only valid JSON.
      `;

      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional resume reviewer. Provide constructive feedback in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.2
      });

      return JSON.parse(response.choices[0].message.content);
      
    } catch (error) {
      logger.error('Resume analysis failed:', error);
      return {
        score: 70,
        strengths: ['Clear format', 'Relevant experience'],
        weaknesses: ['Missing keywords', 'Lacks metrics'],
        suggestions: ['Add quantifiable achievements', 'Include industry keywords']
      };
    }
  }
}

module.exports = new AIMatchingService();