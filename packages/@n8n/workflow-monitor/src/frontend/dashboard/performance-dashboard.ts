/**
 * Performance dashboard component
 */
import { WebSocketClient } from '../websocket-client';
import { PerformanceCharts } from '../visualization/performance-charts';

/**
 * Performance dashboard class
 */
export class PerformanceDashboard {
  private wsClient: WebSocketClient;
  private charts: PerformanceCharts;
  private container: HTMLElement;
  private isConnected = false;
  private bottlenecks: any[] = [];
  private currentWorkflow: string | null = null;

  /**
   * Constructor
   */
  constructor(containerId: string, wsUrl: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id ${containerId} not found`);
    }

    this.container = container;
    this.wsClient = new WebSocketClient(wsUrl);
    this.charts = new PerformanceCharts();

    this.init();
  }

  /**
   * Initialize dashboard
   */
  private init(): void {
    // Create dashboard layout
    this.createDashboardLayout();

    // Initialize charts
    this.charts.init('charts-container');

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers();

    // Connect to WebSocket server
    this.connect();
  }

  /**
   * Create dashboard layout
   */
  private createDashboardLayout(): void {
    // Clear container
    this.container.innerHTML = '';

    // Create header
    const header = document.createElement('div');
    header.className = 'dashboard-header';
    header.style.backgroundColor = '#f5f5f5';
    header.style.padding = '10px 20px';
    header.style.borderBottom = '1px solid #ddd';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const title = document.createElement('h2');
    title.textContent = 'n8n Workflow Performance Monitor';
    title.style.margin = '0';

    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'connection-status';
    statusIndicator.className = 'status-indicator';
    statusIndicator.style.display = 'flex';
    statusIndicator.style.alignItems = 'center';

    const statusDot = document.createElement('div');
    statusDot.className = 'status-dot';
    statusDot.style.width = '10px';
    statusDot.style.height = '10px';
    statusDot.style.borderRadius = '50%';
    statusDot.style.backgroundColor = '#999';
    statusDot.style.marginRight = '8px';

    const statusText = document.createElement('span');
    statusText.textContent = 'Disconnected';

    statusIndicator.appendChild(statusDot);
    statusIndicator.appendChild(statusText);
    header.appendChild(title);
    header.appendChild(statusIndicator);

    // Create main content
    const mainContent = document.createElement('div');
    mainContent.className = 'dashboard-content';
    mainContent.style.padding = '20px';

    // Create workflow info section
    const workflowInfo = document.createElement('div');
    workflowInfo.id = 'workflow-info';
    workflowInfo.className = 'workflow-info';
    workflowInfo.style.backgroundColor = '#f9f9f9';
    workflowInfo.style.padding = '15px';
    workflowInfo.style.borderRadius = '4px';
    workflowInfo.style.marginBottom = '20px';

    const workflowTitle = document.createElement('h3');
    workflowTitle.textContent = 'Current Workflow';
    workflowTitle.style.marginTop = '0';

    const workflowDetails = document.createElement('div');
    workflowDetails.id = 'workflow-details';
    workflowDetails.textContent = 'No workflow running';

    workflowInfo.appendChild(workflowTitle);
    workflowInfo.appendChild(workflowDetails);

    // Create charts container
    const chartsContainer = document.createElement('div');
    chartsContainer.id = 'charts-container';
    chartsContainer.className = 'charts-container';

    // Create bottlenecks section
    const bottlenecksSection = document.createElement('div');
    bottlenecksSection.id = 'bottlenecks-section';
    bottlenecksSection.className = 'bottlenecks-section';
    bottlenecksSection.style.backgroundColor = '#f9f9f9';
    bottlenecksSection.style.padding = '15px';
    bottlenecksSection.style.borderRadius = '4px';
    bottlenecksSection.style.marginTop = '20px';

    const bottlenecksTitle = document.createElement('h3');
    bottlenecksTitle.textContent = 'Performance Bottlenecks';
    bottlenecksTitle.style.marginTop = '0';

    const bottlenecksList = document.createElement('div');
    bottlenecksList.id = 'bottlenecks-list';
    bottlenecksList.textContent = 'No bottlenecks detected';

    bottlenecksSection.appendChild(bottlenecksTitle);
    bottlenecksSection.appendChild(bottlenecksList);

    mainContent.appendChild(workflowInfo);
    mainContent.appendChild(chartsContainer);
    mainContent.appendChild(bottlenecksSection);

    // Create footer
    const footer = document.createElement('div');
    footer.className = 'dashboard-footer';
    footer.style.backgroundColor = '#f5f5f5';
    footer.style.padding = '10px 20px';
    footer.style.borderTop = '1px solid #ddd';
    footer.style.textAlign = 'center';

    const footerText = document.createElement('p');
    footerText.textContent = 'n8n Workflow Performance Monitor v1.0';
    footerText.style.margin = '0';

    footer.appendChild(footerText);

    // Assemble dashboard
    this.container.appendChild(header);
    this.container.appendChild(mainContent);
    this.container.appendChild(footer);
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    // Connection status
    this.wsClient.on('welcome', () => {
      this.updateConnectionStatus(true);
      this.isConnected = true;
    });

    // Workflow start event
    this.wsClient.on('workflowStart', (event) => {
      this.currentWorkflow = event.data.workflowName;
      this.updateWorkflowInfo(event.data);
      this.bottlenecks = [];
      this.updateBottlenecksList();
    });

    // Workflow end event
    this.wsClient.on('workflowEnd', (event) => {
      this.updateWorkflowInfo(event.data);
      this.charts.updateBottleneckHeatmap(this.bottlenecks);
    });

    // Node start event
    this.wsClient.on('nodeStart', (event) => {
      // Handle node start if needed
    });

    // Node end event
    this.wsClient.on('nodeEnd', (event) => {
      const nodeMetrics = event.data;

      // Update charts with node metrics
      if (nodeMetrics.duration) {
        this.charts.updateExecutionTimeChart(nodeMetrics.nodeName, nodeMetrics.duration);
      }

      if (nodeMetrics.memoryUsage) {
        this.charts.updateMemoryUsageChart(
          nodeMetrics.memoryUsage.before,
          nodeMetrics.memoryUsage.after,
          nodeMetrics.memoryUsage.peak
        );
      }

      if (nodeMetrics.cpuUsage) {
        this.charts.updateCpuUsageChart(nodeMetrics.cpuUsage);
      }
    });

    // Bottleneck event
    this.wsClient.on('bottleneck', (event) => {
      const bottleneck = event.data;
      this.bottlenecks.push(bottleneck);
      this.updateBottlenecksList();
      this.charts.updateBottleneckHeatmap(this.bottlenecks);
      this.showBottleneckAlert(bottleneck);
    });

    // Error event
    this.wsClient.on('error', (event) => {
      this.showErrorAlert(event.data);
    });

    // Metrics event
    this.wsClient.on('metrics', (event) => {
      // Handle periodic metrics updates if needed
    });
  }

  /**
   * Connect to WebSocket server
   */
  private async connect(): Promise<void> {
    try {
      await this.wsClient.connect();
      this.updateConnectionStatus(true);
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      this.updateConnectionStatus(false);
      this.isConnected = false;

      // Attempt to reconnect every 5 seconds
      setTimeout(() => this.connect(), 5000);
    }
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(connected: boolean): void {
    const statusIndicator = document.getElementById('connection-status');
    if (!statusIndicator) return;

    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('span');

    if (statusDot && statusText) {
      if (connected) {
        statusDot.style.backgroundColor = '#4CAF50';
        statusText.textContent = 'Connected';
      } else {
        statusDot.style.backgroundColor = '#f44336';
        statusText.textContent = 'Disconnected';
      }
    }
  }

  /**
   * Update workflow info
   */
  private updateWorkflowInfo(workflowData: any): void {
    const workflowDetails = document.getElementById('workflow-details');
    if (!workflowDetails) return;

    const html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
        <div>
          <strong>Name:</strong> ${workflowData.workflowName}
        </div>
        <div>
          <strong>ID:</strong> ${workflowData.workflowId}
        </div>
        <div>
          <strong>Execution ID:</strong> ${workflowData.executionId}
        </div>
        ${workflowData.status ? `<div><strong>Status:</strong> ${workflowData.status}</div>` : ''}
        ${workflowData.totalDuration ? `<div><strong>Duration:</strong> ${workflowData.totalDuration}ms</div>` : ''}
      </div>
    `;

    workflowDetails.innerHTML = html;
  }

  /**
   * Update bottlenecks list
   */
  private updateBottlenecksList(): void {
    const bottlenecksList = document.getElementById('bottlenecks-list');
    if (!bottlenecksList) return;

    if (this.bottlenecks.length === 0) {
      bottlenecksList.textContent = 'No bottlenecks detected';
      return;
    }

    // Sort bottlenecks by severity (high > medium > low)
    const sortedBottlenecks = [...this.bottlenecks].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    const html = sortedBottlenecks.map(bottleneck => {
      let severityClass = 'low';
      if (bottleneck.severity === 'medium') severityClass = 'medium';
      if (bottleneck.severity === 'high') severityClass = 'high';

      return `
        <div class="bottleneck-item ${severityClass}"
             style="padding: 10px; margin-bottom: 8px; border-radius: 4px;
                    background-color: ${bottleneck.severity === 'high' ? '#ffebee' : bottleneck.severity === 'medium' ? '#fff8e1' : '#e8f5e8'};
                    border-left: 4px solid ${bottleneck.severity === 'high' ? '#f44336' : bottleneck.severity === 'medium' ? '#ff9800' : '#4caf50'};">
          <div><strong>Node:</strong> ${bottleneck.nodeName}</div>
          <div><strong>Type:</strong> ${bottleneck.type}</div>
          <div><strong>Severity:</strong> ${bottleneck.severity}</div>
          <div><strong>Description:</strong> ${bottleneck.description}</div>
          <div><strong>Time:</strong> ${new Date(bottleneck.timestamp).toLocaleTimeString()}</div>
        </div>
      `;
    }).join('');

    bottlenecksList.innerHTML = html;
  }

  /**
   * Show bottleneck alert
   */
  private showBottleneckAlert(bottleneck: any): void {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = 'bottleneck-alert';
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.padding = '15px';
    alert.style.borderRadius = '4px';
    alert.style.zIndex = '1000';
    alert.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    alert.style.backgroundColor = bottleneck.severity === 'high' ? '#ffebee' : bottleneck.severity === 'medium' ? '#fff8e1' : '#e8f5e8';
    alert.style.borderLeft = `4px solid ${bottleneck.severity === 'high' ? '#f44336' : bottleneck.severity === 'medium' ? '#ff9800' : '#4caf50'}`;
    alert.style.minWidth = '300px';

    const alertContent = `
      <h4 style="margin-top: 0; color: ${bottleneck.severity === 'high' ? '#c62828' : bottleneck.severity === 'medium' ? '#ef6c00' : '#2e7d32'}">
        ${bottleneck.severity === 'high' ? 'High Severity' : bottleneck.severity === 'medium' ? 'Medium Severity' : 'Low Severity'} Bottleneck Detected
      </h4>
      <p><strong>Node:</strong> ${bottleneck.nodeName}</p>
      <p><strong>Issue:</strong> ${bottleneck.description}</p>
      <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
        Close
      </button>
    `;

    alert.innerHTML = alertContent;

    // Add to document
    document.body.appendChild(alert);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    }, 5000);

    // Play alert sound if high severity
    if (bottleneck.severity === 'high') {
      this.playAlertSound();
    }
  }

  /**
   * Show error alert
   */
  private showErrorAlert(errorData: any): void {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = 'error-alert';
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.padding = '15px';
    alert.style.borderRadius = '4px';
    alert.style.zIndex = '1000';
    alert.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    alert.style.backgroundColor = '#ffebee';
    alert.style.borderLeft = '4px solid #f44336';
    alert.style.minWidth = '300px';

    const alertContent = `
      <h4 style="margin-top: 0; color: #c62828">Error Detected</h4>
      <p><strong>Node:</strong> ${errorData.nodeName}</p>
      <p><strong>Error:</strong> ${errorData.error.message}</p>
      <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
        Close
      </button>
    `;

    alert.innerHTML = alertContent;

    // Add to document
    document.body.appendChild(alert);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    }, 5000);

    // Play error sound
    this.playErrorSound();
  }

  /**
   * Play alert sound
   */
  private playAlertSound(): void {
    // Create audio element for alert sound
    const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAD/');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore autoplay policy errors
    });
  }

  /**
   * Play error sound
   */
  private playErrorSound(): void {
    // Create audio element for error sound
    const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAD/');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore autoplay policy errors
    });
  }

  /**
   * Disconnect and clean up
   */
  destroy(): void {
    this.wsClient.disconnect();
    this.charts.reset();
  }

  /**
   * Get WebSocket client
   */
  getWebSocketClient(): WebSocketClient {
    return this.wsClient;
  }

  /**
   * Get charts instance
   */
  getCharts(): PerformanceCharts {
    return this.charts;
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
