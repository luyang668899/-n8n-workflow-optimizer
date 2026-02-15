import type { Workflow, INode, IRun, ITaskData } from 'n8n-workflow';

// Workflow metrics data
export interface WorkflowMetrics {
  totalExecutionTime: number;
  nodeExecutions: Map<string, NodeExecutionMetrics>;
  connectionCount: number;
  nodeCount: number;
  averageNodeExecutionTime: number;
  longestRunningNode: string;
  bottlenecks: Bottleneck[];
}

// Node execution metrics
export interface NodeExecutionMetrics {
  nodeName: string;
  nodeType: string;
  executionTime: number;
  executionCount: number;
  errorCount: number;
  successCount: number;
  averageExecutionTime: number;
  inputDataSize: number;
  outputDataSize: number;
  isBottleneck: boolean;
}

// Bottleneck definition
export interface Bottleneck {
  nodeName: string;
  nodeType: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  executionTime: number;
  averageTime: number;
  suggestions: OptimizationSuggestion[];
}

// Optimization suggestion
export interface OptimizationSuggestion {
  id: string;
  type: OptimizationType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  estimatedImprovement: number;
  implementationEffort: 'low' | 'medium' | 'high';
  appliesTo: string[];
  details: Record<string, any>;
}

// Optimization types
export enum OptimizationType {
  PARALLEL_EXECUTION = 'parallelExecution',
  CACHING = 'caching',
  BATCH_PROCESSING = 'batchProcessing',
  NODE_REPLACEMENT = 'nodeReplacement',
  WORKFLOW_SPLITTING = 'workflowSplitting',
  EXPRESSION_OPTIMIZATION = 'expressionOptimization',
  CONNECTION_OPTIMIZATION = 'connectionOptimization',
  RESOURCE_ALLOCATION = 'resourceAllocation',
  ERROR_HANDLING = 'errorHandling',
  LOGGING_OPTIMIZATION = 'loggingOptimization'
}

// Optimization result
export interface OptimizationResult {
  workflowId: string;
  workflowName: string;
  originalMetrics: WorkflowMetrics;
  suggestedOptimizations: OptimizationSuggestion[];
  estimatedImprovement: number;
  totalSuggestions: number;
  bottlenecks: Bottleneck[];
  generatedAt: Date;
}

// Workflow graph node
export interface GraphNode {
  id: string;
  name: string;
  type: string;
  metrics: NodeExecutionMetrics;
  children: string[];
  parents: string[];
  depth: number;
}

// Workflow graph
export interface WorkflowGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, string[]>;
  entryNodes: string[];
  exitNodes: string[];
  criticalPath: string[];
}

// Execution analysis result
export interface ExecutionAnalysisResult {
  runId: string;
  workflowId: string;
  workflowName: string;
  metrics: WorkflowMetrics;
  executionTime: number;
  success: boolean;
  error?: string;
  nodeExecutionData: Map<string, ITaskData[]>;
  generatedAt: Date;
}

// Optimization options
export interface OptimizationOptions {
  enabledOptimizations: OptimizationType[];
  parallelizationThreshold: number;
  cachingEnabled: boolean;
  batchSize: number;
  maxParallelNodes: number;
  analyzeExpressions: boolean;
  analyzeConnections: boolean;
  includeErrorHandling: boolean;
}

// Default optimization options
export const DEFAULT_OPTIMIZATION_OPTIONS: OptimizationOptions = {
  enabledOptimizations: Object.values(OptimizationType),
  parallelizationThreshold: 100, // ms
  cachingEnabled: true,
  batchSize: 100,
  maxParallelNodes: 10,
  analyzeExpressions: true,
  analyzeConnections: true,
  includeErrorHandling: true
};
