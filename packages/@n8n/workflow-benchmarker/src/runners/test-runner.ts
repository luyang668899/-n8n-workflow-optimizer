import { v4 as uuidv4 } from 'uuid';
import pidusage from 'pidusage';
import type { Workflow, INodeExecutionData } from 'n8n-workflow';
import type { BenchmarkConfig, BenchmarkIterationResult, BenchmarkResult } from '../types';
import { defaultBenchmarkConfig } from '../types';
import { WorkflowMonitor } from '@n8n/workflow-monitor';
import type { WorkflowPerformanceMetrics } from '@n8n/workflow-monitor';

/**
 * Test runner for workflow performance benchmarking
 */
export class TestRunner {
  private config: BenchmarkConfig;
  private workflow: Workflow;
  private monitor: WorkflowMonitor;

  /**
   * Constructor
   */
  constructor(config: BenchmarkConfig) {
    this.config = {
      ...defaultBenchmarkConfig,
      ...config
    } as BenchmarkConfig;

    this.workflow = config.workflow;

    // Initialize workflow monitor for performance data collection
    this.monitor = new WorkflowMonitor({
      enabled: true,
      granularity: 'medium',
      samplingRate: 1.0,
      realTimeStreaming: false,
      metrics: this.config.metrics
    });
  }

  /**
   * Run benchmark test
   */
  async run(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const iterationResults: BenchmarkIterationResult[] = [];

    // Set up environment variables
    this.setupEnvironment();

    // Run warmup iterations
    if (this.config.warmupIterations && this.config.warmupIterations > 0) {
      console.log(`Running ${this.config.warmupIterations} warmup iterations...`);
      for (let i = 0; i < this.config.warmupIterations; i++) {
        await this.runIteration(i + 1, true);
      }
      console.log('Warmup complete');
    }

    // Run actual iterations
    console.log(`Running ${this.config.iterations} benchmark iterations...`);
    for (let i = 0; i < this.config.iterations; i++) {
      const result = await this.runIteration(i + 1, false);
      if (result) {
        iterationResults.push(result);
      }
    }

    // Clean up environment
    this.cleanupEnvironment();

    // Generate final result
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    const result: BenchmarkResult = {
      name: this.config.name,
      description: this.config.description,
      config: this.config,
      startTime,
      endTime,
      totalDuration,
      iterations: iterationResults,
      statistics: this.calculateStatistics(iterationResults),
      nodeStatistics: this.calculateNodeStatistics(iterationResults),
      bottlenecks: this.detectBottlenecks(iterationResults)
    };

    return result;
  }

  /**
   * Run single test iteration
   */
  private async runIteration(
    iteration: number,
    isWarmup: boolean
  ): Promise<BenchmarkIterationResult | null> {
    const executionId = uuidv4();
    const startTime = Date.now();
    let memoryUsageBefore = 0;
    let memoryUsageAfter = 0;
    let memoryUsagePeak = 0;
    let cpuUsage = 0;
    let success = true;
    let error: { message: string; stack?: string } | undefined;
    let nodeMetrics = new Map<string, any>();

    try {
      // Collect initial memory usage
      if (this.config.metrics.memoryUsage) {
        const stats = await pidusage(process.pid);
        memoryUsageBefore = stats.memory / (1024 * 1024); // Convert to MB
      }

      // Execute workflow with test data
      const result = await this.executeWorkflow(executionId);
      nodeMetrics = result.nodeMetrics;

      // Collect final memory usage
      if (this.config.metrics.memoryUsage) {
        const stats = await pidusage(process.pid);
        memoryUsageAfter = stats.memory / (1024 * 1024); // Convert to MB
        memoryUsagePeak = Math.max(memoryUsageBefore, memoryUsageAfter);
      }

      // Collect CPU usage
      if (this.config.metrics.cpuUsage) {
        const stats = await pidusage(process.pid);
        cpuUsage = stats.cpu;
      }

    } catch (err) {
      success = false;
      error = {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      };
      console.error(`Iteration ${iteration} failed: ${error.message}`);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (isWarmup) {
      // Skip storing warmup results
      return null;
    }

    const iterationResult: BenchmarkIterationResult = {
      iteration,
      executionId,
      startTime,
      endTime,
      duration,
      success,
      error,
      memoryUsage: this.config.metrics.memoryUsage ? {
        before: memoryUsageBefore,
        after: memoryUsageAfter,
        peak: memoryUsagePeak
      } : undefined,
      cpuUsage: this.config.metrics.cpuUsage ? cpuUsage : undefined,
      nodeMetrics,
      dataSizes: this.config.metrics.dataSize ? {
        input: this.calculateInputDataSize(),
        output: this.calculateOutputDataSize()
      } : undefined
    };

    if (this.config.verbose) {
      console.log(`Iteration ${iteration}: ${duration}ms (${success ? 'success' : 'error'})`);
    }

    return iterationResult;
  }

  /**
   * Execute workflow with test data
   */
  private async executeWorkflow(executionId: string): Promise<{ nodeMetrics: Map<string, any> }> {
    // Start monitoring
    this.monitor.start();

    // Create workflow instance
    const workflowInstance = this.workflow;

    // Execute workflow
    let result: any;
    try {
      result = await workflowInstance.execute({
        executionId,
        testData: this.config.testData
      });
    } finally {
      // Stop monitoring
      this.monitor.stop();
    }

    // Extract node metrics
    const nodeMetrics = new Map<string, any>();
    // In a real implementation, this would come from the workflow monitor
    // For now, we'll create placeholder metrics
    workflowInstance.nodes.forEach(node => {
      nodeMetrics.set(node.name, {
        nodeName: node.name,
        duration: Math.random() * 1000 + 100, // Random duration between 100-1100ms
        status: 'completed',
        memoryUsage: {
          before: Math.random() * 100 + 100,
          after: Math.random() * 100 + 100,
          peak: Math.random() * 100 + 150
        },
        cpuUsage: Math.random() * 50 + 10
      });
    });

    return { nodeMetrics };
  }

  /**
   * Calculate input data size
   */
  private calculateInputDataSize(): number {
    if (!this.config.testData) return 0;

    try {
      return JSON.stringify(this.config.testData).length;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate output data size
   */
  private calculateOutputDataSize(): number {
    // In a real implementation, this would calculate the actual output size
    // For now, return a placeholder
    return Math.random() * 1000 + 100;
  }

  /**
   * Set up environment variables
   */
  private setupEnvironment(): void {
    if (this.config.envVars) {
      Object.entries(this.config.envVars).forEach(([key, value]) => {
        process.env[key] = value;
      });
    }
  }

  /**
   * Clean up environment
   */
  private cleanupEnvironment(): void {
    if (this.config.envVars) {
      Object.keys(this.config.envVars).forEach(key => {
        delete process.env[key];
      });
    }
  }

  /**
   * Calculate statistics from iteration results
   */
  private calculateStatistics(iterations: BenchmarkIterationResult[]): BenchmarkResult['statistics'] {
    const durations = iterations.map(i => i.duration);
    const memoryUsages = iterations
      .filter(i => i.memoryUsage)
      .map(i => i.memoryUsage!.peak);
    const cpuUsages = iterations
      .filter(i => i.cpuUsage)
      .map(i => i.cpuUsage!);
    const successCount = iterations.filter(i => i.success).length;

    return {
      executionTime: {
        mean: this.calculateMean(durations),
        median: this.calculateMedian(durations),
        min: Math.min(...durations),
        max: Math.max(...durations),
        stdDev: this.calculateStdDev(durations),
        p95: this.calculatePercentile(durations, 95),
        p99: this.calculatePercentile(durations, 99)
      },
      memoryUsage: {
        mean: this.calculateMean(memoryUsages),
        median: this.calculateMedian(memoryUsages),
        min: memoryUsages.length > 0 ? Math.min(...memoryUsages) : 0,
        max: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0,
        stdDev: this.calculateStdDev(memoryUsages)
      },
      cpuUsage: {
        mean: this.calculateMean(cpuUsages),
        median: this.calculateMedian(cpuUsages),
        min: cpuUsages.length > 0 ? Math.min(...cpuUsages) : 0,
        max: cpuUsages.length > 0 ? Math.max(...cpuUsages) : 0,
        stdDev: this.calculateStdDev(cpuUsages)
      },
      successRate: (successCount / iterations.length) * 100,
      throughput: iterations.length / (iterations.reduce((sum, i) => sum + i.duration, 0) / 1000)
    };
  }

  /**
   * Calculate node-level statistics
   */
  private calculateNodeStatistics(iterations: BenchmarkIterationResult[]): BenchmarkResult['nodeStatistics'] {
    const nodeStats: BenchmarkResult['nodeStatistics'] = {};

    // Collect node metrics across all iterations
    const nodeMetricsByNode: Map<string, number[]> = new Map();
    const nodeMemoryByNode: Map<string, number[]> = new Map();
    const nodeCpuByNode: Map<string, number[]> = new Map();
    const nodeSuccessByNode: Map<string, number> = new Map();

    iterations.forEach(iteration => {
      iteration.nodeMetrics.forEach((metrics, nodeName) => {
        // Initialize maps if needed
        if (!nodeMetricsByNode.has(nodeName)) {
          nodeMetricsByNode.set(nodeName, []);
          nodeMemoryByNode.set(nodeName, []);
          nodeCpuByNode.set(nodeName, []);
          nodeSuccessByNode.set(nodeName, 0);
        }

        // Add metrics
        nodeMetricsByNode.get(nodeName)!.push(metrics.duration || 0);
        if (metrics.memoryUsage) {
          nodeMemoryByNode.get(nodeName)!.push(metrics.memoryUsage.peak);
        }
        if (metrics.cpuUsage) {
          nodeCpuByNode.get(nodeName)!.push(metrics.cpuUsage);
        }

        // Increment success count
        if (iteration.success) {
          nodeSuccessByNode.set(nodeName, nodeSuccessByNode.get(nodeName)! + 1);
        }
      });
    });

    // Calculate statistics for each node
    nodeMetricsByNode.forEach((durations, nodeName) => {
      const memoryUsages = nodeMemoryByNode.get(nodeName) || [];
      const cpuUsages = nodeCpuByNode.get(nodeName) || [];
      const successCount = nodeSuccessByNode.get(nodeName) || 0;

      nodeStats[nodeName] = {
        executionTime: {
          mean: this.calculateMean(durations),
          median: this.calculateMedian(durations),
          min: Math.min(...durations),
          max: Math.max(...durations),
          stdDev: this.calculateStdDev(durations)
        },
        memoryUsage: memoryUsages.length > 0 ? {
          mean: this.calculateMean(memoryUsages),
          median: this.calculateMedian(memoryUsages),
          min: Math.min(...memoryUsages),
          max: Math.max(...memoryUsages)
        } : undefined,
        cpuUsage: cpuUsages.length > 0 ? {
          mean: this.calculateMean(cpuUsages),
          median: this.calculateMedian(cpuUsages),
          min: Math.min(...cpuUsages),
          max: Math.max(...cpuUsages)
        } : undefined,
        successRate: (successCount / iterations.length) * 100
      };
    });

    return nodeStats;
  }

  /**
   * Detect bottlenecks from iteration results
   */
  private detectBottlenecks(iterations: BenchmarkIterationResult[]): BenchmarkResult['bottlenecks'] {
    const bottlenecks: BenchmarkResult['bottlenecks'] = [];

    // Analyze node statistics to detect bottlenecks
    const nodeStats = this.calculateNodeStatistics(iterations);

    Object.entries(nodeStats).forEach(([nodeName, stats]) => {
      // Check execution time
      if (stats.executionTime.mean > 500) {
        bottlenecks.push({
          nodeName,
          type: 'executionTime',
          severity: stats.executionTime.mean > 1000 ? 'high' : 'medium',
          description: `Node ${nodeName} has high execution time (${stats.executionTime.mean.toFixed(2)}ms)`,
          metrics: {
            meanExecutionTime: stats.executionTime.mean,
            threshold: 500
          }
        });
      }

      // Check memory usage
      if (stats.memoryUsage && stats.memoryUsage.mean > 200) {
        bottlenecks.push({
          nodeName,
          type: 'memory',
          severity: stats.memoryUsage.mean > 300 ? 'high' : 'medium',
          description: `Node ${nodeName} has high memory usage (${stats.memoryUsage.mean.toFixed(2)}MB)`,
          metrics: {
            meanMemoryUsage: stats.memoryUsage.mean,
            threshold: 200
          }
        });
      }

      // Check CPU usage
      if (stats.cpuUsage && stats.cpuUsage.mean > 50) {
        bottlenecks.push({
          nodeName,
          type: 'cpu',
          severity: stats.cpuUsage.mean > 70 ? 'high' : 'medium',
          description: `Node ${nodeName} has high CPU usage (${stats.cpuUsage.mean.toFixed(2)}%)`,
          metrics: {
            meanCpuUsage: stats.cpuUsage.mean,
            threshold: 50
          }
        });
      }

      // Check success rate
      if (stats.successRate < 90) {
        bottlenecks.push({
          nodeName,
          type: 'reliability',
          severity: stats.successRate < 70 ? 'high' : 'medium',
          description: `Node ${nodeName} has low success rate (${stats.successRate.toFixed(2)}%)`,
          metrics: {
            successRate: stats.successRate,
            threshold: 90
          }
        });
      }
    });

    return bottlenecks;
  }

  /**
   * Calculate mean of array
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Calculate median of array
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate standard deviation of array
   */
  private calculateStdDev(values: number[]): number {
    if (values.length <= 1) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile of array
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}
