import type { Counter, Gauge, Histogram, Summary } from 'prom-client';
import type { Workflow } from 'n8n-workflow';

/**
 * 监控系统配置选项
 */
export interface MonitoringConfig {
  /** Prometheus 配置 */
  prometheus: {
    /** 是否启用 */
    enabled: boolean;
    /** 指标前缀 */
    metricPrefix: string;
    /** 端口 */
    port: number;
    /** 路径 */
    path: string;
    /** 收集间隔（毫秒） */
    collectionInterval: number;
  };
  /** Grafana 配置 */
  grafana: {
    /** 是否启用 */
    enabled: boolean;
    /** 仪表板模板路径 */
    dashboardTemplatePath: string;
    /** 导出路径 */
    exportPath: string;
  };
  /** ELK Stack 配置 */
  elk: {
    /** 是否启用 */
    enabled: boolean;
    /** Elasticsearch 节点 */
    nodes: string[];
    /** 索引名称 */
    indexName: string;
    /** 日志级别 */
    logLevel: string;
    /** 认证配置 */
    auth?: {
      username: string;
      password: string;
    };
    /** TLS 配置 */
    tls?: {
      rejectUnauthorized: boolean;
    };
  };
  /** 告警配置 */
  alerts: {
    /** 是否启用 */
    enabled: boolean;
    /** 告警规则 */
    rules: AlertRule[];
  };
  /** 自定义指标配置 */
  customMetrics: {
    /** 是否启用 */
    enabled: boolean;
    /** 自定义指标列表 */
    metrics: CustomMetric[];
  };
}

/**
 * 告警规则
 */
export interface AlertRule {
  /** 告警名称 */
  name: string;
  /** 告警描述 */
  description: string;
  /** 指标名称 */
  metricName: string;
  /** 比较操作符 */
  operator: '>' | '<' | '>=' | '<=' | '==';
  /** 阈值 */
  threshold: number;
  /** 持续时间（秒） */
  duration: number;
  /** 严重程度 */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** 通知方式 */
  notifications: Notification[];
}

/**
 * 通知配置
 */
export interface Notification {
  /** 通知类型 */
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  /** 通知配置 */
  config: {
    /** 收件人（邮件） */
    recipients?: string[];
    /** Webhook URL */
    url?: string;
    /** Slack 通道 */
    channel?: string;
    /** PagerDuty 服务 ID */
    serviceId?: string;
  };
}

/**
 * 自定义指标
 */
export interface CustomMetric {
  /** 指标名称 */
  name: string;
  /** 指标描述 */
  description: string;
  /** 指标类型 */
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  /** 标签 */
  labels: string[];
  /** 直方图配置（仅适用于 histogram 类型） */
  buckets?: number[];
  /** 摘要配置（仅适用于 summary 类型） */
  percentiles?: number[];
}

/**
 * 工作流性能指标
 */
export interface WorkflowMetrics {
  /** 工作流 ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
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
  /** 95% 分位数执行时间（毫秒） */
  p95ExecutionTime: number;
  /** 99% 分位数执行时间（毫秒） */
  p99ExecutionTime: number;
  /** 内存使用（MB） */
  memoryUsage: number;
  /** CPU 使用率（百分比） */
  cpuUsage: number;
  /** 数据处理量（字节） */
  dataProcessed: number;
  /** 最后执行时间 */
  lastExecutedAt: number;
}

/**
 * 节点性能指标
 */
export interface NodeMetrics {
  /** 节点 ID */
  nodeId: string;
  /** 节点名称 */
  nodeName: string;
  /** 节点类型 */
  nodeType: string;
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
  /** 95% 分位数执行时间（毫秒） */
  p95ExecutionTime: number;
  /** 99% 分位数执行时间（毫秒） */
  p99ExecutionTime: number;
  /** 输入数据量（字节） */
  inputDataSize: number;
  /** 输出数据量（字节） */
  outputDataSize: number;
  /** 最后执行时间 */
  lastExecutedAt: number;
}

/**
 * Prometheus 指标集合
 */
export interface PrometheusMetrics {
  /** 工作流执行计数器 */
  workflowExecutionsTotal: Counter<string>;
  /** 工作流执行失败计数器 */
  workflowExecutionsFailedTotal: Counter<string>;
  /** 工作流执行成功计数器 */
  workflowExecutionsSucceededTotal: Counter<string>;
  /** 工作流执行时间直方图 */
  workflowExecutionDurationSeconds: Histogram<string>;
  /** 工作流内存使用 gauge */
  workflowMemoryUsageBytes: Gauge<string>;
  /** 工作流 CPU 使用率 gauge */
  workflowCpuUsagePercent: Gauge<string>;
  /** 工作流数据处理量计数器 */
  workflowDataProcessedBytes: Counter<string>;
  /** 节点执行计数器 */
  nodeExecutionsTotal: Counter<string>;
  /** 节点执行失败计数器 */
  nodeExecutionsFailedTotal: Counter<string>;
  /** 节点执行成功计数器 */
  nodeExecutionsSucceededTotal: Counter<string>;
  /** 节点执行时间直方图 */
  nodeExecutionDurationSeconds: Histogram<string>;
  /** 节点输入数据量计数器 */
  nodeInputDataSizeBytes: Counter<string>;
  /** 节点输出数据量计数器 */
  nodeOutputDataSizeBytes: Counter<string>;
  /** 系统内存使用 gauge */
  systemMemoryUsageBytes: Gauge<string>;
  /** 系统 CPU 使用率 gauge */
  systemCpuUsagePercent: Gauge<string>;
  /** 系统磁盘使用 gauge */
  systemDiskUsageBytes: Gauge<string>;
  /** 系统网络流量计数器 */
  systemNetworkBytesTotal: Counter<string>;
}

/**
 * 监控系统执行上下文
 */
export interface MonitoringContext {
  /** 工作流实例 */
  workflow?: Workflow;
  /** 节点 ID */
  nodeId?: string;
  /** 执行状态 */
  status: 'success' | 'error' | 'pending';
  /** 执行时间（毫秒） */
  executionTime?: number;
  /** 内存使用（MB） */
  memoryUsage?: number;
  /** CPU 使用率（百分比） */
  cpuUsage?: number;
  /** 数据处理量（字节） */
  dataProcessed?: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 标签 */
  labels?: Record<string, string>;
}

/**
 * 监控系统事件
 */
export interface MonitoringEvent {
  /** 事件类型 */
  type: 'workflow-start' | 'workflow-end' | 'node-start' | 'node-end' | 'error' | 'system';
  /** 事件时间 */
  timestamp: number;
  /** 事件数据 */
  data: MonitoringContext;
  /** 事件级别 */
  level: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * 监控系统状态
 */
export interface MonitoringStatus {
  /** Prometheus 状态 */
  prometheus: {
    /** 是否运行中 */
    running: boolean;
    /** 指标数量 */
    metricCount: number;
    /** 收集间隔（毫秒） */
    collectionInterval: number;
  };
  /** ELK 状态 */
  elk: {
    /** 是否运行中 */
    running: boolean;
    /** 索引名称 */
    indexName: string;
    /** 日志级别 */
    logLevel: string;
  };
  /** 告警状态 */
  alerts: {
    /** 是否启用 */
    enabled: boolean;
    /** 告警规则数量 */
    ruleCount: number;
    /** 触发的告警数量 */
    activeAlertCount: number;
  };
  /** 系统状态 */
  system: {
    /** 内存使用（MB） */
    memoryUsage: number;
    /** CPU 使用率（百分比） */
    cpuUsage: number;
    /** 磁盘使用（MB） */
    diskUsage: number;
    /** 网络流量（字节/秒） */
    networkTraffic: number;
  };
}
