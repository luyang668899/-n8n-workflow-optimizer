import type { Workflow, INodeExecutionData } from 'n8n-workflow';

/**
 * Performance monitoring configuration options
 */
export interface MonitorConfig {
  /** Enable/disable monitoring */
  enabled: boolean;
  /** Data collection granularity */
  granularity: 'fine' | 'medium' | 'coarse';
  /** Sampling rate (0-1) */
  samplingRate: number;
  /** Enable real-time data streaming */
  realTimeStreaming: boolean;
  /** WebSocket path */
  webSocketPath?: string;
  /** Sampling configuration */
  samplingConfig?: SamplingConfig;
  /** Performance metrics to collect */
  metrics: {
    executionTime: boolean;
    memoryUsage: boolean;
    cpuUsage: boolean;
    dataSize: boolean;
    networkIO: boolean;
  };
  /** Alert thresholds */
  alertThresholds: {
    executionTime: number; // ms
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
  };
}

/**
 * Node performance metrics
 */
export interface NodePerformanceMetrics {
  /** Node name */
  nodeName: string;
  /** Node type */
  nodeType: string;
  /** Execution start time */
  startTime: number;
  /** Execution end time */
  endTime?: number;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Memory usage in MB */
  memoryUsage?: {
    before: number;
    after: number;
    peak: number;
  };
  /** CPU usage percentage */
  cpuUsage?: number;
  /** Input data size in bytes */
  inputDataSize?: number;
  /** Output data size in bytes */
  outputDataSize?: number;
  /** Error information */
  error?: {
    message: string;
    stack?: string;
  };
  /** Status */
  status: 'pending' | 'running' | 'completed' | 'error';
}

/**
 * Workflow performance metrics
 */
export interface WorkflowPerformanceMetrics {
  /** Workflow ID */
  workflowId: string;
  /** Workflow name */
  workflowName: string;
  /** Execution ID */
  executionId: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Total duration */
  totalDuration?: number;
  /** Node performance metrics */
  nodeMetrics: Map<string, NodePerformanceMetrics>;
  /** Overall memory usage */
  memoryUsage?: {
    start: number;
    end: number;
    peak: number;
  };
  /** Overall CPU usage */
  cpuUsage?: number;
  /** Status */
  status: 'pending' | 'running' | 'completed' | 'error';
  /** Bottlenecks detected */
  bottlenecks: Bottleneck[];
}

/**
 * Performance bottleneck
 */
export interface Bottleneck {
  /** Bottleneck ID */
  id: string;
  /** Node name */
  nodeName: string;
  /** Bottleneck type */
  type: 'executionTime' | 'memory' | 'cpu' | 'dataSize' | 'network';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Description */
  description: string;
  /** Metrics data */
  metrics: any;
  /** Timestamp */
  timestamp: number;
}

/**
 * Real-time performance data event
 */
export interface PerformanceEvent {
  /** Event type */
  type: 'workflowStart' | 'workflowEnd' | 'nodeStart' | 'nodeEnd' | 'error' | 'bottleneck' | 'metrics';
  /** Event timestamp */
  timestamp: number;
  /** Workflow ID */
  workflowId: string;
  /** Execution ID */
  executionId: string;
  /** Data */
  data: any;
}

/**
 * Sampling configuration
 */
export interface SamplingConfig {
  /** Sampling rate */
  rate: number;
  /** Sampling interval in milliseconds */
  interval: number;
  /** Max samples per node */
  maxSamples: number;
}

/**
 * Default monitor configuration
 */
export const defaultMonitorConfig: MonitorConfig = {
  enabled: true,
  granularity: 'medium',
  samplingRate: 0.8,
  realTimeStreaming: true,
  metrics: {
    executionTime: true,
    memoryUsage: true,
    cpuUsage: true,
    dataSize: true,
    networkIO: false
  },
  alertThresholds: {
    executionTime: 5000,
    memoryUsage: 500,
    cpuUsage: 80
  }
};
