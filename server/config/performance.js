const cluster = require('cluster');
const os = require('os');

/**
 * Performance Configuration for JobsRo Platform
 * Comprehensive performance optimization settings
 */

// Database performance optimization
const databasePerformance = {
  // Connection pooling configuration
  pool: {
    max: 50, // Maximum connections in pool
    min: 10, // Minimum connections to maintain
    idle: 30000, // Close connections after 30s of inactivity
    acquire: 60000, // Maximum time to get connection
    evict: 5000, // Check for idle connections every 5s
    handleDisconnects: true
  },

  // Query optimization settings
  query: {
    timeout: 30000, // 30 second query timeout
    retries: 3, // Retry failed queries 3 times
    retryDelay: 1000, // 1 second delay between retries
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  },

  // Prepared statements
  preparedStatements: true,
  
  // Database indexes for optimal performance
  indexes: [
    // User indexes
    { table: 'users', columns: ['email'], unique: true },
    { table: 'users', columns: ['role', 'status'] },
    { table: 'users', columns: ['created_at'] },
    
    // Job indexes
    { table: 'jobs', columns: ['status', 'expires_at'] },
    { table: 'jobs', columns: ['location'] },
    { table: 'jobs', columns: ['industry'] },
    { table: 'jobs', columns: ['employment_type'] },
    { table: 'jobs', columns: ['salary_min', 'salary_max'] },
    { table: 'jobs', columns: ['skills_required'], type: 'gin' },
    { table: 'jobs', columns: ['created_at'] },
    { table: 'jobs', columns: ['employer_id'] },
    
    // Application indexes
    { table: 'applications', columns: ['job_id', 'job_seeker_id'], unique: true },
    { table: 'applications', columns: ['status'] },
    { table: 'applications', columns: ['created_at'] },
    { table: 'applications', columns: ['job_seeker_id'] },
    
    // Full-text search indexes
    { table: 'jobs', columns: ['title', 'description'], type: 'fulltext' },
    { table: 'companies', columns: ['name', 'description'], type: 'fulltext' },
    
    // Composite indexes for complex queries
    { table: 'jobs', columns: ['status', 'location', 'employment_type'] },
    { table: 'applications', columns: ['job_id', 'status'] },
    { table: 'payments', columns: ['user_id', 'status'] }
  ]
};

// Caching configuration
const cachingConfig = {
  // Redis configuration for caching
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB || 0,
    keyPrefix: 'jobsro:',
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  },

  // Cache strategies
  strategies: {
    // Job listings cache - 5 minutes
    jobs: {
      ttl: 300,
      key: (params) => `jobs:${JSON.stringify(params)}`,
      compress: true
    },

    // User profile cache - 30 minutes
    userProfile: {
      ttl: 1800,
      key: (userId) => `user:${userId}`,
      compress: false
    },

    // Search results cache - 10 minutes
    search: {
      ttl: 600,
      key: (query, filters) => `search:${query}:${JSON.stringify(filters)}`,
      compress: true
    },

    // Analytics cache - 1 hour
    analytics: {
      ttl: 3600,
      key: (type, period) => `analytics:${type}:${period}`,
      compress: true
    },

    // System settings cache - 24 hours
    settings: {
      ttl: 86400,
      key: () => 'system:settings',
      compress: false
    }
  },

  // Cache invalidation patterns
  invalidation: {
    onJobCreate: ['jobs:*', 'analytics:*'],
    onJobUpdate: ['jobs:*', 'search:*', 'analytics:*'],
    onUserUpdate: ['user:*', 'analytics:*'],
    onApplicationCreate: ['analytics:*'],
    onSettingsUpdate: ['system:settings']
  }
};

// API response optimization
const apiOptimization = {
  // Compression middleware settings
  compression: {
    level: 6, // Compression level (1-9)
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Don't compress if the request includes this header
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Fall back to standard filter function
      return require('compression').filter(req, res);
    }
  },

  // Response optimization
  response: {
    // Pagination defaults
    defaultPageSize: 20,
    maxPageSize: 100,
    
    // Field selection
    allowFieldSelection: true,
    defaultFields: {
      users: ['id', 'first_name', 'last_name', 'email', 'role', 'created_at'],
      jobs: ['id', 'title', 'company_name', 'location', 'employment_type', 'salary_min', 'salary_max', 'created_at'],
      applications: ['id', 'job_title', 'company_name', 'status', 'created_at']
    },

    // Response headers for caching
    headers: {
      'Cache-Control': 'public, max-age=300', // 5 minutes for public content
      'ETag': true, // Enable ETag headers
      'Last-Modified': true // Enable Last-Modified headers
    }
  },

  // Request optimization
  request: {
    // Body parsing limits
    jsonLimit: '10mb',
    urlencodedLimit: '10mb',
    
    // Request timeout
    timeout: 30000, // 30 seconds
    
    // Keep-alive settings
    keepAlive: true,
    keepAliveMsecs: 30000
  }
};

// File processing optimization
const fileProcessing = {
  // Resume processing
  resume: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['pdf', 'doc', 'docx', 'txt'],
    processingTimeout: 30000, // 30 seconds
    
    // Parallel processing
    maxConcurrentProcessing: 5,
    
    // Storage optimization
    compression: true,
    thumbnailGeneration: false
  },

  // Image processing
  images: {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    
    // Image optimization
    quality: 85,
    formats: ['webp', 'jpeg'], // Prefer WebP, fallback to JPEG
    
    // Thumbnail sizes
    thumbnails: [
      { width: 150, height: 150, suffix: 'thumb' },
      { width: 300, height: 300, suffix: 'medium' },
      { width: 800, height: 600, suffix: 'large' }
    ]
  }
};

// Search optimization
const searchOptimization = {
  // Elasticsearch configuration (if used)
  elasticsearch: {
    maxResults: 1000,
    timeout: 10000, // 10 seconds
    
    // Index settings
    indices: {
      jobs: {
        settings: {
          number_of_shards: 3,
          number_of_replicas: 1,
          analysis: {
            analyzer: {
              job_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'stop', 'stemmer']
              }
            }
          }
        },
        mappings: {
          properties: {
            title: { type: 'text', analyzer: 'job_analyzer' },
            description: { type: 'text', analyzer: 'job_analyzer' },
            skills_required: { type: 'keyword' },
            location: { type: 'keyword' },
            salary_min: { type: 'integer' },
            salary_max: { type: 'integer' }
          }
        }
      }
    }
  },

  // PostgreSQL full-text search optimization
  postgres: {
    // Text search configuration
    textSearchConfig: 'english',
    
    // Search query optimization
    maxQueryLength: 500,
    minQueryLength: 2,
    
    // Ranking weights
    titleWeight: 'A',
    descriptionWeight: 'B',
    skillsWeight: 'C',
    companyWeight: 'D'
  }
};

// Monitoring and metrics
const monitoring = {
  // Performance metrics collection
  metrics: {
    enabled: true,
    interval: 60000, // Collect metrics every minute
    
    // Metrics to collect
    collect: [
      'cpu_usage',
      'memory_usage',
      'response_times',
      'request_count',
      'error_rate',
      'database_connections',
      'cache_hit_rate'
    ]
  },

  // Health checks
  healthChecks: {
    interval: 30000, // Check every 30 seconds
    timeout: 5000, // 5 second timeout for health checks
    
    checks: [
      {
        name: 'database',
        check: async () => {
          // Database connectivity check
          const { query } = require('./database');
          const result = await query('SELECT 1');
          return result.rows.length > 0;
        }
      },
      {
        name: 'redis',
        check: async () => {
          // Redis connectivity check
          const redis = require('redis');
          const client = redis.createClient(cachingConfig.redis);
          await client.ping();
          return true;
        }
      },
      {
        name: 'email_service',
        check: async () => {
          // Email service check
          return process.env.SENDGRID_API_KEY ? true : false;
        }
      }
    ]
  },

  // Alerting thresholds
  alerts: {
    cpu_usage: 80, // Alert if CPU > 80%
    memory_usage: 85, // Alert if memory > 85%
    response_time: 2000, // Alert if avg response time > 2s
    error_rate: 5, // Alert if error rate > 5%
    database_connections: 40 // Alert if connections > 40
  }
};

// Load balancing and clustering
const clustering = {
  // Cluster configuration
  enabled: process.env.NODE_ENV === 'production',
  workers: process.env.CLUSTER_WORKERS || os.cpus().length,
  
  // Worker management
  restartDelay: 5000, // 5 seconds before restarting failed worker
  maxRestarts: 5, // Maximum restarts per hour
  
  // Load balancing strategy
  strategy: 'round_robin', // round_robin, least_connections, ip_hash
  
  // Graceful shutdown
  gracefulShutdown: {
    timeout: 30000, // 30 seconds for graceful shutdown
    signals: ['SIGTERM', 'SIGINT']
  }
};

// Memory optimization
const memoryOptimization = {
  // Garbage collection settings
  gc: {
    // Enable manual GC if needed
    manual: process.env.NODE_ENV === 'production',
    interval: 60000, // Run GC every minute in production
    
    // Memory thresholds
    heapUsedThreshold: 0.8, // Trigger GC if heap usage > 80%
    rssThreshold: 0.9 // Alert if RSS memory > 90%
  },

  // Buffer management
  buffers: {
    maxSize: 50 * 1024 * 1024, // 50MB max buffer size
    poolSize: 8192, // Buffer pool size
    
    // String optimization
    stringDeduplication: true
  },

  // Object pooling for frequently used objects
  objectPools: {
    userObjects: { max: 1000, min: 100 },
    jobObjects: { max: 500, min: 50 },
    applicationObjects: { max: 200, min: 20 }
  }
};

// CDN and static file optimization
const staticOptimization = {
  // Static file serving
  static: {
    maxAge: '1d', // Cache static files for 1 day
    etag: true,
    lastModified: true,
    
    // Compression for static files
    gzip: true,
    brotli: true
  },

  // CDN configuration
  cdn: {
    enabled: process.env.CDN_ENABLED === 'true',
    baseUrl: process.env.CDN_BASE_URL,
    
    // Asset types to serve from CDN
    assets: ['css', 'js', 'images', 'fonts', 'videos'],
    
    // Cache headers for CDN
    cacheHeaders: {
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'Expires': new Date(Date.now() + 31536000000).toUTCString()
    }
  }
};

module.exports = {
  databasePerformance,
  cachingConfig,
  apiOptimization,
  fileProcessing,
  searchOptimization,
  monitoring,
  clustering,
  memoryOptimization,
  staticOptimization
};