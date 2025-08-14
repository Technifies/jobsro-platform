# JobsRo API Documentation

## 📋 Overview

This document provides comprehensive documentation for the JobsRo Platform API. The API is built using RESTful principles with JSON request/response bodies and standard HTTP status codes.

**Base URL**: `https://api.jobsro.com` (Production) | `http://localhost:5000/api` (Development)

**API Version**: v1

## 🔐 Authentication

### JWT Token Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Authentication Flow

1. **Register/Login** to get access and refresh tokens
2. **Include access token** in API requests
3. **Refresh token** when access token expires
4. **Logout** to invalidate tokens

---

## 📚 API Endpoints

### 🔑 Authentication Endpoints

#### POST `/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "jobSeeker", // or "employer"
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "jobSeeker",
      "isEmailVerified": false
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "dGhpc2lzYXJlZnJlc2h0b2tlbg...",
      "expiresIn": "15m"
    }
  }
}
```

#### POST `/auth/login`
Login to an existing account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "jobSeeker"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "dGhpc2lzYXJlZnJlc2h0b2tlbg...",
      "expiresIn": "15m"
    }
  }
}
```

#### POST `/auth/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "dGhpc2lzYXJlZnJlc2h0b2tlbg..."
}
```

#### POST `/auth/logout`
Logout and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

#### POST `/auth/forgot-password`
Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### POST `/auth/reset-password`
Reset password with token.

**Request Body:**
```json
{
  "token": "reset_token_here",
  "newPassword": "NewSecurePass123!"
}
```

#### POST `/auth/verify-email`
Verify email address.

**Request Body:**
```json
{
  "token": "email_verification_token"
}
```

---

### 👤 User Management Endpoints

#### GET `/users/profile`
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "jobSeeker",
    "profile": {
      "title": "Software Developer",
      "bio": "Experienced full-stack developer...",
      "skills": ["JavaScript", "React", "Node.js"],
      "experience": 5,
      "location": "New York, NY",
      "avatar": "https://cdn.jobsro.com/avatars/user1.jpg"
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "lastActive": "2024-01-15T10:30:00Z"
  }
}
```

#### PUT `/users/profile`
Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "profile": {
    "title": "Senior Software Developer",
    "bio": "Experienced full-stack developer with expertise in modern web technologies",
    "skills": ["JavaScript", "React", "Node.js", "Python"],
    "experience": 6,
    "location": "San Francisco, CA",
    "expectedSalary": 120000,
    "availableFrom": "2024-02-01"
  }
}
```

#### POST `/users/avatar`
Upload user avatar.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body:** FormData with `avatar` file

#### GET `/users/dashboard`
Get user dashboard data.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalApplications": 15,
      "pendingApplications": 5,
      "interviewsScheduled": 2,
      "profileViews": 45
    },
    "recentApplications": [...],
    "recommendedJobs": [...],
    "upcomingInterviews": [...]
  }
}
```

---

### 💼 Job Management Endpoints

#### GET `/jobs`
Get list of jobs with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Jobs per page (default: 20, max: 100)
- `search` (string): Search query
- `location` (string): Location filter
- `category` (string): Job category
- `employmentType` (string): full-time, part-time, contract, freelance
- `experienceLevel` (string): entry, mid, senior, executive
- `salaryMin` (number): Minimum salary
- `salaryMax` (number): Maximum salary
- `sortBy` (string): createdAt, salary, relevance
- `sortOrder` (string): asc, desc

**Example Request:**
```
GET /api/jobs?search=developer&location=New%20York&salaryMin=80000&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": 1,
        "title": "Senior Full Stack Developer",
        "company": {
          "id": 1,
          "name": "TechCorp Inc.",
          "logo": "https://cdn.jobsro.com/logos/techcorp.jpg"
        },
        "location": "New York, NY",
        "employmentType": "full-time",
        "experienceLevel": "senior",
        "salary": {
          "min": 100000,
          "max": 150000,
          "currency": "USD"
        },
        "description": "We are looking for a senior full stack developer...",
        "requirements": [
          "5+ years of experience with React and Node.js",
          "Strong knowledge of JavaScript and TypeScript"
        ],
        "benefits": [
          "Health insurance",
          "Remote work options",
          "401(k) matching"
        ],
        "tags": ["JavaScript", "React", "Node.js", "Remote"],
        "applicationCount": 25,
        "createdAt": "2024-01-10T09:00:00Z",
        "expiresAt": "2024-02-10T23:59:59Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalJobs": 95,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "appliedFilters": {
        "search": "developer",
        "location": "New York"
      },
      "availableFilters": {
        "locations": ["New York, NY", "San Francisco, CA"],
        "categories": ["Technology", "Marketing"],
        "employmentTypes": ["full-time", "part-time"]
      }
    }
  }
}
```

#### GET `/jobs/:id`
Get detailed job information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Senior Full Stack Developer",
    "company": {
      "id": 1,
      "name": "TechCorp Inc.",
      "logo": "https://cdn.jobsro.com/logos/techcorp.jpg",
      "description": "Leading technology company...",
      "website": "https://techcorp.com",
      "employees": "501-1000",
      "industry": "Technology"
    },
    "location": "New York, NY",
    "employmentType": "full-time",
    "experienceLevel": "senior",
    "salary": {
      "min": 100000,
      "max": 150000,
      "currency": "USD",
      "negotiable": true
    },
    "description": "Full job description...",
    "requirements": [...],
    "benefits": [...],
    "tags": [...],
    "applicationCount": 25,
    "viewCount": 150,
    "isRemote": true,
    "createdAt": "2024-01-10T09:00:00Z",
    "expiresAt": "2024-02-10T23:59:59Z",
    "similarJobs": [...] // Array of similar job objects
  }
}
```

#### POST `/jobs` (Employer Only)
Create a new job posting.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Senior Full Stack Developer",
  "description": "We are looking for a senior full stack developer to join our team...",
  "requirements": [
    "5+ years of experience with React and Node.js",
    "Strong knowledge of JavaScript and TypeScript",
    "Experience with PostgreSQL and Redis"
  ],
  "benefits": [
    "Competitive salary",
    "Health insurance",
    "Remote work options",
    "401(k) matching"
  ],
  "location": "New York, NY",
  "employmentType": "full-time",
  "experienceLevel": "senior",
  "category": "Technology",
  "salary": {
    "min": 100000,
    "max": 150000,
    "currency": "USD",
    "negotiable": true
  },
  "isRemote": true,
  "tags": ["JavaScript", "React", "Node.js", "Remote"],
  "expiresAt": "2024-03-01T23:59:59Z"
}
```

#### PUT `/jobs/:id` (Employer Only)
Update existing job posting.

#### DELETE `/jobs/:id` (Employer Only)
Delete job posting.

#### GET `/jobs/categories`
Get available job categories.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "technology",
      "name": "Technology",
      "jobCount": 1250,
      "subcategories": [
        {
          "id": "software-development",
          "name": "Software Development",
          "jobCount": 680
        }
      ]
    }
  ]
}
```

#### GET `/jobs/locations`
Get popular job locations.

---

### 📝 Application Management Endpoints

#### POST `/applications`
Submit a job application.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "jobId": 1,
  "coverLetter": "I am very interested in this position because...",
  "resume": "https://cdn.jobsro.com/resumes/user1_resume.pdf",
  "expectedSalary": 120000,
  "availableFrom": "2024-02-01",
  "customAnswers": [
    {
      "questionId": 1,
      "answer": "Yes, I have 5 years of experience with React"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "id": 1,
    "jobId": 1,
    "status": "pending",
    "submittedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### GET `/applications`
Get user's job applications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status`: pending, reviewed, shortlisted, rejected, hired
- `page`, `limit`: Pagination

**Response:**
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": 1,
        "job": {
          "id": 1,
          "title": "Senior Full Stack Developer",
          "company": {
            "name": "TechCorp Inc.",
            "logo": "https://cdn.jobsro.com/logos/techcorp.jpg"
          }
        },
        "status": "pending",
        "submittedAt": "2024-01-15T10:30:00Z",
        "lastUpdated": "2024-01-15T10:30:00Z",
        "feedback": null
      }
    ],
    "stats": {
      "total": 15,
      "pending": 8,
      "reviewed": 4,
      "shortlisted": 2,
      "rejected": 1
    }
  }
}
```

#### GET `/applications/:id`
Get detailed application information.

#### PUT `/applications/:id` (Employer Only)
Update application status.

**Request Body:**
```json
{
  "status": "shortlisted",
  "feedback": "Great candidate, scheduling interview",
  "interviewDate": "2024-01-20T14:00:00Z"
}
```

#### DELETE `/applications/:id`
Withdraw application.

---

### 🏢 Company Management Endpoints

#### GET `/companies`
Get list of companies.

#### GET `/companies/:id`
Get company details.

#### POST `/companies` (Employer Only)
Create company profile.

#### PUT `/companies/:id` (Employer Only)
Update company profile.

---

### 💳 Payment Endpoints

#### GET `/payments/plans`
Get subscription plans.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "basic",
      "name": "Basic Plan",
      "description": "Perfect for small companies",
      "price": {
        "monthly": 49,
        "yearly": 490,
        "currency": "USD"
      },
      "features": [
        "5 job postings per month",
        "Basic analytics",
        "Email support"
      ],
      "limits": {
        "jobPostings": 5,
        "featuredJobs": 1,
        "cvDownloads": 50
      }
    }
  ]
}
```

#### POST `/payments/subscribe`
Create subscription.

#### GET `/payments/subscription`
Get current subscription details.

#### POST `/payments/cancel`
Cancel subscription.

---

### 🤖 AI Services Endpoints

#### POST `/ai/resume/parse`
Parse resume file and extract information.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body:** FormData with `resume` file

**Response:**
```json
{
  "success": true,
  "data": {
    "personalInfo": {
      "name": "John Doe",
      "email": "john.doe@email.com",
      "phone": "+1234567890",
      "location": "New York, NY"
    },
    "experience": [
      {
        "company": "TechCorp",
        "position": "Software Developer",
        "startDate": "2020-01",
        "endDate": "2024-01",
        "description": "Developed web applications..."
      }
    ],
    "education": [...],
    "skills": ["JavaScript", "React", "Node.js"],
    "confidence": 0.95
  }
}
```

#### POST `/ai/jobs/match`
Get AI-powered job recommendations.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userProfile": {
    "skills": ["JavaScript", "React", "Node.js"],
    "experience": 5,
    "location": "New York, NY",
    "salaryExpectation": 120000
  },
  "limit": 10
}
```

#### POST `/ai/resume/optimize`
Get resume optimization suggestions.

#### POST `/ai/job/analyze`
Analyze job posting and provide insights.

---

### 📹 Interview Management Endpoints

#### POST `/interviews/schedule`
Schedule a video interview.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "applicationId": 1,
  "interviewType": "video",
  "platform": "google_meet", // or "zoom"
  "scheduledAt": "2024-01-20T14:00:00Z",
  "duration": 60,
  "interviewers": [
    {
      "name": "Jane Smith",
      "email": "jane@techcorp.com",
      "role": "Engineering Manager"
    }
  ],
  "notes": "Technical interview focusing on React and Node.js"
}
```

#### GET `/interviews`
Get scheduled interviews.

#### PUT `/interviews/:id`
Update interview details.

#### POST `/interviews/:id/join`
Generate meeting link and join interview.

#### POST `/interviews/:id/complete`
Mark interview as completed and provide feedback.

---

### 📊 Analytics Endpoints

#### GET `/analytics/dashboard` (Employer/Admin)
Get dashboard analytics.

#### GET `/analytics/jobs/:id` (Employer)
Get job-specific analytics.

#### GET `/analytics/system` (Admin Only)
Get system-wide analytics.

---

### 👨‍💼 Admin Endpoints

#### GET `/admin/users`
Get users with management options.

#### PUT `/admin/users/:id`
Update user status (activate, deactivate, ban).

#### GET `/admin/jobs`
Get all jobs for moderation.

#### PUT `/admin/jobs/:id/approve`
Approve job posting.

#### GET `/admin/payments`
Get payment transactions.

#### GET `/admin/analytics`
Get comprehensive system analytics.

#### GET `/admin/settings`
Get system settings.

#### PUT `/admin/settings`
Update system settings.

---

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ },
  "meta": { /* metadata like pagination */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

## 🚦 HTTP Status Codes

- `200` - OK: Request successful
- `201` - Created: Resource created successfully
- `400` - Bad Request: Invalid request data
- `401` - Unauthorized: Authentication required
- `403` - Forbidden: Insufficient permissions
- `404` - Not Found: Resource not found
- `409` - Conflict: Resource already exists
- `422` - Unprocessable Entity: Validation error
- `429` - Too Many Requests: Rate limit exceeded
- `500` - Internal Server Error: Server error

## 🔄 Rate Limiting

### Rate Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| File Upload | 10 requests | 1 hour |
| Search | 200 requests | 15 minutes |
| AI Services | 20 requests | 1 hour |

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642694400
```

## 📱 Webhooks

### Job Application Webhook
Triggered when a new application is received.

**Payload:**
```json
{
  "event": "application.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "applicationId": 1,
    "jobId": 1,
    "candidateId": 1,
    "status": "pending"
  }
}
```

### Payment Webhook
Triggered for payment events.

**Payload:**
```json
{
  "event": "payment.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "paymentId": "pay_123456",
    "amount": 4900,
    "currency": "USD",
    "status": "captured"
  }
}
```

## 🔧 SDK and Libraries

### JavaScript SDK
```bash
npm install @jobsro/sdk
```

```javascript
import JobsRoSDK from '@jobsro/sdk';

const client = new JobsRoSDK({
  baseURL: 'https://api.jobsro.com',
  apiKey: 'your_api_key'
});

// Get jobs
const jobs = await client.jobs.list({
  search: 'developer',
  location: 'New York'
});

// Submit application
const application = await client.applications.create({
  jobId: 1,
  coverLetter: 'I am interested...'
});
```

### Python SDK
```bash
pip install jobsro-python
```

```python
from jobsro import JobsRoClient

client = JobsRoClient(
    base_url='https://api.jobsro.com',
    api_key='your_api_key'
)

# Get jobs
jobs = client.jobs.list(search='developer', location='New York')

# Submit application
application = client.applications.create(
    job_id=1,
    cover_letter='I am interested...'
)
```

## 🧪 Testing the API

### Using cURL

```bash
# Login
curl -X POST https://api.jobsro.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Get jobs
curl -X GET "https://api.jobsro.com/jobs?search=developer&location=New%20York" \
  -H "Authorization: Bearer <your_token>"

# Submit application
curl -X POST https://api.jobsro.com/applications \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": 1,
    "coverLetter": "I am very interested in this position..."
  }'
```

### Postman Collection

Import the JobsRo Postman collection for easy API testing:
- [Download Postman Collection](https://api.jobsro.com/postman/collection.json)

## 🔐 Security Considerations

### API Security Best Practices
- Always use HTTPS in production
- Store API keys securely
- Implement proper authentication
- Validate all input data
- Use rate limiting
- Log security events
- Regular security audits

### Authentication Security
- JWT tokens expire after 15 minutes
- Refresh tokens expire after 30 days
- Implement logout to invalidate tokens
- Use secure password policies
- Enable 2FA for sensitive accounts

## 📞 Support

### API Support
- 📧 **Email**: api-support@jobsro.com
- 📖 **Documentation**: https://docs.jobsro.com/api
- 💬 **Discord**: #api-help channel
- 🐛 **Issues**: [GitHub Issues](https://github.com/jobsro/api/issues)

### Status Page
Monitor API status and incidents: https://status.jobsro.com

---

*Last updated: January 2024*
*API Version: 1.0*