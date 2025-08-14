const cluster = require('cluster');
const os = require('os');
const path = require('path');

/**
 * Production-ready clustering setup for JobsRo Platform
 * Implements load balancing, graceful shutdowns, and worker management
 */

const WORKER_COUNT = process.env.WORKER_COUNT || os.cpus().length;
const MAX_MEMORY_THRESHOLD = 500; // MB
const GRACEFUL_SHUTDOWN_TIMEOUT = 30000; // 30 seconds

class ClusterManager {
  constructor() {
    this.workers = new Map();
    this.shutdownInProgress = false;
    this.workerStats = {
      created: 0,
      restarted: 0,
      died: 0,
      totalRequests: 0
    };
  }

  // Start cluster management
  start() {
    if (cluster.isMaster) {
      this.startMaster();
    } else {
      this.startWorker();
    }
  }

  // Master process management
  startMaster() {
    console.log(`🚀 Master process ${process.pid} starting`);
    console.log(`📊 Creating ${WORKER_COUNT} worker processes`);

    // Fork workers
    for (let i = 0; i < WORKER_COUNT; i++) {
      this.createWorker();
    }

    // Setup cluster event handlers
    this.setupClusterEvents();
    
    // Setup master process monitoring
    this.setupMasterMonitoring();
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();

    console.log(`✅ Cluster started with ${WORKER_COUNT} workers`);
  }

  // Create a new worker
  createWorker() {
    const worker = cluster.fork();
    const workerId = worker.id;
    
    this.workers.set(workerId, {
      worker: worker,
      created: Date.now(),
      requests: 0,
      memory: 0,
      cpu: 0,
      restartCount: 0
    });

    this.workerStats.created++;

    worker.on('message', (msg) => {
      this.handleWorkerMessage(workerId, msg);
    });

    console.log(`👷 Worker ${workerId} (PID: ${worker.process.pid}) started`);
    return worker;
  }

  // Setup cluster event handlers
  setupClusterEvents() {
    cluster.on('exit', (worker, code, signal) => {
      const workerId = worker.id;
      const workerInfo = this.workers.get(workerId);
      
      console.log(`💀 Worker ${workerId} died (PID: ${worker.process.pid}, Code: ${code}, Signal: ${signal})`);
      
      this.workerStats.died++;
      this.workers.delete(workerId);

      // Don't restart during shutdown
      if (!this.shutdownInProgress) {
        console.log(`🔄 Restarting worker ${workerId}`);
        const newWorker = this.createWorker();
        
        if (workerInfo) {
          const newWorkerInfo = this.workers.get(newWorker.id);
          newWorkerInfo.restartCount = workerInfo.restartCount + 1;
          this.workerStats.restarted++;
        }
      }
    });

    cluster.on('online', (worker) => {
      console.log(`✅ Worker ${worker.id} is online`);
    });

    cluster.on('listening', (worker, address) => {
      console.log(`👂 Worker ${worker.id} listening on ${address.address}:${address.port}`);
    });

    cluster.on('disconnect', (worker) => {
      console.log(`📴 Worker ${worker.id} disconnected`);
    });
  }

  // Handle messages from workers
  handleWorkerMessage(workerId, message) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    switch (message.type) {
      case 'stats':
        workerInfo.requests = message.requests;
        workerInfo.memory = message.memory;
        workerInfo.cpu = message.cpu;
        this.workerStats.totalRequests += message.newRequests || 0;
        break;
        
      case 'error':
        console.error(`❌ Worker ${workerId} error:`, message.error);
        break;
        
      case 'warning':
        console.warn(`⚠️  Worker ${workerId} warning:`, message.warning);
        break;
        
      case 'memory_high':
        console.warn(`🧠 Worker ${workerId} high memory usage: ${message.memory}MB`);
        if (message.memory > MAX_MEMORY_THRESHOLD * 1.5) {
          this.restartWorker(workerId);
        }
        break;
    }
  }

  // Restart a specific worker
  async restartWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    console.log(`🔄 Gracefully restarting worker ${workerId}`);
    
    try {
      // Create new worker first
      const newWorker = this.createWorker();
      
      // Wait for new worker to be ready
      await new Promise((resolve) => {
        newWorker.once('listening', resolve);
        setTimeout(resolve, 5000); // Timeout after 5 seconds
      });
      
      // Gracefully shutdown old worker
      workerInfo.worker.disconnect();
      
      // Force kill after timeout
      setTimeout(() => {
        if (!workerInfo.worker.isDead()) {
          console.log(`💀 Force killing worker ${workerId}`);
          workerInfo.worker.kill('SIGKILL');
        }
      }, GRACEFUL_SHUTDOWN_TIMEOUT);
      
    } catch (error) {
      console.error(`❌ Error restarting worker ${workerId}:`, error);
    }
  }

  // Setup master process monitoring
  setupMasterMonitoring() {
    // Monitor workers every 30 seconds
    setInterval(() => {
      this.monitorWorkers();
    }, 30000);

    // Log cluster stats every 5 minutes
    setInterval(() => {
      this.logClusterStats();
    }, 5 * 60 * 1000);
  }

  // Monitor worker health
  monitorWorkers() {
    for (const [workerId, workerInfo] of this.workers.entries()) {
      // Request stats from worker
      workerInfo.worker.send({ type: 'stats_request' });
      
      // Check if worker is responsive
      if (!workerInfo.worker.isDead()) {
        const age = Date.now() - workerInfo.created;
        
        // Restart workers that have been running too long (24 hours)
        if (age > 24 * 60 * 60 * 1000) {
          console.log(`⏰ Restarting worker ${workerId} due to age`);
          this.restartWorker(workerId);
        }
        
        // Check restart count
        if (workerInfo.restartCount > 5) {
          console.error(`❌ Worker ${workerId} has been restarted ${workerInfo.restartCount} times`);
        }
      }
    }
  }

  // Log cluster statistics
  logClusterStats() {
    const activeWorkers = this.workers.size;
    const totalMemory = Array.from(this.workers.values())
      .reduce((sum, worker) => sum + worker.memory, 0);
    
    console.log(`📊 Cluster Stats:`, {
      activeWorkers,
      totalWorkers: this.workerStats.created,
      restartedWorkers: this.workerStats.restarted,
      diedWorkers: this.workerStats.died,
      totalRequests: this.workerStats.totalRequests,
      totalMemoryMB: Math.round(totalMemory),
      averageMemoryMB: Math.round(totalMemory / activeWorkers)
    });
  }

  // Setup graceful shutdown
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      console.log(`🛑 Received ${signal}, starting graceful shutdown`);
      this.shutdownInProgress = true;

      // Stop accepting new connections
      for (const [workerId, workerInfo] of this.workers.entries()) {
        console.log(`📴 Disconnecting worker ${workerId}`);
        workerInfo.worker.disconnect();
      }

      // Wait for workers to finish current requests
      const shutdownTimeout = setTimeout(() => {
        console.log(`⏰ Shutdown timeout, force killing workers`);
        for (const [workerId, workerInfo] of this.workers.entries()) {
          if (!workerInfo.worker.isDead()) {
            workerInfo.worker.kill('SIGKILL');
          }
        }
        process.exit(1);
      }, GRACEFUL_SHUTDOWN_TIMEOUT);

      // Wait for all workers to exit
      let remainingWorkers = this.workers.size;
      const checkWorkers = () => {
        remainingWorkers = Array.from(this.workers.values())
          .filter(info => !info.worker.isDead()).length;
        
        if (remainingWorkers === 0) {
          clearTimeout(shutdownTimeout);
          console.log(`✅ All workers shutdown gracefully`);
          process.exit(0);
        } else {
          console.log(`⏳ Waiting for ${remainingWorkers} workers to finish`);
          setTimeout(checkWorkers, 1000);
        }
      };

      checkWorkers();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  // Start worker process
  startWorker() {
    console.log(`👷 Worker ${process.pid} starting`);
    
    // Load the main application
    require('./index.js');
    
    // Setup worker monitoring
    this.setupWorkerMonitoring();
    
    // Setup worker message handling
    process.on('message', (msg) => {
      this.handleMasterMessage(msg);
    });
  }

  // Setup worker monitoring
  setupWorkerMonitoring() {
    let requestCount = 0;
    let lastRequestCount = 0;
    
    // Monitor worker metrics
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memoryMB = Math.round(memUsage.rss / 1024 / 1024);
      const cpuUsage = process.cpuUsage();
      const newRequests = requestCount - lastRequestCount;
      
      // Send stats to master
      process.send({
        type: 'stats',
        requests: requestCount,
        memory: memoryMB,
        cpu: cpuUsage,
        newRequests: newRequests
      });
      
      lastRequestCount = requestCount;
      
      // Check memory threshold
      if (memoryMB > MAX_MEMORY_THRESHOLD) {
        process.send({
          type: 'memory_high',
          memory: memoryMB
        });
      }
    }, 10000); // Every 10 seconds

    // Track requests (this would be integrated with Express middleware)
    global.trackRequest = () => {
      requestCount++;
    };
  }

  // Handle messages from master
  handleMasterMessage(message) {
    switch (message.type) {
      case 'stats_request':
        // Stats are sent automatically in monitoring loop
        break;
        
      case 'shutdown':
        console.log(`🛑 Worker ${process.pid} received shutdown signal`);
        process.exit(0);
        break;
    }
  }

  // Get cluster status
  getStatus() {
    return {
      isMaster: cluster.isMaster,
      workerId: cluster.worker?.id,
      processId: process.pid,
      workers: cluster.isMaster ? this.workers.size : null,
      stats: cluster.isMaster ? this.workerStats : null
    };
  }
}

// Export cluster manager
module.exports = { ClusterManager };

// Auto-start if this file is run directly
if (require.main === module) {
  const clusterManager = new ClusterManager();
  clusterManager.start();
}