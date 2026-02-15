import WebSocket from 'ws';
import http from 'http';
import { PerformanceEvent, MonitorConfig } from '../types';

/**
 * WebSocket server for real-time performance data streaming
 */
export class WebSocketServer {
  private wss: WebSocket.Server | null = null;
  private config: MonitorConfig;
  private clients: Set<WebSocket> = new Set();
  private server: http.Server | null = null;

  constructor(config: MonitorConfig) {
    this.config = config;
  }

  /**
   * Start WebSocket server
   */
  start(server: http.Server): void {
    if (!this.config.enabled || this.wss) return;

    this.server = server;
    this.wss = new WebSocket.Server({
      server,
      path: this.config.webSocketPath || '/n8n-performance-ws'
    });

    this.setupEventHandlers();
    console.log(`n8n workflow monitor WebSocket server started on path ${this.config.webSocketPath || '/n8n-performance-ws'}`);
  }

  /**
   * Stop WebSocket server
   */
  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws) => {
      // Add client to set
      this.clients.add(ws);
      console.log(`New WebSocket client connected. Total clients: ${this.clients.size}`);

      // Send welcome message
      this.sendToClient(ws, {
        type: 'welcome',
        timestamp: Date.now(),
        message: 'Connected to n8n workflow performance monitor'
      });

      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Handle client close
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`WebSocket client disconnected. Total clients: ${this.clients.size}`);
      });

      // Handle client error
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle client messages
   */
  private handleClientMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          timestamp: Date.now()
        });
        break;
      case 'subscribe':
        this.handleSubscription(ws, data);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(ws, data);
        break;
      case 'getConfig':
        this.sendToClient(ws, {
          type: 'config',
          timestamp: Date.now(),
          data: this.config
        });
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscription(ws: WebSocket, data: any): void {
    // Store subscription information for filtering events
    // For now, we'll just accept all subscriptions
    this.sendToClient(ws, {
      type: 'subscribed',
      timestamp: Date.now(),
      channels: data.channels || ['all']
    });
  }

  /**
   * Handle unsubscription requests
   */
  private handleUnsubscription(ws: WebSocket, data: any): void {
    // Remove subscription information
    this.sendToClient(ws, {
      type: 'unsubscribed',
      timestamp: Date.now(),
      channels: data.channels || ['all']
    });
  }

  /**
   * Send event to all connected clients
   */
  broadcastEvent(event: PerformanceEvent): void {
    if (!this.config.enabled || !this.wss) return;

    // Apply sampling to reduce network traffic
    if (!this.shouldBroadcast(event)) return;

    const message = JSON.stringify(event);

    // Broadcast to all clients
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message, (error) => {
          if (error) {
            console.error('Error sending WebSocket message:', error);
            this.clients.delete(client);
          }
        });
      } else {
        this.clients.delete(client);
      }
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message), (error) => {
        if (error) {
          console.error('Error sending WebSocket message:', error);
          this.clients.delete(ws);
        }
      });
    }
  }

  /**
   * Check if event should be broadcasted based on sampling
   */
  private shouldBroadcast(event: PerformanceEvent): boolean {
    // Always broadcast important events
    if (event.type === 'bottleneck' || event.type === 'error') {
      return true;
    }

    // Apply sampling for other event types
    const samplingRate = this.config.samplingConfig?.rate || 0.8;
    return Math.random() <= samplingRate;
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Update configuration
   */
  updateConfig(config: MonitorConfig): void {
    this.config = config;
  }
}
