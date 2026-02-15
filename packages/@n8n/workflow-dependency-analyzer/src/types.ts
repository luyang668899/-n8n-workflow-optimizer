import type { Workflow } from 'n8n-workflow';

/**
 * 工作流依赖关系
 */
export interface WorkflowDependency {
  /** 源工作流 ID */
  sourceWorkflowId: string;
  /** 源工作流名称 */
  sourceWorkflowName: string;
  /** 目标工作流 ID */
  targetWorkflowId: string;
  /** 目标工作流名称 */
  targetWorkflowName: string;
  /** 依赖类型 */
  dependencyType: DependencyType;
  /** 依赖强度 */
  dependencyStrength: number;
  /** 依赖详情 */
  details: DependencyDetails;
}

/**
 * 依赖类型
 */
export enum DependencyType {
  /** 触发依赖 - 一个工作流触发另一个工作流 */
  TRIGGER = 'trigger',
  /** 数据依赖 - 一个工作流使用另一个工作流的数据 */
  DATA = 'data',
  /** 资源依赖 - 两个工作流使用相同的资源 */
  RESOURCE = 'resource',
  /** 时间依赖 - 工作流执行时间上的依赖 */
  TIME = 'time'
}

/**
 * 依赖详情
 */
export interface DependencyDetails {
  /** 触发方式 */
  triggerMethod?: 'webhook' | 'schedule' | 'manual';
  /** 数据引用路径 */
  dataReferencePath?: string;
  /** 资源名称 */
  resourceName?: string;
  /** 时间窗口（分钟） */
  timeWindow?: number;
  /** 依赖描述 */
  description?: string;
}

/**
 * 工作流节点
 */
export interface WorkflowNode {
  /** 工作流 ID */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流实例 */
  workflow: Workflow;
  /** 入度（依赖此工作流的数量） */
  inDegree: number;
  /** 出度（此工作流依赖的数量） */
  outDegree: number;
  /** 执行频率（次/天） */
  executionFrequency: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 失败率 */
  failureRate: number;
  /** 瓶颈分数 */
  bottleneckScore: number;
}

/**
 * 依赖图
 */
export interface DependencyGraph {
  /** 工作流节点 */
  nodes: WorkflowNode[];
  /** 依赖边 */
  edges: WorkflowDependency[];
  /** 图的密度 */
  density: number;
  /** 最大依赖深度 */
  maxDependencyDepth: number;
  /** 关键路径 */
  criticalPath: string[];
}

/**
 * 依赖分析配置
 */
export interface DependencyAnalyzerConfig {
  /** 是否分析触发依赖 */
  analyzeTriggerDependencies: boolean;
  /** 是否分析数据依赖 */
  analyzeDataDependencies: boolean;
  /** 是否分析资源依赖 */
  analyzeResourceDependencies: boolean;
  /** 是否分析时间依赖 */
  analyzeTimeDependencies: boolean;
  /** 依赖强度阈值 */
  dependencyStrengthThreshold: number;
  /** 最大分析深度 */
  maxAnalysisDepth: number;
  /** 是否生成可视化 */
  generateVisualization: boolean;
  /** 可视化输出路径 */
  visualizationOutputPath: string;
}

/**
 * 依赖分析结果
 */
export interface DependencyAnalysisResult {
  /** 依赖图 */
  graph: DependencyGraph;
  /** 工作流依赖统计 */
  statistics: DependencyStatistics;
  /** 优化建议 */
  suggestions: DependencySuggestion[];
  /** 瓶颈分析 */
  bottleneckAnalysis: BottleneckAnalysis;
}

/**
 * 依赖统计
 */
export interface DependencyStatistics {
  /** 总工作流数量 */
  totalWorkflows: number;
  /** 总依赖数量 */
  totalDependencies: number;
  /** 按类型分类的依赖数量 */
  dependenciesByType: Record<DependencyType, number>;
  /** 平均依赖强度 */
  averageDependencyStrength: number;
  /** 最大依赖强度 */
  maxDependencyStrength: number;
  /** 依赖环数量 */
  dependencyCycles: number;
  /** 孤立工作流数量 */
  isolatedWorkflows: number;
}

/**
 * 依赖优化建议
 */
export interface DependencySuggestion {
  /** 建议 ID */
  id: string;
  /** 建议类型 */
  type: 'reduce_dependency' | 'remove_cycle' | 'optimize_execution' | 'resource_sharing';
  /** 建议描述 */
  description: string;
  /** 潜在性能提升（百分比） */
  potentialPerformanceGain: number;
  /** 实施复杂度 */
  implementationComplexity: 'low' | 'medium' | 'high';
  /** 影响的工作流 */
  affectedWorkflows: string[];
  /** 详细建议 */
  details: string;
}

/**
 * 瓶颈分析
 */
export interface BottleneckAnalysis {
  /** 瓶颈工作流 */
  bottleneckWorkflows: BottleneckWorkflow[];
  /** 瓶颈传播路径 */
  bottleneckPropagationPaths: BottleneckPropagationPath[];
  /** 总体瓶颈分数 */
  overallBottleneckScore: number;
}

/**
 * 瓶颈工作流
 */
export interface BottleneckWorkflow {
  /** 工作流 ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 瓶颈分数 */
  bottleneckScore: number;
  /** 依赖此工作流的数量 */
  dependentWorkflowsCount: number;
  /** 主要瓶颈原因 */
  primaryBottleneckReason: string;
  /** 建议解决方案 */
  suggestedSolution: string;
}

/**
 * 瓶颈传播路径
 */
export interface BottleneckPropagationPath {
  /** 路径 ID */
  pathId: string;
  /** 路径节点 */
  nodes: string[];
  /** 路径长度 */
  pathLength: number;
  /** 累积瓶颈分数 */
  cumulativeBottleneckScore: number;
  /** 影响范围 */
  impactRange: number;
}

/**
 * 可视化配置
 */
export interface VisualizationConfig {
  /** 图表类型 */
  chartType: 'directed' | 'undirected' | 'force' | 'hierarchical';
  /** 节点大小基于 */
  nodeSizeBasedOn: 'execution_time' | 'dependency_count' | 'failure_rate' | 'custom';
  /** 边粗细基于 */
  edgeThicknessBasedOn: 'dependency_strength' | 'execution_frequency' | 'custom';
  /** 颜色方案 */
  colorScheme: 'default' | 'heatmap' | 'category' | 'custom';
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 是否显示标签 */
  showLabels: boolean;
  /** 是否显示工具提示 */
  showTooltips: boolean;
  /** 输出格式 */
  outputFormat: 'svg' | 'png' | 'json';
}

/**
 * 工作流执行数据
 */
export interface WorkflowExecutionData {
  /** 工作流 ID */
  workflowId: string;
  /** 执行次数 */
  executionCount: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 最大执行时间（毫秒） */
  maxExecutionTime: number;
  /** 最小执行时间（毫秒） */
  minExecutionTime: number;
  /** 最近执行时间 */
  lastExecutionTime: number;
  /** 执行频率（次/天） */
  executionFrequency: number;
}
