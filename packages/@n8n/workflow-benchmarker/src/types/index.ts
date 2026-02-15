/**
 * Workflow performance benchmarking types
 */
import type { Workflow, INodeExecutionData } from 'n8n-workflow';
import type { WorkflowPerformanceMetrics, NodePerformanceMetrics } from '@n8n/workflow-monitor';

/**
 * Benchmark test configuration
 */
export interface BenchmarkConfig {
  /** Test name */
  name: string;
  /** Test description */
  description?: string;
  /** Workflow to test */
  workflow: Workflow;
  /** Number of iterations to run */
  iterations: number;
  /** Concurrency level */
  concurrency: number;
  /** Test data to use */
  testData?: {
    [nodeName: string]: INodeExecutionData[];
  };
  /** Environment variables for testing */
  envVars?: Record<string, string>;
  /** Timeout per iteration in milliseconds */
  timeout?: number;
  /** Warmup iterations (not included in results) */
  warmupIterations?: number;
  /** Metrics to collect */
  metrics: {
    executionTime: boolean;
    memoryUsage: boolean;
    cpuUsage: boolean;
    dataSize: boolean;
    networkIO: boolean;
  };
  /** Output formats */
  outputFormats: ('json' | 'csv' | 'pdf')[];
  /** Output directory */
  outputDir?: string;
  /** Enable detailed logging */
  verbose?: boolean;
}

/**
 * Benchmark iteration result
 */
export interface BenchmarkIterationResult {
  /** Iteration number */
  iteration: number;
  /** Execution ID */
  executionId: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** Success status */
  success: boolean;
  /** Error information */
  error?: {
    message: string;
    stack?: string;
  };
  /** Memory usage in MB */
  memoryUsage?: {
    before: number;
    after: number;
    peak: number;
  };
  /** CPU usage percentage */
  cpuUsage?: number;
  /** Node-level performance metrics */
  nodeMetrics: Map<string, NodePerformanceMetrics>;
  /** Data sizes */
  dataSizes?: {
    input: number;
    output: number;
  };
}

/**
 * Benchmark test result
 */
export interface BenchmarkResult {
  /** Test name */
  name: string;
  /** Test description */
  description?: string;
  /** Test configuration */
  config: BenchmarkConfig;
  /** Test start time */
  startTime: number;
  /** Test end time */
  endTime: number;
  /** Total duration in milliseconds */
  totalDuration: number;
  /** Iteration results */
  iterations: BenchmarkIterationResult[];
  /** Aggregated statistics */
  statistics: {
    executionTime: {
      mean: number;
      median: number;
      min: number;
      max: number;
      stdDev: number;
      p95: number;
      p99: number;
    };
    memoryUsage: {
      mean: number;
      median: number;
      min: number;
      max: number;
      stdDev: number;
    };
    cpuUsage: {
      mean: number;
      median: number;
      min: number;
      max: number;
      stdDev: number;
    };
    successRate: number;
    throughput: number; // iterations per second
  };
  /** Node-level statistics */
  nodeStatistics: {
    [nodeName: string]: {
      executionTime: {
        mean: number;
        median: number;
        min: number;
        max: number;
        stdDev: number;
      };
      memoryUsage?: {
        mean: number;
        median: number;
        min: number;
        max: number;
      };
      cpuUsage?: {
        mean: number;
        median: number;
        min: number;
        max: number;
      };
      successRate: number;
    };
  };
  /** Bottlenecks detected */
  bottlenecks: {
    nodeName: string;
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    metrics: any;
  }[];
  /** Comparison with previous results (if available) */
  comparison?: {
    baselineResult?: BenchmarkResult;
    improvements: {
      executionTime: number; // percentage improvement
      memoryUsage: number; // percentage improvement
      cpuUsage: number; // percentage improvement
      successRate: number; // percentage improvement
    };
  };
}

/**
 * Benchmark report configuration
 */
export interface BenchmarkReportConfig {
  /** Report title */
  title: string;
  /** Report description */
  description?: string;
  /** Include detailed iteration results */
  includeDetails: boolean;
  /** Include charts */
  includeCharts: boolean;
  /** Chart types to include */
  chartTypes: ('executionTime' | 'memoryUsage' | 'cpuUsage' | 'throughput')[];
  /** Include node-level details */
  includeNodeDetails: boolean;
  /** Include bottleneck analysis */
  includeBottleneckAnalysis: boolean;
  /** Include comparison with baseline */
  includeComparison: boolean;
}

/**
 * Benchmark comparison result
 */
export interface BenchmarkComparisonResult {
  /** Test results to compare */
  results: BenchmarkResult[];
  /** Comparison metrics */
  metrics: {
    [metric: string]: {
      [resultName: string]: number;
    };
  };
  /** Best performer for each metric */
  bestPerformers: {
    [metric: string]: string;
  };
  /** Overall best performer */
  overallBestPerformer?: string;
}

/**
 * Default benchmark configuration
 */
export const defaultBenchmarkConfig: Partial<BenchmarkConfig> = {
  iterations: 10,
  concurrency: 1,
  warmupIterations: 2,
  timeout: 30000,
  metrics: {
    executionTime: true,
    memoryUsage: true,
    cpuUsage: true,
    dataSize: true,
    networkIO: false
  },
  outputFormats: ['json'],
  verbose: false
};

/**
 * Default report configuration
 */
export const defaultReportConfig: BenchmarkReportConfig = {
  title: 'Workflow Performance Benchmark Report',
  includeDetails: true,
  includeCharts: true,
  chartTypes: ['executionTime', 'memoryUsage', 'cpuUsage'],
  includeNodeDetails: true,
  includeBottleneckAnalysis: true,
  includeComparison: true
};
