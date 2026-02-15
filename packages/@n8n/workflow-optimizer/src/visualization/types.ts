import { OptimizationSuggestion, Bottleneck, WorkflowMetrics } from '../types';

/**
 * Visualization data for workflow optimization
 */
export interface OptimizationVisualizationData {
  /** Workflow metrics */
  metrics: WorkflowMetrics;
  /** Detected bottlenecks */
  bottlenecks: Bottleneck[];
  /** Optimization suggestions */
  suggestions: OptimizationSuggestion[];
  /** Visualization nodes for workflow graph */
  nodes: VisualizationNode[];
  /** Visualization edges for workflow graph */
  edges: VisualizationEdge[];
  /** Summary statistics */
  summary: OptimizationSummary;
}

/**
 * Node data for visualization
 */
export interface VisualizationNode {
  /** Node ID */
  id: string;
  /** Node name */
  name: string;
  /** Node type */
  type: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Error count */
  errorCount: number;
  /** Success count */
  successCount: number;
  /** Is this node a bottleneck */
  isBottleneck: boolean;
  /** Bottleneck severity if applicable */
  bottleneckSeverity?: 'low' | 'medium' | 'high';
  /** Number of suggestions for this node */
  suggestionCount: number;
  /** Position data (optional) */
  position?: {
    x: number;
    y: number;
  };
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Edge data for visualization
 */
export interface VisualizationEdge {
  /** Edge ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Data size transferred through this edge */
  dataSize?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Optimization summary data
 */
export interface OptimizationSummary {
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Number of nodes in workflow */
  nodeCount: number;
  /** Number of bottlenecks detected */
  bottleneckCount: number;
  /** Number of optimization suggestions */
  suggestionCount: number;
  /** Estimated performance improvement percentage */
  estimatedImprovement: number;
  /** Most severe bottleneck */
  mostSevereBottleneck?: Bottleneck;
  /** Top suggestions by estimated improvement */
  topSuggestions: OptimizationSuggestion[];
  /** Bottleneck distribution by severity */
  bottleneckDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  /** Suggestion distribution by type */
  suggestionDistribution: Record<string, number>;
}

/**
 * Timeline data for workflow execution
 */
export interface ExecutionTimeline {
  /** Timeline events */
  events: TimelineEvent[];
  /** Total duration in milliseconds */
  duration: number;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
}

/**
 * Timeline event data
 */
export interface TimelineEvent {
  /** Event ID */
  id: string;
  /** Node name */
  nodeName: string;
  /** Event type */
  type: 'start' | 'end' | 'error';
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Duration in milliseconds (for end events) */
  duration?: number;
  /** Error message (for error events) */
  error?: string;
}

/**
 * Visualization configuration options
 */
export interface VisualizationOptions {
  /** Whether to include execution details */
  includeExecutionDetails: boolean;
  /** Whether to include timeline data */
  includeTimeline: boolean;
  /** Maximum number of suggestions to include */
  maxSuggestions: number;
  /** Whether to include node positions */
  includeNodePositions: boolean;
  /** Color scheme for visualization */
  colorScheme: 'light' | 'dark';
}

/**
 * Default visualization options
 */
export const defaultVisualizationOptions: VisualizationOptions = {
  includeExecutionDetails: true,
  includeTimeline: false,
  maxSuggestions: 20,
  includeNodePositions: false,
  colorScheme: 'light'
};
