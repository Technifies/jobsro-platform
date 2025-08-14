# JobsRo Platform - Deployment Guide

## 🚀 Overview

This guide covers deploying the JobsRo platform in various environments: local development, staging, and production. The platform is containerized using Docker and includes comprehensive monitoring, security, and scalability features.

## 📋 Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows with WSL2
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 20GB free space
- **CPU**: 2+ cores recommended

### Software Dependencies
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Node.js**: Version 18+ (for local development)
- **PostgreSQL**: Version 15+ (if not using Docker)
- **Redis**: Version 7+ (if not using Docker)

## 🔧 Environment Configuration

### 1. Environment Variables

Create a `.env` file in the root directory:

```bash
# Database Configuration
DB_NAME=jobsro_db
DB_USER=jobsro_user
DB_PASSWORD=your_secure_db_password
DB_HOST=postgres
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your_secure_redis_password
REDIS_PORT=6379

# JWT & Security
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_key_minimum_32_characters
PASSWORD_PEPPER=your_password_pepper_secret
CSRF_SECRET=your_csrf_secret_key

# Email Service (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=JobsRo Platform

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# AI Services
OPENAI_API_KEY=your_openai_api_key

# AWS S3 (File Storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=jobsro-uploads

# Video Interview Services
ZOOM_JWT_SECRET=your_zoom_jwt_secret
GOOGLE_MEET_CLIENT_ID=your_google_meet_client_id
GOOGLE_MEET_CLIENT_SECRET=your_google_meet_client_secret

# Application Configuration
NODE_ENV=production
API_PORT=5000
FRONTEND_PORT=3000
CORS_ORIGIN=http://localhost:3000

# React App Environment Variables
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_RAZORPAY_KEY_ID=your_razorpay_key_id

# Monitoring
GRAFANA_PASSWORD=your_grafana_admin_password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Production Environment Variables

For production, update these values:

```bash
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
REACT_APP_API_URL=https://your-domain.com/api
DB_HOST=your_production_db_host
REDIS_URL=redis://your_production_redis_host:6379
```

## 🐳 Docker Deployment

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/jobsro.git
   cd jobsro
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the development environment**:
   ```bash
   docker-compose up -d
   ```

4. **Initialize the database**:
   ```bash
   docker-compose exec api npm run db:migrate
   docker-compose exec api npm run db:seed
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Database: localhost:5432
   - Redis: localhost:6379
   - Grafana: http://localhost:3001
   - Prometheus: http://localhost:9090

### Production Deployment

1. **Prepare the production server**:
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Deploy the application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-org/jobsro.git
   cd jobsro
   
   # Set up production environment
   cp .env.production .env
   # Configure production values in .env
   
   # Start production services
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

3. **Set up SSL certificates** (using Let's Encrypt):
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx
   
   # Obtain SSL certificates
   sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
   
   # Configure nginx with SSL (uncomment HTTPS server block in nginx.conf)
   ```

4. **Set up automated backups**:
   ```bash
   # Create backup script
   sudo nano /usr/local/bin/jobsro-backup.sh
   
   # Add backup cron job
   sudo crontab -e
   # Add: 0 2 * * * /usr/local/bin/jobsro-backup.sh
   ```

## ☁️ Cloud Deployment

### AWS Deployment

1. **Prerequisites**:
   - AWS CLI configured
   - Docker images pushed to ECR
   - RDS PostgreSQL instance
   - ElastiCache Redis cluster
   - S3 bucket for file storage
   - Application Load Balancer
   - ECS cluster or EKS cluster

2. **Deploy using ECS**:
   ```bash
   # Build and push Docker images
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
   
   docker build -t jobsro-api ./server
   docker tag jobsro-api:latest your-account.dkr.ecr.us-east-1.amazonaws.com/jobsro-api:latest
   docker push your-account.dkr.ecr.us-east-1.amazonaws.com/jobsro-api:latest
   
   docker build -t jobsro-frontend ./client
   docker tag jobsro-frontend:latest your-account.dkr.ecr.us-east-1.amazonaws.com/jobsro-frontend:latest
   docker push your-account.dkr.ecr.us-east-1.amazonaws.com/jobsro-frontend:latest
   
   # Deploy using ECS task definitions
   aws ecs create-service --cluster jobsro-cluster --service-name jobsro-api --task-definition jobsro-api:1 --desired-count 2
   ```

### Google Cloud Platform (GCP)

1. **Prerequisites**:
   - GCP project created
   - Cloud SQL PostgreSQL instance
   - Memorystore Redis instance
   - Cloud Storage bucket
   - GKE cluster

2. **Deploy using GKE**:
   ```bash
   # Build and push to Container Registry
   gcloud builds submit --tag gcr.io/your-project/jobsro-api ./server
   gcloud builds submit --tag gcr.io/your-project/jobsro-frontend ./client
   
   # Deploy to GKE
   kubectl apply -f k8s/
   ```

### Azure Deployment

1. **Prerequisites**:
   - Azure subscription
   - Azure Database for PostgreSQL
   - Azure Cache for Redis
   - Azure Storage Account
   - Azure Container Instances or AKS

2. **Deploy using Azure Container Instances**:
   ```bash
   # Build and push to Azure Container Registry
   az acr build --registry yourregistry --image jobsro-api:latest ./server
   az acr build --registry yourregistry --image jobsro-frontend:latest ./client
   
   # Deploy container instances
   az container create --resource-group jobsro-rg --name jobsro-api --image yourregistry.azurecr.io/jobsro-api:latest
   ```

## 📊 Monitoring & Logging

### Application Monitoring

1. **Prometheus Metrics**: Available at `/metrics` endpoint
2. **Grafana Dashboards**: Pre-configured dashboards for system metrics
3. **Health Checks**: Available at `/health` and `/api/health` endpoints

### Log Management

```bash
# View application logs
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f nginx

# Log rotation (production)
sudo nano /etc/logrotate.d/jobsro
```

### Performance Monitoring

The application includes built-in performance monitoring:
- Request/response times
- Memory usage tracking
- CPU utilization monitoring
- Database query performance
- Cache hit/miss ratios

## 🔒 Security Considerations

### SSL/TLS Configuration

1. **Obtain SSL certificates**:
   ```bash
   # Using Let's Encrypt
   certbot certonly --webroot -w /var/www/html -d your-domain.com
   ```

2. **Configure security headers**:
   - Content Security Policy (CSP)
   - HTTP Strict Transport Security (HSTS)
   - X-Frame-Options
   - X-Content-Type-Options

### Database Security

1. **Secure PostgreSQL**:
   ```bash
   # Create database with limited permissions
   CREATE USER jobsro_user WITH ENCRYPTED PASSWORD 'secure_password';
   GRANT CONNECT ON DATABASE jobsro_db TO jobsro_user;
   GRANT USAGE ON SCHEMA public TO jobsro_user;
   GRANT CREATE ON SCHEMA public TO jobsro_user;
   ```

2. **Enable database backups**:
   ```bash
   # Automated backup script
   pg_dump -h localhost -U jobsro_user jobsro_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
   ```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy JobsRo Platform

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test
      - name: Run E2E tests
        run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Your deployment commands here
```

## 🛠️ Maintenance

### Regular Maintenance Tasks

1. **Database maintenance**:
   ```bash
   # Run weekly
   docker-compose exec postgres psql -U jobsro_user -d jobsro_db -c "VACUUM ANALYZE;"
   ```

2. **Log cleanup**:
   ```bash
   # Clean old logs
   find /var/log/jobsro -name "*.log" -mtime +30 -delete
   ```

3. **Update dependencies**:
   ```bash
   # Check for security updates
   npm audit
   docker-compose pull
   ```

### Backup Strategy

1. **Database backups**:
   ```bash
   # Daily database backup
   docker-compose exec postgres pg_dump -U jobsro_user jobsro_db | gzip > /backups/db_$(date +%Y%m%d).sql.gz
   ```

2. **File backups**:
   ```bash
   # Backup uploaded files
   tar -czf /backups/uploads_$(date +%Y%m%d).tar.gz ./uploads/
   ```

## 🔍 Troubleshooting

### Common Issues

1. **Database connection issues**:
   ```bash
   # Check database connectivity
   docker-compose exec api npm run db:test
   
   # View database logs
   docker-compose logs postgres
   ```

2. **Memory issues**:
   ```bash
   # Monitor memory usage
   docker stats
   
   # Restart services if needed
   docker-compose restart api
   ```

3. **Performance issues**:
   ```bash
   # Check performance metrics
   curl http://localhost:5000/api/admin/performance
   
   # View slow query log
   docker-compose logs postgres | grep "slow query"
   ```

### Health Checks

```bash
# Check all services
curl http://localhost/health
curl http://localhost:5000/api/health

# Check individual components
docker-compose exec api node -e "console.log(require('./utils/performance').performanceMonitor.getSummary())"
```

## 📞 Support

For deployment assistance:
- 📧 Email: support@jobsro.com
- 📱 Phone: +1-234-567-8900
- 💬 Slack: #jobsro-deployment
- 📖 Documentation: https://docs.jobsro.com

---

## 🎯 Next Steps

After successful deployment:
1. Configure monitoring alerts
2. Set up automated backups
3. Configure CDN for static assets
4. Implement disaster recovery plan
5. Set up staging environment
6. Configure performance monitoring
7. Review security settings

For detailed configuration of each component, refer to the individual service documentation in the `/docs` directory.