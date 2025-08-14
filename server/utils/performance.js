const os = require('os');
const cluster = require('cluster');
const { EventEmitter } = require('events');
const logger = require('./logger');

/**
 * Performance Monitoring and Optimization Utilities
 * Comprehensive performance tracking, optimization, and alerting
 */

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      requests: new Map(), // Route -> { count, totalTime, errors }
      system: {
        cpu: [],
        memory: [],
        eventLoop: []
      },
      database: {
        queries: [],
        connections: 0,
        slowQueries: []
      },
      cache: {
        hits: 0,
        misses: 0,
        operations: []
      }
    };
    
    this.alertThresholds = {
      responseTime: 2000, // 2 seconds
      errorRate: 0.05, // 5%
      cpuUsage: 0.80, // 80%
      memoryUsage: 0.85, // 85%
      eventLoopDelay: 100, // 100ms
      slowQueryTime: 1000 // 1 second
    };
    
    this.startTime = Date.now();
    this.isMonitoring = false;
  }

  // Start performance monitoring
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info('Performance monitoring started');
    
    // Monitor system metrics every 30 seconds
    this.systemMonitorInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
    
    // Monitor event loop delay
    this.monitorEventLoop();
    
    // Clean up old metrics every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 5 * 60 * 1000);
  }

  // Stop performance monitoring
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    clearInterval(this.systemMonitorInterval);
    clearInterval(this.eventLoopInterval);
    clearInterval(this.cleanupInterval);
    
    logger.info('Performance monitoring stopped');
  }

  // Collect system metrics
  collectSystemMetrics() {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    const systemLoad = os.loadavg();
    
    const timestamp = Date.now();
    
    // CPU metrics
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length;
    this.metrics.system.cpu.push({
      timestamp,
      usage: cpuPercent,
      user: cpuUsage.user,
      system: cpuUsage.system,
      load: systemLoad
    });
    
    // Memory metrics
    const memoryPercent = memoryUsage.rss / os.totalmem();
    this.metrics.system.memory.push({
      timestamp,
      rss: memoryUsage.rss,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      usage: memoryPercent
    });
    
    // Check thresholds and emit alerts
    if (cpuPercent > this.alertThresholds.cpuUsage) {
      this.emit('alert', 'cpu_high', { usage: cpuPercent, threshold: this.alertThresholds.cpuUsage });
    }
    
    if (memoryPercent > this.alertThresholds.memoryUsage) {
      this.emit('alert', 'memory_high', { usage: memoryPercent, threshold: this.alertThresholds.memoryUsage });
    }
    
    // Keep only last 100 measurements
    if (this.metrics.system.cpu.length > 100) {
      this.metrics.system.cpu = this.metrics.system.cpu.slice(-50);
    }
    
    if (this.metrics.system.memory.length > 100) {
      this.metrics.system.memory = this.metrics.system.memory.slice(-50);
    }
  }

  // Monitor event loop delay
  monitorEventLoop() {
    const start = process.hrtime.bigint();
    
    this.eventLoopInterval = setInterval(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      
      this.metrics.system.eventLoop.push({
        timestamp: Date.now(),
        delay
      });
      
      if (delay > this.alertThresholds.eventLoopDelay) {
        this.emit('alert', 'event_loop_delay', { delay, threshold: this.alertThresholds.eventLoopDelay });
      }
      
      // Keep only last 100 measurements
      if (this.metrics.system.eventLoop.length > 100) {
        this.metrics.system.eventLoop = this.metrics.system.eventLoop.slice(-50);
      }
    }, 1000);
  }

  // Track HTTP request performance
  trackRequest(req, res, next) {
    const startTime = process.hrtime.bigint();
    const route = `${req.method} ${req.route?.path || req.path}`;
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to ms
      
      // Update route metrics
      if (!this.metrics.requests.has(route)) {
        this.metrics.requests.set(route, {
          count: 0,
          totalTime: 0,
          errors: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0,
          recentTimes: []
        });
      }
      
      const routeMetrics = this.metrics.requests.get(route);
      routeMetrics.count++;
      routeMetrics.totalTime += duration;
      routeMetrics.avgTime = routeMetrics.totalTime / routeMetrics.count;
      routeMetrics.minTime = Math.min(routeMetrics.minTime, duration);
      routeMetrics.maxTime = Math.max(routeMetrics.maxTime, duration);
      routeMetrics.recentTimes.push(duration);
      
      // Keep only last 100 request times
      if (routeMetrics.recentTimes.length > 100) {
        routeMetrics.recentTimes = routeMetrics.recentTimes.slice(-50);
      }
      
      // Track errors
      if (res.statusCode >= 400) {
        routeMetrics.errors++;
      }
      
      // Check for slow requests
      if (duration > this.alertThresholds.responseTime) {
        this.emit('alert', 'slow_request', {
          route,
          duration,
          threshold: this.alertThresholds.responseTime,
          statusCode: res.statusCode
        });
      }
      
      // Check error rate
      const errorRate = routeMetrics.errors / routeMetrics.count;
      if (errorRate > this.alertThresholds.errorRate && routeMetrics.count > 10) {
        this.emit('alert', 'high_error_rate', {
          route,
          errorRate,
          threshold: this.alertThresholds.errorRate,
          totalRequests: routeMetrics.count
        });
      }
    });
    
    next();
  }

  // Track database query performance
  trackQuery(query, duration, success = true) {
    const queryInfo = {
      query: query.substring(0, 100), // Truncate long queries
      duration,
      timestamp: Date.now(),
      success
    };
    
    this.metrics.database.queries.push(queryInfo);
    
    // Track slow queries
    if (duration > this.alertThresholds.slowQueryTime) {
      this.metrics.database.slowQueries.push(queryInfo);
      this.emit('alert', 'slow_query', queryInfo);
    }
    
    // Keep only last 1000 queries
    if (this.metrics.database.queries.length > 1000) {
      this.metrics.database.queries = this.metrics.database.queries.slice(-500);
    }
    
    // Keep only last 100 slow queries
    if (this.metrics.database.slowQueries.length > 100) {
      this.metrics.database.slowQueries = this.metrics.database.slowQueries.slice(-50);
    }
  }

  // Track cache performance
  trackCacheOperation(operation, hit = false, duration = 0) {
    if (hit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }
    
    this.metrics.cache.operations.push({
      operation,
      hit,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 operations
    if (this.metrics.cache.operations.length > 1000) {
      this.metrics.cache.operations = this.metrics.cache.operations.slice(-500);
    }
  }

  // Get performance summary
  getSummary() {
    const uptime = Date.now() - this.startTime;
    const totalRequests = Array.from(this.metrics.requests.values())
      .reduce((sum, metrics) => sum + metrics.count, 0);
    
    const totalErrors = Array.from(this.metrics.requests.values())
      .reduce((sum, metrics) => sum + metrics.errors, 0);
    
    const cacheHitRate = this.metrics.cache.hits / 
      (this.metrics.cache.hits + this.metrics.cache.misses) || 0;
    
    const avgResponseTime = Array.from(this.metrics.requests.values())
      .reduce((sum, metrics, index, array) => {
        return sum + (metrics.avgTime / array.length);
      }, 0);
    
    return {
      uptime,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      avgResponseTime,
      cacheHitRate,
      system: {
        cpu: this.getLatestMetric('cpu'),
        memory: this.getLatestMetric('memory'),
        eventLoop: this.getLatestMetric('eventLoop')
      },
      database: {
        totalQueries: this.metrics.database.queries.length,
        slowQueries: this.metrics.database.slowQueries.length,
        connections: this.metrics.database.connections
      }
    };
  }

  // Get latest metric value
  getLatestMetric(type) {
    const metrics = this.metrics.system[type];
    return metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }

  // Get detailed metrics for a specific route
  getRouteMetrics(route) {
    return this.metrics.requests.get(route) || null;
  }

  // Get all route metrics
  getAllRouteMetrics() {
    const routes = {};
    for (const [route, metrics] of this.metrics.requests.entries()) {
      routes[route] = { ...metrics };
    }
    return routes;
  }

  // Clean up old metrics
  cleanupOldMetrics() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean database queries
    this.metrics.database.queries = this.metrics.database.queries
      .filter(query => query.timestamp > cutoff);
    
    // Clean cache operations
    this.metrics.cache.operations = this.metrics.cache.operations
      .filter(op => op.timestamp > cutoff);
    
    // Reset request metrics that haven't been accessed recently
    for (const [route, metrics] of this.metrics.requests.entries()) {
      if (metrics.recentTimes.length === 0) {
        this.metrics.requests.delete(route);
      }
    }
  }

  // Generate performance report
  generateReport() {
    const summary = this.getSummary();
    const routes = this.getAllRouteMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      summary,
      routes,
      systemMetrics: {
        cpu: this.metrics.system.cpu.slice(-10), // Last 10 measurements
        memory: this.metrics.system.memory.slice(-10),
        eventLoop: this.metrics.system.eventLoop.slice(-10)
      },
      slowQueries: this.metrics.database.slowQueries.slice(-10),
      alerts: this.getRecentAlerts()
    };
  }

  // Get recent alerts
  getRecentAlerts() {
    // This would typically be stored in a more persistent way
    return this.recentAlerts || [];
  }
}

// Memory optimization utilities
class MemoryOptimizer {
  constructor() {
    this.gcEnabled = process.env.NODE_ENV === 'production';
    this.gcInterval = 60000; // 1 minute
    this.heapThreshold = 0.8; // 80% of heap limit
  }

  // Start memory optimization
  start() {
    if (!this.gcEnabled) return;
    
    this.interval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.gcInterval);
    
    logger.info('Memory optimizer started');
  }

  // Stop memory optimization
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    logger.info('Memory optimizer stopped');
  }

  // Check memory usage and trigger GC if needed
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
    
    if (heapUsedRatio > this.heapThreshold) {
      logger.warn(`High memory usage detected: ${(heapUsedRatio * 100).toFixed(2)}%`);
      
      if (global.gc) {
        const before = memUsage.heapUsed;
        global.gc();
        const after = process.memoryUsage().heapUsed;
        
        logger.info(`Garbage collection completed. Freed ${(before - after) / 1024 / 1024} MB`);
      }
    }
  }

  // Get memory optimization recommendations
  getRecommendations() {
    const memUsage = process.memoryUsage();
    const recommendations = [];
    
    if (memUsage.heapUsed / memUsage.heapTotal > 0.8) {
      recommendations.push('High heap usage detected. Consider running garbage collection.');
    }
    
    if (memUsage.external > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High external memory usage. Check for memory leaks in native modules.');
    }
    
    if (memUsage.rss > 1024 * 1024 * 1024) { // 1GB
      recommendations.push('High RSS memory usage. Consider implementing memory pooling.');
    }
    
    return recommendations;
  }
}

// Database query optimizer
class DatabaseOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.slowQueries = [];
    this.queryStats = new Map();
  }

  // Analyze query performance
  analyzeQuery(query, duration, result) {
    const queryHash = this.hashQuery(query);
    
    if (!this.queryStats.has(queryHash)) {
      this.queryStats.set(queryHash, {
        query: query.substring(0, 200),
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0
      });
    }
    
    const stats = this.queryStats.get(queryHash);
    stats.count++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    
    // Track slow queries
    if (duration > 1000) { // 1 second
      this.slowQueries.push({
        query: query.substring(0, 200),
        duration,
        timestamp: Date.now(),
        rowCount: result?.rowCount || 0
      });
      
      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries = this.slowQueries.slice(-50);
      }
    }
  }

  // Hash query for statistics
  hashQuery(query) {
    // Normalize query for hashing (remove values, normalize whitespace)
    const normalized = query
      .replace(/\$\d+/g, '?') // Replace parameters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
    
    return require('crypto').createHash('md5').update(normalized).digest('hex');
  }

  // Get query optimization recommendations
  getOptimizationRecommendations() {
    const recommendations = [];
    
    // Find queries that are run frequently but are slow
    for (const [hash, stats] of this.queryStats.entries()) {
      if (stats.count > 100 && stats.avgDuration > 500) {
        recommendations.push({
          type: 'slow_frequent_query',
          query: stats.query,
          count: stats.count,
          avgDuration: stats.avgDuration,
          suggestion: 'Consider adding indexes or optimizing this query'
        });
      }
    }
    
    // Find queries with high variance in execution time
    for (const [hash, stats] of this.queryStats.entries()) {
      const variance = stats.maxDuration - stats.minDuration;
      if (variance > 1000 && stats.count > 10) {
        recommendations.push({
          type: 'inconsistent_performance',
          query: stats.query,
          variance,
          suggestion: 'Query performance is inconsistent. Check for missing indexes or query plan issues'
        });
      }
    }
    
    return recommendations;
  }

  // Get slow query report
  getSlowQueryReport() {
    return {
      count: this.slowQueries.length,
      queries: this.slowQueries.slice(-20), // Last 20 slow queries
      totalStats: Array.from(this.queryStats.values()).length
    };
  }
}

// Create global instances
const performanceMonitor = new PerformanceMonitor();
const memoryOptimizer = new MemoryOptimizer();
const databaseOptimizer = new DatabaseOptimizer();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  performanceMonitor.start();
  memoryOptimizer.start();
}

module.exports = {
  PerformanceMonitor,
  MemoryOptimizer,
  DatabaseOptimizer,
  performanceMonitor,
  memoryOptimizer,
  databaseOptimizer
};