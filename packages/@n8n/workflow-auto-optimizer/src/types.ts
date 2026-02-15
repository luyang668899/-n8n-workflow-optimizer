import type { Workflow } from 'n8n-workflow';

/**
 * 优化操作类型
 */
export enum OptimizationType {
  /** 节点配置修改 */
  NODE_CONFIG = 'node_config',
  /** 工作流结构调整 */
  WORKFLOW_STRUCTURE = 'workflow_structure',
  /** 资源参数优化 */
  RESOURCE_PARAMETERS = 'resource_parameters',
  /** 并行执行优化 */
  PARALLEL_EXECUTION = 'parallel_execution',
  /** 缓存策略优化 */
  CACHE_STRATEGY = 'cache_strategy',
  /** 数据处理优化 */
  DATA_PROCESSING = 'data_processing',
}

/**
 * 优化操作状态
 */
export enum OptimizationStatus {
  /** 待执行 */
  PENDING = 'pending',
  /** 执行中 */
  IN_PROGRESS = 'in_progress',
  /** 成功 */
  SUCCESS = 'success',
  /** 失败 */
  FAILED = 'failed',
  /** 已回滚 */
  ROLLED_BACK = 'rolled_back',
}

/**
 * 优化操作风险级别
 */
export enum RiskLevel {
  /** 低风险 */
  LOW = 'low',
  /** 中风险 */
  MEDIUM = 'medium',
  /** 高风险 */
  HIGH = 'high',
}

/**
 * 优化操作
 */
export interface OptimizationOperation {
  /** 操作ID */
  id: string;
  /** 操作类型 */
  type: OptimizationType;
  /** 操作描述 */
  description: string;
  /** 工作流ID */
  workflowId: string;
  /** 目标节点ID（可选） */
  nodeId?: string;
  /** 操作参数 */
  parameters: Record<string, any>;
  /** 预期性能提升（百分比） */
  expectedPerformanceGain: number;
  /** 风险级别 */
  riskLevel: RiskLevel;
  /** 状态 */
  status: OptimizationStatus;
  /** 创建时间 */
  createdAt: number;
  /** 执行时间 */
  executedAt?: number;
  /** 执行结果 */
  result?: {
    success: boolean;
    message: string;
    actualPerformanceGain?: number;
  };
  /** 回滚数据 */
  rollbackData?: Record<string, any>;
}

/**
 * 优化计划
 */
export interface OptimizationPlan {
  /** 计划ID */
  id: string;
  /** 计划名称 */
  name: string;
  /** 工作流ID列表 */
  workflowIds: string[];
  /** 优化操作列表 */
  operations: OptimizationOperation[];
  /** 执行计划 */
  schedule?: {
    /** 执行时间表达式（cron格式） */
    cronExpression: string;
    /** 是否启用 */
    enabled: boolean;
  };
  /** 执行状态 */
  status: 'draft' | 'scheduled' | 'executing' | 'completed' | 'failed';
  /** 创建时间 */
  createdAt: number;
  /** 最后执行时间 */
  lastExecutedAt?: number;
  /** 执行结果 */
  executionResult?: {
    success: boolean;
    message: string;
    executedOperations: number;
    successfulOperations: number;
  };
}

/**
 * 优化执行器配置
 */
export interface AutoOptimizerConfig {
  /** 是否启用自动优化 */
  enabled: boolean;
  /** 最大并行操作数 */
  maxParallelOperations: number;
  /** 操作超时时间（毫秒） */
  operationTimeout: number;
  /** 风险控制配置 */
  riskControl: {
    /** 是否允许高风险操作 */
    allowHighRisk: boolean;
    /** 是否需要用户确认 */
    requireConfirmation: boolean;
    /** 最大风险级别 */
    maxRiskLevel: RiskLevel;
  };
  /** 回滚配置 */
  rollback: {
    /** 是否启用自动回滚 */
    enabled: boolean;
    /** 回滚超时时间（毫秒） */
    timeout: number;
  };
  /** 验证配置 */
  validation: {
    /** 是否启用基准测试验证 */
    enabled: boolean;
    /** 基准测试迭代次数 */
    iterations: number;
    /** 性能提升阈值（百分比） */
    performanceGainThreshold: number;
  };
}

/**
 * 优化执行上下文
 */
export interface OptimizationContext {
  /** 工作流实例 */
  workflow?: Workflow;
  /** 工作流配置 */
  workflowConfig?: Record<string, any>;
  /** 执行环境信息 */
  environment: Record<string, any>;
  /** 操作执行日志 */
  logs: string[];
  /** 操作开始时间 */
  startTime: number;
  /** 操作超时时间 */
  timeout: number;
}

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  /** 建议ID */
  id: string;
  /** 建议类型 */
  type: OptimizationType;
  /** 建议描述 */
  description: string;
  /** 详细信息 */
  details: string;
  /** 预期性能提升（百分比） */
  expectedPerformanceGain: number;
  /** 风险级别 */
  riskLevel: RiskLevel;
  /** 工作流ID */
  workflowId: string;
  /** 目标节点ID（可选） */
  nodeId?: string;
  /** 建议参数 */
  parameters: Record<string, any>;
  /** 优先级 */
  priority: 'low' | 'medium' | 'high';
  /** 创建时间 */
  createdAt: number;
}

/**
 * 安全检查结果
 */
export interface SecurityCheckResult {
  /** 是否通过 */
  passed: boolean;
  /** 检查项 */
  checks: {
    /** 检查名称 */
    name: string;
    /** 是否通过 */
    passed: boolean;
    /** 检查结果消息 */
    message: string;
    /** 风险级别 */
    riskLevel: RiskLevel;
  }[];
  /** 总体风险级别 */
  overallRiskLevel: RiskLevel;
  /** 建议操作 */
  recommendedAction: string;
}

/**
 * 优化执行结果
 */
export interface OptimizationExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 执行消息 */
  message: string;
  /** 执行的操作 */
  executedOperations: OptimizationOperation[];
  /** 成功的操作 */
  successfulOperations: OptimizationOperation[];
  /** 失败的操作 */
  failedOperations: OptimizationOperation[];
  /** 性能提升（百分比） */
  performanceGain?: number;
  /** 执行时间（毫秒） */
  executionTime: number;
}
