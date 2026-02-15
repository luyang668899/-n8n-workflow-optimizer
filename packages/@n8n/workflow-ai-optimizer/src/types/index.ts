/**
 * AI workflow optimizer types
 */
import type { Workflow, INodeExecutionData } from 'n8n-workflow';
import type { WorkflowPerformanceMetrics, NodePerformanceMetrics, Bottleneck } from '@n8n/workflow-monitor';

/**
 * AI optimizer configuration
 */
export interface AIOptimizerConfig {
  /** Enable/disable AI optimizer */
  enabled: boolean;
  /** LLM provider */
  provider: 'openai' | 'local' | 'custom';
  /** API key for LLM provider */
  apiKey?: string;
  /** API endpoint for custom LLM providers */
  apiEndpoint?: string;
  /** Model name to use */
  model: string;
  /** Temperature for LLM responses */
  temperature: number;
  /** Maximum tokens for LLM responses */
  maxTokens: number;
  /** Enable/disable learning from user feedback */
  enableLearning: boolean;
  /** Enable/disable caching of optimization suggestions */
  enableCaching: boolean;
  /** Cache expiration time in milliseconds */
  cacheExpiration: number;
}

/**
 * Workflow structure representation for LLM
 */
export interface WorkflowStructure {
  /** Workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Nodes in the workflow */
  nodes: WorkflowNode[];
  /** Connections between nodes */
  connections: WorkflowConnection[];
  /** Workflow tags */
  tags: string[];
  /** Workflow settings */
  settings: Record<string, any>;
}

/**
 * Node representation for LLM
 */
export interface WorkflowNode {
  /** Node ID */
  id: string;
  /** Node name */
  name: string;
  /** Node type */
  type: string;
  /** Node position */
  position: {
    x: number;
    y: number;
  };
  /** Node parameters */
  parameters: Record<string, any>;
  /** Node credentials */
  credentials?: Record<string, any>;
  /** Node settings */
  settings?: Record<string, any>;
  /** Node execution metrics */
  metrics?: NodePerformanceMetrics;
}

/**
 * Connection representation for LLM
 */
export interface WorkflowConnection {
  /** Source node ID */
  source: string;
  /** Source node output */
  sourceOutput: string;
  /** Target node ID */
  target: string;
  /** Target node input */
  targetInput: string;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Suggestion ID */
  id: string;
  /** Suggestion title */
  title: string;
  /** Suggestion description */
  description: string;
  /** Suggestion type */
  type: 'performance' | 'reliability' | 'scalability' | 'cost' | 'bestPractice';
  /** Suggestion severity */
  severity: 'low' | 'medium' | 'high';
  /** Suggestion priority score (0-100) */
  priority: number;
  /** Potential performance improvement (0-100%) */
  potentialImprovement: number;
  /** Implementation complexity (0-100) */
  complexity: number;
  /** Affected nodes */
  affectedNodes: string[];
  /** Suggested changes */
  suggestedChanges: {
    nodeId?: string;
    property?: string;
    oldValue?: any;
    newValue?: any;
    description?: string;
  }[];
  /** Expected impact on performance metrics */
  expectedImpact: {
    executionTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    dataSize?: number;
  };
  /** Evidence supporting the suggestion */
  evidence: {
    type: 'metrics' | 'pattern' | 'rule' | 'history';
    data: any;
  }[];
  /** Creation timestamp */
  createdAt: number;
  /** User feedback score (1-5) */
  feedbackScore?: number;
  /** User feedback comments */
  feedbackComments?: string;
}

/**
 * Optimization suggestion request
 */
export interface SuggestionRequest {
  /** Workflow structure */
  workflow: WorkflowStructure;
  /** Performance metrics */
  metrics?: WorkflowPerformanceMetrics;
  /** Bottlenecks detected */
  bottlenecks?: Bottleneck[];
  /** User query (optional) */
  userQuery?: string;
  /** Historical execution data */
  historicalData?: HistoricalExecutionData[];
  /** Contextual information */
  context?: {
    userRole?: string;
    workflowPurpose?: string;
    environment?: 'development' | 'staging' | 'production';
    expectedLoad?: 'low' | 'medium' | 'high';
    [key: string]: any;
  };
}

/**
 * Historical execution data
 */
export interface HistoricalExecutionData {
  /** Execution ID */
  executionId: string;
  /** Execution timestamp */
  timestamp: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Success status */
  success: boolean;
  /** Error information */
  error?: {
    message: string;
    nodeId: string;
  };
  /** Node execution metrics */
  nodeMetrics: Record<string, NodePerformanceMetrics>;
  /** Workflow state at execution time */
  workflowState?: any;
}

/**
 * Optimization pattern
 */
export interface OptimizationPattern {
  /** Pattern ID */
  id: string;
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Pattern type */
  type: 'node' | 'connection' | 'workflow' | 'parameter';
  /** Pattern severity */
  severity: 'low' | 'medium' | 'high';
  /** Detection criteria */
  detectionCriteria: {
    [key: string]: any;
  };
  /** Suggested fix */
  suggestedFix: {
    [key: string]: any;
  };
  /** Confidence score (0-1) */
  confidence: number;
  /** Occurrence count */
  occurrenceCount: number;
  /** Last detected timestamp */
  lastDetected: number;
}

/**
 * User feedback on optimization suggestion
 */
export interface SuggestionFeedback {
  /** Suggestion ID */
  suggestionId: string;
  /** Feedback score (1-5) */
  score: number;
  /** Feedback comments */
  comments?: string;
  /** Whether the suggestion was implemented */
  implemented: boolean;
  /** Actual performance improvement after implementation */
  actualImprovement?: number;
  /** Feedback timestamp */
  timestamp: number;
}

/**
 * Default AI optimizer configuration
 */
export const defaultAIOptimizerConfig: AIOptimizerConfig = {
  enabled: true,
  provider: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1000,
  enableLearning: true,
  enableCaching: true,
  cacheExpiration: 3600000 // 1 hour
};

/**
 * LLM response schema
 */
export interface LLMResponse {
  /** Generated suggestions */
  suggestions: OptimizationSuggestion[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Response metadata */
  metadata: {
    model: string;
    tokensUsed: number;
    processingTime: number;
  };
  /** Error information */
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Workflow parser options
 */
export interface WorkflowParserOptions {
  /** Include performance metrics */
  includeMetrics: boolean;
  /** Include historical data */
  includeHistoricalData: boolean;
  /** Include bottlenecks */
  includeBottlenecks: boolean;
  /** Simplify complex parameters */
  simplifyParameters: boolean;
  /** Max depth for nested parameters */
  maxParameterDepth: number;
}

/**
 * Default workflow parser options
 */
export const defaultWorkflowParserOptions: WorkflowParserOptions = {
  includeMetrics: true,
  includeHistoricalData: false,
  includeBottlenecks: true,
  simplifyParameters: true,
  maxParameterDepth: 3
};
