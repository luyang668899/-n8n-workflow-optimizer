import { PerformanceCollector } from './collectors/performance-collector';
import { ExecutionHooks } from './hooks/execution-hooks';
import { WebSocketServer } from './server/websocket-server';
import { MonitorConfig, defaultMonitorConfig } from './types';
import http from 'http';

/**
 * Main workflow monitor class
 */
export class WorkflowMonitor {
  private collector: PerformanceCollector;
  private hooks: ExecutionHooks;
  private wsServer: WebSocketServer;
  private config: MonitorConfig;

  constructor(config: Partial<MonitorConfig> = {}) {
    // Merge user config with defaults
    this.config = {
      ...defaultMonitorConfig,
      ...config
    };

    // Initialize components
    this.collector = new PerformanceCollector(this.config);
    this.hooks = new ExecutionHooks(this.collector, this.config);
    this.wsServer = new WebSocketServer(this.config);

    // Set up event callback for WebSocket streaming
    this.hooks.setEventCallback((event) => {
      this.wsServer.broadcastEvent(event);
    });
  }

  /**
   * Start the workflow monitor
   */
  start(server?: http.Server): void {
    if (!this.config.enabled) return;

    // Install execution hooks
    this.hooks.installHooks();

    // Start WebSocket server if HTTP server is provided
    if (server) {
      this.wsServer.start(server);
    }

    console.log('n8n workflow monitor started');
  }

  /**
   * Stop the workflow monitor
   */
  stop(): void {
    // Uninstall execution hooks
    this.hooks.uninstallHooks();

    // Stop WebSocket server
    this.wsServer.stop();

    console.log('n8n workflow monitor stopped');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MonitorConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };

    // Update components with new config
    this.wsServer.updateConfig(this.config);
  }

  /**
   * Get performance collector
   */
  getCollector(): PerformanceCollector {
    return this.collector;
  }

  /**
   * Get execution hooks
   */
  getHooks(): ExecutionHooks {
    return this.hooks;
  }

  /**
   * Get WebSocket server
   */
  getWebSocketServer(): WebSocketServer {
    return this.wsServer;
  }

  /**
   * Get current configuration
   */
  getConfig(): MonitorConfig {
    return this.config;
  }
}

/**
 * Create a workflow monitor instance
 */
export function createWorkflowMonitor(config: Partial<MonitorConfig> = {}): WorkflowMonitor {
  return new WorkflowMonitor(config);
}

// Export types and utilities
export * from './types';
export * from './collectors/performance-collector';
export * from './hooks/execution-hooks';
export * from './server/websocket-server';
