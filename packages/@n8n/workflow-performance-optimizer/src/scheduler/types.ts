import type { Workflow } from 'n8n-workflow';

/**
 * 工作流调度结果
 */
export interface ScheduleResult {
  /** 调度是否成功 */
  success: boolean;
  /** 调度消息 */
  message: string;
  /** 调度计划 */
  schedule?: ScheduleInfo;
  /** 错误信息 */
  error?: string;
}

/**
 * 调度计划信息
 */
export interface ScheduleInfo {
  /** 调度计划ID */
  id: string;
  /** 工作流ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 计划执行时间 */
  scheduledTime: number;
  /** 预计执行时长（毫秒） */
  estimatedDuration: number;
  /** 优先级 */
  priority: number;
  /** 资源需求 */
  resourceRequirements: ResourceRequirements;
  /** 调度状态 */
  status: 'pending' | 'scheduled' | 'running' | 'completed' | 'failed';
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
}

/**
 * 资源需求
 */
export interface ResourceRequirements {
  /** CPU需求（百分比） */
  cpu: number;
  /** 内存需求（MB） */
  memory: number;
  /** 网络带宽需求（Mbps） */
  network?: number;
  /** 存储需求（MB） */
  storage?: number;
}

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  /** CPU使用情况 */
  cpu: {
    /** 当前使用率（百分比） */
    usage: number;
    /** 核心数 */
    cores: number;
  };
  /** 内存使用情况 */
  memory: {
    /** 当前使用量（MB） */
    used: number;
    /** 总容量（MB） */
    total: number;
    /** 使用率（百分比） */
    usage: number;
  };
  /** 网络使用情况 */
  network?: {
    /** 上传速度（Mbps） */
    upload: number;
    /** 下载速度（Mbps） */
    download: number;
  };
  /** 存储使用情况 */
  storage?: {
    /** 当前使用量（MB） */
    used: number;
    /** 总容量（MB） */
    total: number;
    /** 使用率（百分比） */
    usage: number;
  };
}

/**
 * 工作流特征
 */
export interface WorkflowFeatures {
  /** 工作流ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 节点数量 */
  nodeCount: number;
  /** 连接数量 */
  connectionCount: number;
  /** 工作流深度 */
  depth: number;
  /** 预计执行时长（毫秒） */
  estimatedDuration: number;
  /** 复杂度评分 */
  complexityScore: number;
  /** 资源需求 */
  resourceRequirements: ResourceRequirements;
  /** 历史执行数据 */
  historicalData?: {
    /** 平均执行时长（毫秒） */
    avgDuration: number;
    /** 最大执行时长（毫秒） */
    maxDuration: number;
    /** 最小执行时长（毫秒） */
    minDuration: number;
    /** 执行次数 */
    executionCount: number;
    /** 成功率（百分比） */
    successRate: number;
  };
}

/**
 * 调度选项
 */
export interface ScheduleOptions {
  /** 优先级 */
  priority?: number;
  /** 预计执行时长（毫秒） */
  estimatedDuration?: number;
  /** 资源需求 */
  resourceRequirements?: ResourceRequirements;
  /** 是否立即执行 */
  immediate?: boolean;
  /** 调度模式 */
  mode?: 'auto' | 'manual';
  /** 最大等待时间（毫秒） */
  maxWaitTime?: number;
}

/**
 * 基准测试选项
 */
export interface BenchmarkOptions {
  /** 测试名称 */
  name?: string;
  /** 测试迭代次数 */
  iterations: number;
  /** 并发度 */
  concurrency: number;
  /** 是否收集详细数据 */
  detailed?: boolean;
  /** 测试超时时间（毫秒） */
  timeout?: number;
}

/**
 * 基准测试结果
 */
export interface BenchmarkResult {
  /** 测试名称 */
  name: string;
  /** 测试时间 */
  timestamp: number;
  /** 工作流信息 */
  workflow: {
    id: string;
    name: string;
  };
  /** 测试配置 */
  config: BenchmarkOptions;
  /** 测试结果统计 */
  statistics: {
    /** 执行时间统计 */
    executionTime: {
      /** 平均值（毫秒） */
      mean: number;
      /** 中位数（毫秒） */
      median: number;
      /** 最小值（毫秒） */
      min: number;
      /** 最大值（毫秒） */
      max: number;
      /** 标准差（毫秒） */
      stdDev: number;
      /** 95%分位数（毫秒） */
      p95: number;
      /** 99%分位数（毫秒） */
      p99: number;
    };
    /** 内存使用统计 */
    memoryUsage: {
      /** 平均值（MB） */
      mean: number;
      /** 最大值（MB） */
      max: number;
    };
    /** CPU使用统计 */
    cpuUsage: {
      /** 平均值（百分比） */
      mean: number;
      /** 最大值（百分比） */
      max: number;
    };
    /** 成功率（百分比） */
    successRate: number;
    /** 吞吐量（迭代/秒） */
    throughput: number;
  };
  /** 原始测试数据 */
  rawData: Array<{
    /** 迭代次数 */
    iteration: number;
    /** 执行时间（毫秒） */
    duration: number;
    /** 内存使用（MB） */
    memoryUsage: number;
    /** CPU使用（百分比） */
    cpuUsage: number;
    /** 是否成功 */
    success: boolean;
    /** 错误信息 */
    error?: string;
  }>;
}

/**
 * 性能比较结果
 */
export interface ComparisonResult {
  /** 比较时间 */
  timestamp: number;
  /** 工作流ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 版本比较数据 */
  versions: Array<{
    /** 版本ID */
    version: string;
    /** 基准测试结果 */
    benchmark: BenchmarkResult;
    /** 与基准版本的差异 */
    diff?: {
      /** 执行时间差异（百分比） */
      executionTime: number;
      /** 内存使用差异（百分比） */
      memoryUsage: number;
      /** CPU使用差异（百分比） */
      cpuUsage: number;
      /** 成功率差异（百分比） */
      successRate: number;
    };
  }>;
  /** 最佳版本 */
  bestVersion: string;
  /** 整体性能趋势 */
  trend: 'improving' | 'declining' | 'stable';
}

/**
 * 性能历史数据
 */
export interface PerformanceHistory {
  /** 工作流ID */
  workflowId: string;
  /** 历史记录 */
  records: Array<{
    /** 时间戳 */
    timestamp: number;
    /** 版本ID */
    version: string;
    /** 执行时间（毫秒） */
    executionTime: number;
    /** 内存使用（MB） */
    memoryUsage: number;
    /** CPU使用（百分比） */
    cpuUsage: number;
    /** 成功率（百分比） */
    successRate: number;
  }>;
}

/**
 * 健康评分
 */
export interface HealthScore {
  /** 工作流ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 健康评分（0-100） */
  score: number;
  /** 评分等级 */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** 评分时间 */
  timestamp: number;
  /** 各维度评分 */
  dimensions: {
    /** 执行效率评分（0-100） */
    efficiency: number;
    /** 资源使用评分（0-100） */
    resourceUsage: number;
    /** 稳定性评分（0-100） */
    stability: number;
    /** 复杂度评分（0-100） */
    complexity: number;
    /** 可维护性评分（0-100） */
    maintainability: number;
  };
  /** 改进建议数量 */
  suggestionCount: number;
}

/**
 * 健康报告
 */
export interface HealthReport {
  /** 健康评分 */
  score: HealthScore;
  /** 详细分析 */
  analysis: {
    /** 执行效率分析 */
    efficiency: {
      /** 分析结果 */
      result: string;
      /** 详细数据 */
      data: any;
    };
    /** 资源使用分析 */
    resourceUsage: {
      /** 分析结果 */
      result: string;
      /** 详细数据 */
      data: any;
    };
    /** 稳定性分析 */
    stability: {
      /** 分析结果 */
      result: string;
      /** 详细数据 */
      data: any;
    };
    /** 复杂度分析 */
    complexity: {
      /** 分析结果 */
      result: string;
      /** 详细数据 */
      data: any;
    };
  };
  /** 改进建议 */
  suggestions: ImprovementSuggestion[];
  /** 历史评分 */
  history: Array<{
    /** 评分时间 */
    timestamp: number;
    /** 健康评分 */
    score: number;
    /** 评分等级 */
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  }>;
}

/**
 * 改进建议
 */
export interface ImprovementSuggestion {
  /** 建议ID */
  id: string;
  /** 建议类型 */
  type: 'efficiency' | 'resource' | 'stability' | 'complexity' | 'maintainability';
  /** 建议标题 */
  title: string;
  /** 建议描述 */
  description: string;
  /** 建议优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 预期改进效果（百分比） */
  expectedImprovement: number;
  /** 实施难度 */
  difficulty: 'easy' | 'medium' | 'hard';
  /** 建议详细步骤 */
  steps: string[];
  /** 相关节点ID */
  relatedNodes?: string[];
  /** 创建时间 */
  createdAt: number;
}

/**
 * 评分历史
 */
export interface ScoreHistory {
  /** 工作流ID */
  workflowId: string;
  /** 评分记录 */
  records: Array<{
    /** 评分时间 */
    timestamp: number;
    /** 健康评分 */
    score: number;
    /** 评分等级 */
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    /** 各维度评分 */
    dimensions: HealthScore['dimensions'];
  }>;
  /** 趋势分析 */
  trend: {
    /** 整体趋势 */
    overall: 'improving' | 'declining' | 'stable';
    /** 各维度趋势 */
    dimensions: {
      efficiency: 'improving' | 'declining' | 'stable';
      resourceUsage: 'improving' | 'declining' | 'stable';
      stability: 'improving' | 'declining' | 'stable';
      complexity: 'improving' | 'declining' | 'stable';
      maintainability: 'improving' | 'declining' | 'stable';
    };
  };
}

/**
 * 智能调度器接口
 */
export interface WorkflowScheduler {
  /**
   * 调度工作流
   * @param workflow 工作流实例
   * @param options 调度选项
   * @returns 调度结果
   */
  schedule(workflow: Workflow, options?: ScheduleOptions): Promise<ScheduleResult>;

  /**
   * 重新调度工作流
   * @param workflowId 工作流ID
   * @param options 调度选项
   * @returns 调度结果
   */
  reschedule(workflowId: string, options?: ScheduleOptions): Promise<ScheduleResult>;

  /**
   * 获取工作流的调度计划
   * @param workflowId 工作流ID
   * @returns 调度计划信息
   */
  getSchedule(workflowId: string): Promise<ScheduleInfo | null>;

  /**
   * 获取当前资源使用情况
   * @returns 资源使用情况
   */
  getResourceUsage(): Promise<ResourceUsage>;

  /**
   * 获取工作流特征
   * @param workflow 工作流实例
   * @returns 工作流特征
   */
  getWorkflowFeatures(workflow: Workflow): Promise<WorkflowFeatures>;

  /**
   * 取消调度
   * @param workflowId 工作流ID
   * @returns 是否取消成功
   */
  cancelSchedule(workflowId: string): Promise<boolean>;

  /**
   * 获取所有调度计划
   * @returns 调度计划列表
   */
  getAllSchedules(): Promise<ScheduleInfo[]>;

  /**
   * 清理过期的调度计划
   * @returns 清理的计划数量
   */
  cleanupSchedules(): Promise<number>;
}

/**
 * 性能比较器接口
 */
export interface PerformanceComparator {
  /**
   * 运行基准测试
   * @param workflow 工作流实例
   * @param options 基准测试选项
   * @returns 基准测试结果
   */
  runBenchmark(workflow: Workflow, options: BenchmarkOptions): Promise<BenchmarkResult>;

  /**
   * 比较多个版本的性能
   * @param workflowId 工作流ID
   * @param versions 版本ID列表
   * @returns 比较结果
   */
  compareVersions(workflowId: string, versions: string[]): Promise<ComparisonResult>;

  /**
   * 获取性能历史数据
   * @param workflowId 工作流ID
   * @param limit 限制数量
   * @returns 性能历史数据
   */
  getHistoricalData(workflowId: string, limit?: number): Promise<PerformanceHistory>;

  /**
   * 保存基准测试结果
   * @param result 基准测试结果
   * @returns 是否保存成功
   */
  saveBenchmarkResult(result: BenchmarkResult): Promise<boolean>;

  /**
   * 获取基准测试结果
   * @param workflowId 工作流ID
   * @param version 版本ID
   * @returns 基准测试结果
   */
  getBenchmarkResult(workflowId: string, version: string): Promise<BenchmarkResult | null>;
}

/**
 * 健康评分系统接口
 */
export interface HealthScoringSystem {
  /**
   * 计算工作流健康评分
   * @param workflow 工作流实例
   * @returns 健康评分
   */
  calculateScore(workflow: Workflow): Promise<HealthScore>;

  /**
   * 获取工作流健康报告
   * @param workflowId 工作流ID
   * @returns 健康报告
   */
  getHealthReport(workflowId: string): Promise<HealthReport>;

  /**
   * 获取评分历史
   * @param workflowId 工作流ID
   * @param limit 限制数量
   * @returns 评分历史
   */
  getScoreHistory(workflowId: string, limit?: number): Promise<ScoreHistory>;

  /**
   * 获取改进建议
   * @param workflowId 工作流ID
   * @returns 改进建议列表
   */
  getImprovementSuggestions(workflowId: string): Promise<ImprovementSuggestion[]>;

  /**
   * 保存健康评分
   * @param score 健康评分
   * @returns 是否保存成功
   */
  saveHealthScore(score: HealthScore): Promise<boolean>;

  /**
   * 分析工作流健康趋势
   * @param workflowId 工作流ID
   * @param days 天数
   * @returns 健康趋势分析
   */
  analyzeHealthTrend(workflowId: string, days: number): Promise<{
    trend: 'improving' | 'declining' | 'stable';
    scoreChange: number;
    keyInsights: string[];
  }>;
}