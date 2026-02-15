import pidusage from 'pidusage';
import { NodePerformanceMetrics, WorkflowPerformanceMetrics, MonitorConfig, Bottleneck, SamplingConfig } from '../types';
import type { Workflow, INodeExecutionData } from 'n8n-workflow';

/**
 * Performance data collector
 */
export class PerformanceCollector {
  private config: MonitorConfig;
  private samplingConfig: SamplingConfig;
  private workflowMetrics: Map<string, WorkflowPerformanceMetrics>;
  private memoryUsageHistory: Map<string, number[]>;
  private cpuUsageHistory: Map<string, number[]>;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.samplingConfig = this.calculateSamplingConfig(config.granularity);
    this.workflowMetrics = new Map();
    this.memoryUsageHistory = new Map();
    this.cpuUsageHistory = new Map();
  }

  /**
   * Calculate sampling configuration based on granularity
   */
  private calculateSamplingConfig(granularity: 'fine' | 'medium' | 'coarse'): SamplingConfig {
    switch (granularity) {
      case 'fine':
        return { rate: 1.0, interval: 10, maxSamples: 100 };
      case 'medium':
        return { rate: 0.8, interval: 50, maxSamples: 50 };
      case 'coarse':
        return { rate: 0.5, interval: 200, maxSamples: 20 };
    }
  }

  /**
   * Start collecting workflow performance data
   */
  startWorkflowMonitoring(
    workflowId: string,
    workflowName: string,
    executionId: string
  ): WorkflowPerformanceMetrics {
    const metrics: WorkflowPerformanceMetrics = {
      workflowId,
      workflowName,
      executionId,
      startTime: Date.now(),
      nodeMetrics: new Map(),
      status: 'running',
      bottlenecks: []
    };

    // Collect initial memory usage
    if (this.config.metrics.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      metrics.memoryUsage = {
        start: memoryUsage.heapUsed / (1024 * 1024),
        end: 0,
        peak: memoryUsage.heapUsed / (1024 * 1024)
      };
    }

    this.workflowMetrics.set(executionId, metrics);
    this.memoryUsageHistory.set(executionId, []);
    this.cpuUsageHistory.set(executionId, []);

    return metrics;
  }

  /**
   * Start collecting node performance data
   */
  startNodeMonitoring(
    executionId: string,
    nodeName: string,
    nodeType: string
  ): NodePerformanceMetrics {
    const metrics: NodePerformanceMetrics = {
      nodeName,
      nodeType,
      startTime: Date.now(),
      status: 'running'
    };

    // Collect initial memory usage
    if (this.config.metrics.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      metrics.memoryUsage = {
        before: memoryUsage.heapUsed / (1024 * 1024),
        after: 0,
        peak: memoryUsage.heapUsed / (1024 * 1024)
      };
    }

    const workflowMetrics = this.workflowMetrics.get(executionId);
    if (workflowMetrics) {
      workflowMetrics.nodeMetrics.set(nodeName, metrics);
    }

    return metrics;
  }

  /**
   * End collecting node performance data
   */
  async endNodeMonitoring(
    executionId: string,
    nodeName: string,
    inputData?: INodeExecutionData[],
    outputData?: INodeExecutionData[],
    error?: Error
  ): Promise<NodePerformanceMetrics | undefined> {
    const workflowMetrics = this.workflowMetrics.get(executionId);
    if (!workflowMetrics) return undefined;

    const nodeMetrics = workflowMetrics.nodeMetrics.get(nodeName);
    if (!nodeMetrics) return undefined;

    nodeMetrics.endTime = Date.now();
    nodeMetrics.duration = nodeMetrics.endTime - nodeMetrics.startTime;

    // Collect memory usage after execution
    if (this.config.metrics.memoryUsage && nodeMetrics.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      nodeMetrics.memoryUsage.after = memoryUsage.heapUsed / (1024 * 1024);
      nodeMetrics.memoryUsage.peak = Math.max(
        nodeMetrics.memoryUsage.peak,
        memoryUsage.heapUsed / (1024 * 1024)
      );

      // Update workflow peak memory usage
      if (workflowMetrics.memoryUsage) {
        workflowMetrics.memoryUsage.peak = Math.max(
          workflowMetrics.memoryUsage.peak,
          memoryUsage.heapUsed / (1024 * 1024)
        );
      }
    }

    // Collect CPU usage
    if (this.config.metrics.cpuUsage) {
      try {
        const stats = await pidusage(process.pid);
        nodeMetrics.cpuUsage = stats.cpu;
      } catch (error) {
        // Ignore errors when collecting CPU usage
      }
    }

    // Collect data sizes
    if (this.config.metrics.dataSize) {
      if (inputData) {
        nodeMetrics.inputDataSize = this.calculateDataSize(inputData);
      }
      if (outputData) {
        nodeMetrics.outputDataSize = this.calculateDataSize(outputData);
      }
    }

    // Handle error
    if (error) {
      nodeMetrics.error = {
        message: error.message,
        stack: error.stack
      };
      nodeMetrics.status = 'error';
    } else {
      nodeMetrics.status = 'completed';
    }

    // Detect bottlenecks
    const bottleneck = this.detectBottleneck(nodeMetrics);
    if (bottleneck) {
      workflowMetrics.bottlenecks.push(bottleneck);
    }

    return nodeMetrics;
  }

  /**
   * End collecting workflow performance data
   */
  async endWorkflowMonitoring(executionId: string, error?: Error): Promise<WorkflowPerformanceMetrics | undefined> {
    const workflowMetrics = this.workflowMetrics.get(executionId);
    if (!workflowMetrics) return undefined;

    workflowMetrics.endTime = Date.now();
    workflowMetrics.totalDuration = workflowMetrics.endTime - workflowMetrics.startTime;

    // Collect final memory usage
    if (this.config.metrics.memoryUsage && workflowMetrics.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      workflowMetrics.memoryUsage.end = memoryUsage.heapUsed / (1024 * 1024);
      workflowMetrics.memoryUsage.peak = Math.max(
        workflowMetrics.memoryUsage.peak,
        memoryUsage.heapUsed / (1024 * 1024)
      );
    }

    // Collect final CPU usage
    if (this.config.metrics.cpuUsage) {
      try {
        const stats = await pidusage(process.pid);
        workflowMetrics.cpuUsage = stats.cpu;
      } catch (error) {
        // Ignore errors when collecting CPU usage
      }
    }

    // Update status
    if (error) {
      workflowMetrics.status = 'error';
    } else {
      workflowMetrics.status = 'completed';
    }

    // Clean up
    this.memoryUsageHistory.delete(executionId);
    this.cpuUsageHistory.delete(executionId);

    return workflowMetrics;
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottleneck(nodeMetrics: NodePerformanceMetrics): Bottleneck | undefined {
    if (!nodeMetrics.duration) return undefined;

    // Check execution time
    if (this.config.metrics.executionTime && nodeMetrics.duration > this.config.alertThresholds.executionTime) {
      return {
        id: `bottleneck-${Date.now()}-${nodeMetrics.nodeName}`,
        nodeName: nodeMetrics.nodeName,
        type: 'executionTime',
        severity: this.calculateSeverity(nodeMetrics.duration, this.config.alertThresholds.executionTime),
        description: `Node ${nodeMetrics.nodeName} execution time (${nodeMetrics.duration}ms) exceeds threshold (${this.config.alertThresholds.executionTime}ms)`,
        metrics: {
          executionTime: nodeMetrics.duration,
          threshold: this.config.alertThresholds.executionTime
        },
        timestamp: Date.now()
      };
    }

    // Check memory usage
    if (this.config.metrics.memoryUsage && nodeMetrics.memoryUsage) {
      const memoryIncrease = nodeMetrics.memoryUsage.after - nodeMetrics.memoryUsage.before;
      if (memoryIncrease > this.config.alertThresholds.memoryUsage) {
        return {
          id: `bottleneck-${Date.now()}-${nodeMetrics.nodeName}`,
          nodeName: nodeMetrics.nodeName,
          type: 'memory',
          severity: this.calculateSeverity(memoryIncrease, this.config.alertThresholds.memoryUsage),
          description: `Node ${nodeMetrics.nodeName} memory increase (${memoryIncrease.toFixed(2)}MB) exceeds threshold (${this.config.alertThresholds.memoryUsage}MB)`,
          metrics: {
            memoryIncrease,
            threshold: this.config.alertThresholds.memoryUsage
          },
          timestamp: Date.now()
        };
      }
    }

    // Check CPU usage
    if (this.config.metrics.cpuUsage && nodeMetrics.cpuUsage) {
      if (nodeMetrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
        return {
          id: `bottleneck-${Date.now()}-${nodeMetrics.nodeName}`,
          nodeName: nodeMetrics.nodeName,
          type: 'cpu',
          severity: this.calculateSeverity(nodeMetrics.cpuUsage, this.config.alertThresholds.cpuUsage),
          description: `Node ${nodeMetrics.nodeName} CPU usage (${nodeMetrics.cpuUsage.toFixed(2)}%) exceeds threshold (${this.config.alertThresholds.cpuUsage}%)`,
          metrics: {
            cpuUsage: nodeMetrics.cpuUsage,
            threshold: this.config.alertThresholds.cpuUsage
          },
          timestamp: Date.now()
        };
      }
    }

    return undefined;
  }

  /**
   * Calculate bottleneck severity
   */
  private calculateSeverity(value: number, threshold: number): 'low' | 'medium' | 'high' {
    const ratio = value / threshold;
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  /**
   * Calculate data size
   */
  private calculateDataSize(data: INodeExecutionData[]): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get workflow performance metrics
   */
  getWorkflowMetrics(executionId: string): WorkflowPerformanceMetrics | undefined {
    return this.workflowMetrics.get(executionId);
  }

  /**
   * Get all workflow performance metrics
   */
  getAllWorkflowMetrics(): Map<string, WorkflowPerformanceMetrics> {
    return this.workflowMetrics;
  }

  /**
   * Clean up metrics for completed executions
   */
  cleanupMetrics(executionId: string): void {
    this.workflowMetrics.delete(executionId);
    this.memoryUsageHistory.delete(executionId);
    this.cpuUsageHistory.delete(executionId);
  }

  /**
   * Update sampling configuration
   */
  updateSamplingConfig(granularity: 'fine' | 'medium' | 'coarse'): void {
    this.samplingConfig = this.calculateSamplingConfig(granularity);
  }

  /**
   * Check if sampling should be performed
   */
  shouldSample(): boolean {
    return Math.random() <= this.samplingConfig.rate;
  }
}
