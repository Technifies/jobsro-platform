const Redis = require('redis');
const NodeCache = require('node-cache');
const crypto = require('crypto');

/**
 * Advanced Caching System for JobsRo Platform
 * Multi-layer caching with Redis, in-memory, and database query caching
 */

class CacheManager {
  constructor() {
    this.redisClient = null;
    this.memoryCache = new NodeCache({
      stdTTL: 300, // 5 minutes default TTL
      checkperiod: 60, // Cleanup every minute
      useClones: false // Better performance
    });
    
    this.queryCache = new NodeCache({
      stdTTL: 900, // 15 minutes for database queries
      checkperiod: 120,
      useClones: false
    });
    
    this.cacheStats = {
      hits: 0,
      misses: 0,
      operations: 0,
      errors: 0
    };
    
    this.init();
  }

  async init() {
    try {
      // Initialize Redis client
      if (process.env.REDIS_URL) {
        this.redisClient = Redis.createClient({
          url: process.env.REDIS_URL,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              console.error('Redis server connection refused');
              return new Error('Redis server connection refused');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
              return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        this.redisClient.on('error', (err) => {
          console.error('Redis Client Error:', err);
          this.cacheStats.errors++;
        });

        this.redisClient.on('connect', () => {
          console.log('Redis Client Connected');
        });

        await this.redisClient.connect();
      }
    } catch (error) {
      console.error('Failed to initialize Redis:', error.message);
    }
  }

  // Generate cache key
  generateKey(namespace, identifier, params = {}) {
    const paramsString = Object.keys(params).length > 0 ? 
      JSON.stringify(params) : '';
    const keyString = `${namespace}:${identifier}:${paramsString}`;
    
    // Create hash for long keys
    if (keyString.length > 200) {
      return `${namespace}:${crypto.createHash('md5').update(keyString).digest('hex')}`;
    }
    
    return keyString;
  }

  // Multi-layer get
  async get(key, options = {}) {
    this.cacheStats.operations++;
    
    try {
      // Try memory cache first (fastest)
      const memoryResult = this.memoryCache.get(key);
      if (memoryResult !== undefined) {
        this.cacheStats.hits++;
        return memoryResult;
      }

      // Try Redis cache (persistent)
      if (this.redisClient && options.useRedis !== false) {
        const redisResult = await this.redisClient.get(key);
        if (redisResult) {
          const parsed = JSON.parse(redisResult);
          // Store in memory cache for faster access next time
          this.memoryCache.set(key, parsed, options.ttl || 300);
          this.cacheStats.hits++;
          return parsed;
        }
      }

      this.cacheStats.misses++;
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.cacheStats.errors++;
      return null;
    }
  }

  // Multi-layer set
  async set(key, value, options = {}) {
    const ttl = options.ttl || 300;
    
    try {
      // Store in memory cache
      this.memoryCache.set(key, value, ttl);
      
      // Store in Redis if available
      if (this.redisClient && options.useRedis !== false) {
        await this.redisClient.setEx(key, ttl, JSON.stringify(value));
      }
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      this.cacheStats.errors++;
      return false;
    }
  }

  // Delete from all caches
  async delete(key) {
    try {
      this.memoryCache.del(key);
      
      if (this.redisClient) {
        await this.redisClient.del(key);
      }
      
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      this.cacheStats.errors++;
      return false;
    }
  }

  // Batch operations
  async mget(keys) {
    const results = {};
    
    for (const key of keys) {
      results[key] = await this.get(key);
    }
    
    return results;
  }

  async mset(keyValuePairs, options = {}) {
    const promises = [];
    
    for (const [key, value] of Object.entries(keyValuePairs)) {
      promises.push(this.set(key, value, options));
    }
    
    return await Promise.all(promises);
  }

  // Clear caches
  async clear(pattern = null) {
    try {
      if (pattern) {
        // Clear specific pattern
        const keys = this.memoryCache.keys().filter(key => 
          key.includes(pattern)
        );
        this.memoryCache.del(keys);
        
        if (this.redisClient) {
          const redisKeys = await this.redisClient.keys(`*${pattern}*`);
          if (redisKeys.length > 0) {
            await this.redisClient.del(redisKeys);
          }
        }
      } else {
        // Clear all
        this.memoryCache.flushAll();
        
        if (this.redisClient) {
          await this.redisClient.flushAll();
        }
      }
      
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      this.cacheStats.errors++;
      return false;
    }
  }

  // Cache statistics
  getStats() {
    const hitRate = this.cacheStats.operations > 0 ? 
      (this.cacheStats.hits / this.cacheStats.operations * 100).toFixed(2) : 0;
    
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      memoryKeys: this.memoryCache.keys().length,
      memoryStats: this.memoryCache.getStats()
    };
  }

  // Reset statistics
  resetStats() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      operations: 0,
      errors: 0
    };
  }

  // High-level caching methods
  
  // Cache jobs with smart invalidation
  async cacheJob(jobId, jobData, ttl = 3600) { // 1 hour
    const key = this.generateKey('job', jobId);
    return await this.set(key, jobData, { ttl });
  }

  async getJob(jobId) {
    const key = this.generateKey('job', jobId);
    return await this.get(key);
  }

  async invalidateJob(jobId) {
    const key = this.generateKey('job', jobId);
    await this.delete(key);
    
    // Also invalidate related caches
    await this.clear('job_search');
    await this.clear('job_recommendations');
  }

  // Cache job search results
  async cacheJobSearch(searchParams, results, ttl = 600) { // 10 minutes
    const key = this.generateKey('job_search', 'results', searchParams);
    return await this.set(key, results, { ttl });
  }

  async getJobSearch(searchParams) {
    const key = this.generateKey('job_search', 'results', searchParams);
    return await this.get(key);
  }

  // Cache user sessions
  async cacheUserSession(userId, sessionData, ttl = 86400) { // 24 hours
    const key = this.generateKey('session', userId);
    return await this.set(key, sessionData, { ttl, useRedis: true });
  }

  async getUserSession(userId) {
    const key = this.generateKey('session', userId);
    return await this.get(key, { useRedis: true });
  }

  async invalidateUserSession(userId) {
    const key = this.generateKey('session', userId);
    return await this.delete(key);
  }

  // Cache API responses
  async cacheAPIResponse(endpoint, params, response, ttl = 300) {
    const key = this.generateKey('api', endpoint, params);
    return await this.set(key, response, { ttl });
  }

  async getAPIResponse(endpoint, params) {
    const key = this.generateKey('api', endpoint, params);
    return await this.get(key);
  }

  // Cache database queries
  cacheQuery(query, params, result, ttl = 900) { // 15 minutes
    const queryHash = crypto.createHash('md5')
      .update(query + JSON.stringify(params))
      .digest('hex');
    
    const key = this.generateKey('query', queryHash);
    this.queryCache.set(key, result, ttl);
    return result;
  }

  getCachedQuery(query, params) {
    const queryHash = crypto.createHash('md5')
      .update(query + JSON.stringify(params))
      .digest('hex');
    
    const key = this.generateKey('query', queryHash);
    return this.queryCache.get(key);
  }

  // Cache middleware factory
  createCacheMiddleware(options = {}) {
    return async (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Skip caching for authenticated requests unless explicitly allowed
      if (req.user && !options.allowAuthenticated) {
        return next();
      }

      const cacheKey = this.generateKey(
        'middleware',
        req.originalUrl || req.url,
        { user: req.user?.id || 'anonymous' }
      );

      try {
        const cachedResponse = await this.get(cacheKey);
        
        if (cachedResponse) {
          res.set('X-Cache', 'HIT');
          return res.json(cachedResponse);
        }

        // Override res.json to cache the response
        const originalJson = res.json;
        res.json = function(body) {
          if (res.statusCode === 200) {
            cacheManager.set(cacheKey, body, { 
              ttl: options.ttl || 300 
            });
          }
          res.set('X-Cache', 'MISS');
          return originalJson.call(this, body);
        };

        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }

  // Warm up cache with frequently accessed data
  async warmupCache() {
    try {
      console.log('Starting cache warmup...');
      
      // Warm up popular job categories
      const { query } = require('../config/database');
      
      const popularCategories = await query(
        'SELECT DISTINCT category FROM jobs WHERE status = $1 LIMIT 20',
        ['active']
      );
      
      for (const category of popularCategories.rows) {
        const categoryJobs = await query(
          'SELECT * FROM jobs WHERE category = $1 AND status = $2 LIMIT 50',
          [category.category, 'active']
        );
        
        await this.cacheJobSearch(
          { category: category.category },
          categoryJobs.rows,
          1800 // 30 minutes
        );
      }
      
      console.log('Cache warmup completed');
    } catch (error) {
      console.error('Cache warmup error:', error);
    }
  }

  // Cache health check
  async healthCheck() {
    try {
      const testKey = 'health_check_' + Date.now();
      const testValue = { test: true, timestamp: Date.now() };
      
      // Test memory cache
      this.memoryCache.set(testKey, testValue);
      const memoryResult = this.memoryCache.get(testKey);
      const memoryHealthy = JSON.stringify(memoryResult) === JSON.stringify(testValue);
      
      // Test Redis cache
      let redisHealthy = true;
      if (this.redisClient) {
        await this.redisClient.set(testKey, JSON.stringify(testValue));
        const redisResult = await this.redisClient.get(testKey);
        redisHealthy = redisResult === JSON.stringify(testValue);
        
        // Cleanup
        await this.redisClient.del(testKey);
      }
      
      this.memoryCache.del(testKey);
      
      return {
        healthy: memoryHealthy && redisHealthy,
        memory: memoryHealthy,
        redis: this.redisClient ? redisHealthy : 'not_configured',
        stats: this.getStats()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        stats: this.getStats()
      };
    }
  }
}

// Create global cache manager
const cacheManager = new CacheManager();

// Export both class and instance
module.exports = {
  CacheManager,
  cacheManager
};