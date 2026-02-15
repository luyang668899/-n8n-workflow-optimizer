import type { Workflow } from 'n8n-workflow';

/**
 * 资源使用数据点
 */
export interface ResourceDataPoint {
  /** 时间戳 */
  timestamp: number;
  /** 内存使用（MB） */
  memoryUsage: number;
  /** CPU使用率（百分比） */
  cpuUsage: number;
  /** 网络流量（字节/秒） */
  networkTraffic: number;
  /** 存储使用（MB） */
  storageUsage: number;
  /** 工作流ID */
  workflowId: string;
  /** 工作流执行ID */
  executionId: string;
  /** 节点ID（可选） */
  nodeId?: string;
  /** 执行状态 */
  status: 'success' | 'error' | 'pending';
  /** 执行时间（毫秒） */
  executionTime?: number;
  /** 数据处理量（字节） */
  dataProcessed?: number;
}

/**
 * 资源使用预测
 */
export interface ResourcePrediction {
  /** 时间戳 */
  timestamp: number;
  /** 预测内存使用（MB） */
  memoryUsage: number;
  /** 内存使用预测置信区间 */
  memoryUsageConfidence: {
    lower: number;
    upper: number;
  };
  /** 预测CPU使用率（百分比） */
  cpuUsage: number;
  /** CPU使用率预测置信区间 */
  cpuUsageConfidence: {
    lower: number;
    upper: number;
  };
  /** 预测网络流量（字节/秒） */
  networkTraffic: number;
  /** 网络流量预测置信区间 */
  networkTrafficConfidence: {
    lower: number;
    upper: number;
  };
  /** 预测存储使用（MB） */
  storageUsage: number;
  /** 存储使用预测置信区间 */
  storageUsageConfidence: {
    lower: number;
    upper: number;
  };
  /** 预测模型ID */
  modelId: string;
  /** 预测置信度（0-1） */
  confidence: number;
}

/**
 * 资源使用预测请求
 */
export interface ResourcePredictionRequest {
  /** 工作流ID */
  workflowId: string;
  /** 工作流实例（可选） */
  workflow?: Workflow;
  /** 历史数据点数量 */
  historyPoints: number;
  /** 预测时间范围（分钟） */
  predictionRange: number;
  /** 预测粒度（分钟） */
  predictionGranularity: number;
  /** 预测模型类型 */
  modelType: ModelType;
  /** 额外特征数据 */
  features?: WorkflowFeatures;
}

/**
 * 资源使用预测响应
 */
export interface ResourcePredictionResponse {
  /** 预测结果 */
  predictions: ResourcePrediction[];
  /** 预测模型信息 */
  modelInfo: ModelInfo;
  /** 工作流特征 */
  workflowFeatures: WorkflowFeatures;
  /** 资源预警 */
  alerts: ResourceAlert[];
  /** 资源需求建议 */
  recommendations: ResourceRecommendation[];
  /** 预测统计信息 */
  statistics: PredictionStatistics;
}

/**
 * 预测模型类型
 */
export enum ModelType {
  /** ARIMA模型 */
  ARIMA = 'arima',
  /** LSTM模型 */
  LSTM = 'lstm',
  /** 随机森林模型 */
  RANDOM_FOREST = 'random_forest',
  /** 线性回归模型 */
  LINEAR_REGRESSION = 'linear_regression',
  /** 自动选择模型 */
  AUTO = 'auto'
}

/**
 * 模型信息
 */
export interface ModelInfo {
  /** 模型ID */
  modelId: string;
  /** 模型类型 */
  modelType: ModelType;
  /** 模型训练时间 */
  trainingTime: number;
  /** 模型准确率 */
  accuracy: number;
  /** 模型参数 */
  parameters: Record<string, any>;
  /** 最后训练时间戳 */
  lastTrained: number;
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
  /** 触发器类型 */
  triggerType: string;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 执行频率（次/天） */
  executionFrequency: number;
  /** 失败率 */
  failureRate: number;
  /** 数据处理量（字节/执行） */
  averageDataProcessed: number;
  /** 内存使用平均值（MB） */
  averageMemoryUsage: number;
  /** CPU使用率平均值（百分比） */
  averageCpuUsage: number;
  /** 网络流量平均值（字节/秒） */
  averageNetworkTraffic: number;
  /** 存储使用平均值（MB） */
  averageStorageUsage: number;
  /** 节点类型分布 */
  nodeTypeDistribution: Record<string, number>;
  /** 执行时间分布 */
  executionTimeDistribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
    std: number;
  };
}

/**
 * 资源预警
 */
export interface ResourceAlert {
  /** 预警ID */
  alertId: string;
  /** 预警类型 */
  alertType: 'memory' | 'cpu' | 'network' | 'storage';
  /** 预警级别 */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** 预警消息 */
  message: string;
  /** 触发时间戳 */
  timestamp: number;
  /** 预计触发时间戳 */
  predictedTimestamp: number;
  /** 当前值 */
  currentValue: number;
  /** 阈值 */
  threshold: number;
  /** 工作流ID */
  workflowId: string;
  /** 建议操作 */
  recommendedAction: string;
}

/**
 * 资源需求建议
 */
export interface ResourceRecommendation {
  /** 建议ID */
  recommendationId: string;
  /** 建议类型 */
  type: 'memory' | 'cpu' | 'network' | 'storage' | 'general';
  /** 建议描述 */
  description: string;
  /** 建议详情 */
  details: string;
  /** 预计性能提升（百分比） */
  expectedPerformanceGain: number;
  /** 实施复杂度 */
  complexity: 'low' | 'medium' | 'high';
  /** 成本影响 */
  costImpact: 'low' | 'medium' | 'high';
  /** 优先级 */
  priority: 'low' | 'medium' | 'high';
  /** 相关资源使用预测 */
  relatedPredictions: ResourcePrediction[];
}

/**
 * 预测统计信息
 */
export interface PredictionStatistics {
  /** 平均预测置信度 */
  averageConfidence: number;
  /** 预测误差统计 */
  errorStatistics: {
    memoryUsage: {
      mae: number; // 平均绝对误差
      rmse: number; // 均方根误差
      mape: number; // 平均绝对百分比误差
    };
    cpuUsage: {
      mae: number;
      rmse: number;
      mape: number;
    };
    networkTraffic: {
      mae: number;
      rmse: number;
      mape: number;
    };
    storageUsage: {
      mae: number;
      rmse: number;
      mape: number;
    };
  };
  /** 预警数量 */
  alertCount: number;
  /** 建议数量 */
  recommendationCount: number;
  /** 模型执行时间（毫秒） */
  executionTime: number;
  /** 历史数据点数量 */
  historyDataPoints: number;
  /** 预测数据点数量 */
  predictionDataPoints: number;
}

/**
 * 预测模型配置
 */
export interface ModelConfig {
  /** 模型类型 */
  modelType: ModelType;
  /** 训练参数 */
  trainingParams: {
    /** 训练轮次 */
    epochs: number;
    /** 批次大小 */
    batchSize: number;
    /** 学习率 */
    learningRate: number;
    /** 验证集比例 */
    validationSplit: number;
    /** 早停 patience */
    earlyStoppingPatience: number;
  };
  /** 特征参数 */
  featureParams: {
    /** 是否使用时间特征 */
    useTimeFeatures: boolean;
    /** 是否使用工作流特征 */
    useWorkflowFeatures: boolean;
    /** 是否使用执行特征 */
    useExecutionFeatures: boolean;
    /** 特征归一化方法 */
    normalizationMethod: 'min-max' | 'z-score' | 'none';
  };
  /** 预测参数 */
  predictionParams: {
    /** 预测步长 */
    predictionSteps: number;
    /** 置信区间 */
    confidenceInterval: number;
    /** 是否启用趋势检测 */
    enableTrendDetection: boolean;
    /** 是否启用季节性检测 */
    enableSeasonalityDetection: boolean;
  };
}

/**
 * 资源使用预测器配置
 */
export interface ResourcePredictorConfig {
  /** 默认模型类型 */
  defaultModelType: ModelType;
  /** 模型配置 */
  modelConfig: ModelConfig;
  /** 数据收集配置 */
  dataCollection: {
    /** 收集间隔（毫秒） */
    collectionInterval: number;
    /** 数据保留时间（天） */
    retentionDays: number;
    /** 数据采样率 */
    samplingRate: number;
  };
  /** 预警配置 */
  alertConfig: {
    /** 是否启用预警 */
    enabled: boolean;
    /** 内存预警阈值（MB） */
    memoryThreshold: number;
    /** CPU预警阈值（百分比） */
    cpuThreshold: number;
    /** 网络预警阈值（字节/秒） */
    networkThreshold: number;
    /** 存储预警阈值（MB） */
    storageThreshold: number;
    /** 预警提前时间（分钟） */
    alertAdvanceTime: number;
  };
  /** 建议配置 */
  recommendationConfig: {
    /** 是否启用建议 */
    enabled: boolean;
    /** 建议生成频率（分钟） */
    generationFrequency: number;
    /** 最大建议数量 */
    maxRecommendations: number;
  };
  /** 存储配置 */
  storageConfig: {
    /** 存储类型 */
    storageType: 'in-memory' | 'file' | 'database';
    /** 存储路径（文件存储时使用） */
    storagePath?: string;
    /** 数据库连接字符串（数据库存储时使用） */
    databaseUrl?: string;
  };
}

/**
 * 时间序列分析结果
 */
export interface TimeSeriesAnalysis {
  /** 趋势分析 */
  trend: {
    /** 趋势类型 */
    type: 'increasing' | 'decreasing' | 'stable';
    /** 趋势强度（0-1） */
    strength: number;
    /** 趋势斜率 */
    slope: number;
  };
  /** 季节性分析 */
  seasonality: {
    /** 是否存在季节性 */
    present: boolean;
    /** 季节性周期（分钟） */
    period?: number;
    /** 季节性强度（0-1） */
    strength?: number;
  };
  /** 异常检测 */
  anomalies: {
    /** 是否存在异常 */
    present: boolean;
    /** 异常点 */
    points: number[];
    /** 异常强度（0-1） */
    strength?: number;
  };
  /** 统计特征 */
  statistics: {
    /** 平均值 */
    mean: number;
    /** 标准差 */
    std: number;
    /** 最小值 */
    min: number;
    /** 最大值 */
    max: number;
    /** 中位数 */
    median: number;
    /** 偏度 */
    skewness: number;
    /** 峰度 */
    kurtosis: number;
  };
}

/**
 * 模型性能评估
 */
export interface ModelEvaluation {
  /** 模型ID */
  modelId: string;
  /** 模型类型 */
  modelType: ModelType;
  /** 评估指标 */
  metrics: {
    /** 平均绝对误差 */
    mae: number;
    /** 均方根误差 */
    rmse: number;
    /** 平均绝对百分比误差 */
    mape: number;
    /** R平方值 */
    r2: number;
    /** 准确率 */
    accuracy: number;
  };
  /** 评估时间戳 */
  timestamp: number;
  /** 评估数据点数量 */
  dataPoints: number;
  /** 模型大小（字节） */
  modelSize: number;
  /** 推理时间（毫秒/预测） */
  inferenceTime: number;
}
