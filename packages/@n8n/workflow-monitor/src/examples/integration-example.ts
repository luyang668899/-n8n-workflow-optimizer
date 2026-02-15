import { createWorkflowMonitor } from '../index';
import http from 'http';
import express from 'express';

/**
 * Example of how to integrate the workflow monitor into n8n
 */
async function integrateWorkflowMonitor() {
  // Create Express app and HTTP server
  const app = express();
  const server = http.createServer(app);

  // Create workflow monitor instance
  const monitor = createWorkflowMonitor({
    enabled: true,
    granularity: 'medium',
    samplingRate: 0.8,
    realTimeStreaming: true,
    webSocketPath: '/n8n-performance-ws',
    metrics: {
      executionTime: true,
      memoryUsage: true,
      cpuUsage: true,
      dataSize: true,
      networkIO: false
    },
    alertThresholds: {
      executionTime: 5000, // 5 seconds
      memoryUsage: 500, // 500 MB
      cpuUsage: 80 // 80% CPU
    }
  });

  // Start the monitor and attach to HTTP server
  monitor.start(server);

  // Example: Update configuration dynamically
  setTimeout(() => {
    monitor.updateConfig({
      granularity: 'fine',
      samplingRate: 1.0
    });
    console.log('Updated monitor configuration to fine granularity');
  }, 5000);

  // Start server
  const PORT = process.env.PORT || 5678;
  server.listen(PORT, () => {
    console.log(`n8n workflow monitor example server running on port ${PORT}`);
    console.log(`WebSocket server available at ws://localhost:${PORT}/n8n-performance-ws`);
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    monitor.stop();
    server.close();
    console.log('Server and monitor stopped');
    process.exit(0);
  });
}

// Run integration example
if (require.main === module) {
  integrateWorkflowMonitor().catch(console.error);
}
