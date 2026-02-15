import * as promClient from 'prom-client';
import http from 'http';
import type { MonitoringEvent, PrometheusMetrics } from '../types';

/**
 * Prometheus 导出器
 * 负责将工作流性能指标以 Prometheus 格式暴露
 */
export class PrometheusExporter {
  private config: any;
  private server: http.Server | null = null;
  private metrics: PrometheusMetrics;
  private customMetrics: Map<string, promClient.Metric<string>> = new Map();

  /**
   * 构造函数
   * @param config Prometheus 配置选项
   */
  constructor(config: any) {
    this.config = config;
    this.metrics = this.initializeMetrics();
  }

  /**
   * 初始化 Prometheus 指标
   * @returns Prometheus 指标集合
   */
  private initializeMetrics(): PrometheusMetrics {
    const prefix = this.config.metricPrefix;

    return {
      // 工作流执行计数器
      workflowExecutionsTotal: new promClient.Counter({
        name: `${prefix}workflow_executions_total`,
        help: 'Total number of workflow executions',
        labelNames: ['workflow_id', 'workflow_name', 'status'],
      }),

      // 工作流执行失败计数器
      workflowExecutionsFailedTotal: new promClient.Counter({
        name: `${prefix}workflow_executions_failed_total`,
        help: 'Total number of failed workflow executions',
        labelNames: ['workflow_id', 'workflow_name', 'error'],
      }),

      // 工作流执行成功计数器
      workflowExecutionsSucceededTotal: new promClient.Counter({
        name: `${prefix}workflow_executions_succeeded_total`,
        help: 'Total number of succeeded workflow executions',
        labelNames: ['workflow_id', 'workflow_name'],
      }),

      // 工作流执行时间直方图
      workflowExecutionDurationSeconds: new promClient.Histogram({
        name: `${prefix}workflow_execution_duration_seconds`,
        help: 'Workflow execution duration in seconds',
        labelNames: ['workflow_id', 'workflow_name', 'status'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      }),

      // 工作流内存使用 gauge
      workflowMemoryUsageBytes: new promClient.Gauge({
        name: `${prefix}workflow_memory_usage_bytes`,
        help: 'Workflow memory usage in bytes',
        labelNames: ['workflow_id', 'workflow_name'],
      }),

      // 工作流 CPU 使用率 gauge
      workflowCpuUsagePercent: new promClient.Gauge({
        name: `${prefix}workflow_cpu_usage_percent`,
        help: 'Workflow CPU usage in percent',
        labelNames: ['workflow_id', 'workflow_name'],
      }),

      // 工作流数据处理量计数器
      workflowDataProcessedBytes: new promClient.Counter({
        name: `${prefix}workflow_data_processed_bytes`,
        help: 'Total bytes of data processed by workflows',
        labelNames: ['workflow_id', 'workflow_name'],
      }),

      // 节点执行计数器
      nodeExecutionsTotal: new promClient.Counter({
        name: `${prefix}node_executions_total`,
        help: 'Total number of node executions',
        labelNames: ['node_id', 'node_name', 'node_type', 'workflow_id', 'status'],
      }),

      // 节点执行失败计数器
      nodeExecutionsFailedTotal: new promClient.Counter({
        name: `${prefix}node_executions_failed_total`,
        help: 'Total number of failed node executions',
        labelNames: ['node_id', 'node_name', 'node_type', 'workflow_id', 'error'],
      }),

      // 节点执行成功计数器
      nodeExecutionsSucceededTotal: new promClient.Counter({
        name: `${prefix}node_executions_succeeded_total`,
        help: 'Total number of succeeded node executions',
        labelNames: ['node_id', 'node_name', 'node_type', 'workflow_id'],
      }),

      // 节点执行时间直方图
      nodeExecutionDurationSeconds: new promClient.Histogram({
        name: `${prefix}node_execution_duration_seconds`,
        help: 'Node execution duration in seconds',
        labelNames: ['node_id', 'node_name', 'node_type', 'workflow_id', 'status'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      }),

      // 节点输入数据量计数器
      nodeInputDataSizeBytes: new promClient.Counter({
        name: `${prefix}node_input_data_size_bytes`,
        help: 'Total bytes of input data processed by nodes',
        labelNames: ['node_id', 'node_name', 'node_type', 'workflow_id'],
      }),

      // 节点输出数据量计数器
      nodeOutputDataSizeBytes: new promClient.Counter({
        name: `${prefix}node_output_data_size_bytes`,
        help: 'Total bytes of output data processed by nodes',
        labelNames: ['node_id', 'node_name', 'node_type', 'workflow_id'],
      }),

      // 系统内存使用 gauge
      systemMemoryUsageBytes: new promClient.Gauge({
        name: `${prefix}system_memory_usage_bytes`,
        help: 'System memory usage in bytes',
        labelNames: ['component'],
      }),

      // 系统 CPU 使用率 gauge
      systemCpuUsagePercent: new promClient.Gauge({
        name: `${prefix}system_cpu_usage_percent`,
        help: 'System CPU usage in percent',
        labelNames: ['component'],
      }),

      // 系统磁盘使用 gauge
      systemDiskUsageBytes: new promClient.Gauge({
        name: `${prefix}system_disk_usage_bytes`,
        help: 'System disk usage in bytes',
        labelNames: ['mount_point'],
      }),

      // 系统网络流量计数器
      systemNetworkBytesTotal: new promClient.Counter({
        name: `${prefix}system_network_bytes_total`,
        help: 'Total bytes of network traffic',
        labelNames: ['direction'],
      }),
    };
  }

  /**
   * 启动 Prometheus 导出器
   */
  async start(): Promise<void> {
    // 创建 HTTP 服务器
    this.server = http.createServer((req, res) => {
      if (req.url === this.config.path) {
        res.setHeader('Content-Type', promClient.register.contentType);
        res.end(promClient.register.metrics());
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    // 启动服务器
    return new Promise((resolve, reject) => {
      this.server?.listen(this.config.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Prometheus exporter started on port ${this.config.port}, path ${this.config.path}`);
          resolve();
        }
      });
    });
  }

  /**
   * 停止 Prometheus 导出器
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server?.close((error?: Error) => {
          if (error) {
            reject(error);
          } else {
            console.log('Prometheus exporter stopped');
            resolve();
          }
        });
      });
    }
  }

  /**
   * 记录监控事件
   * @param event 监控事件
   */
  recordEvent(event: MonitoringEvent): void {
    switch (event.type) {
      case 'workflow-start':
        this.recordWorkflowStart(event);
        break;
      case 'workflow-end':
        this.recordWorkflowEnd(event);
        break;
      case 'node-start':
        this.recordNodeStart(event);
        break;
      case 'node-end':
        this.recordNodeEnd(event);
        break;
      case 'error':
        this.recordError(event);
        break;
      case 'system':
        this.recordSystemEvent(event);
        break;
    }
  }

  /**
   * 记录工作流开始事件
   * @param event 监控事件
   */
  private recordWorkflowStart(event: MonitoringEvent): void {
    const workflowId = event.data.workflow?.id || 'unknown';
    const workflowName = event.data.workflow?.name || 'unnamed';

    // 增加工作流执行计数器
    this.metrics.workflowExecutionsTotal.inc({
      workflow_id: workflowId,
      workflow_name: workflowName,
      status: event.data.status,
    });
  }

  /**
   * 记录工作流结束事件
   * @param event 监控事件
   */
  private recordWorkflowEnd(event: MonitoringEvent): void {
    const workflowId = event.data.workflow?.id || 'unknown';
    const workflowName = event.data.workflow?.name || 'unnamed';
    const executionTime = event.data.executionTime || 0;
    const memoryUsage = event.data.memoryUsage || 0;
    const cpuUsage = event.data.cpuUsage || 0;
    const dataProcessed = event.data.dataProcessed || 0;

    // 增加工作流执行成功/失败计数器
    if (event.data.status === 'success') {
      this.metrics.workflowExecutionsSucceededTotal.inc({
        workflow_id: workflowId,
        workflow_name: workflowName,
      });
    } else if (event.data.status === 'error') {
      this.metrics.workflowExecutionsFailedTotal.inc({
        workflow_id: workflowId,
        workflow_name: workflowName,
        error: event.data.errorMessage || 'unknown',
      });
    }

    // 记录工作流执行时间
    this.metrics.workflowExecutionDurationSeconds.observe(
      {
        workflow_id: workflowId,
        workflow_name: workflowName,
        status: event.data.status,
      },
      executionTime / 1000 // 转换为秒
    );

    // 记录工作流内存使用
    this.metrics.workflowMemoryUsageBytes.set(
      {
        workflow_id: workflowId,
        workflow_name: workflowName,
      },
      memoryUsage * 1024 * 1024 // 转换为字节
    );

    // 记录工作流 CPU 使用率
    this.metrics.workflowCpuUsagePercent.set(
      {
        workflow_id: workflowId,
        workflow_name: workflowName,
      },
      cpuUsage
    );

    // 记录工作流数据处理量
    if (dataProcessed > 0) {
      this.metrics.workflowDataProcessedBytes.inc(
        {
          workflow_id: workflowId,
          workflow_name: workflowName,
        },
        dataProcessed
      );
    }
  }

  /**
   * 记录节点开始事件
   * @param event 监控事件
   */
  private recordNodeStart(event: MonitoringEvent): void {
    const nodeId = event.data.nodeId || 'unknown';
    const workflowId = event.data.workflow?.id || 'unknown';

    // 增加节点执行计数器
    this.metrics.nodeExecutionsTotal.inc({
      node_id: nodeId,
      node_name: 'unknown', // 占位符
      node_type: 'unknown', // 占位符
      workflow_id: workflowId,
      status: event.data.status,
    });
  }

  /**
   * 记录节点结束事件
   * @param event 监控事件
   */
  private recordNodeEnd(event: MonitoringEvent): void {
    const nodeId = event.data.nodeId || 'unknown';
    const workflowId = event.data.workflow?.id || 'unknown';
    const executionTime = event.data.executionTime || 0;

    // 增加节点执行成功/失败计数器
    if (event.data.status === 'success') {
      this.metrics.nodeExecutionsSucceededTotal.inc({
        node_id: nodeId,
        node_name: 'unknown', // 占位符
        node_type: 'unknown', // 占位符
        workflow_id: workflowId,
      });
    } else if (event.data.status === 'error') {
      this.metrics.nodeExecutionsFailedTotal.inc({
        node_id: nodeId,
        node_name: 'unknown', // 占位符
        node_type: 'unknown', // 占位符
        workflow_id: workflowId,
        error: event.data.errorMessage || 'unknown',
      });
    }

    // 记录节点执行时间
    this.metrics.nodeExecutionDurationSeconds.observe(
      {
        node_id: nodeId,
        node_name: 'unknown', // 占位符
        node_type: 'unknown', // 占位符
        workflow_id: workflowId,
        status: event.data.status,
      },
      executionTime / 1000 // 转换为秒
    );
  }

  /**
   * 记录错误事件
   * @param event 监控事件
   */
  private recordError(event: MonitoringEvent): void {
    const workflowId = event.data.workflow?.id || 'unknown';
    const nodeId = event.data.nodeId || 'unknown';

    // 增加工作流执行失败计数器
    if (!nodeId || nodeId === 'unknown') {
      this.metrics.workflowExecutionsFailedTotal.inc({
        workflow_id: workflowId,
        workflow_name: event.data.workflow?.name || 'unnamed',
        error: event.data.errorMessage || 'unknown',
      });
    }

    // 增加节点执行失败计数器
    if (nodeId && nodeId !== 'unknown') {
      this.metrics.nodeExecutionsFailedTotal.inc({
        node_id: nodeId,
        node_name: 'unknown', // 占位符
        node_type: 'unknown', // 占位符
        workflow_id: workflowId,
        error: event.data.errorMessage || 'unknown',
      });
    }
  }

  /**
   * 记录系统事件
   * @param event 监控事件
   */
  private recordSystemEvent(event: MonitoringEvent): void {
    const memoryUsage = event.data.memoryUsage || 0;
    const cpuUsage = event.data.cpuUsage || 0;
    const dataProcessed = event.data.dataProcessed || 0;

    // 记录系统内存使用
    this.metrics.systemMemoryUsageBytes.set(
      {
        component: 'process',
      },
      memoryUsage * 1024 * 1024 // 转换为字节
    );

    // 记录系统 CPU 使用率
    this.metrics.systemCpuUsagePercent.set(
      {
        component: 'process',
      },
      cpuUsage
    );

    // 记录系统网络流量
    if (dataProcessed > 0) {
      this.metrics.systemNetworkBytesTotal.inc(
        {
          direction: 'outbound',
        },
        dataProcessed
      );
    }
  }

  /**
   * 添加自定义指标
   * @param metric 自定义指标配置
   */
  addCustomMetric(metric: any): void {
    const name = `${this.config.metricPrefix}${metric.name}`;

    let promMetric: promClient.Metric<string>;

    switch (metric.type) {
      case 'counter':
        promMetric = new promClient.Counter({
          name,
          help: metric.description,
          labelNames: metric.labels,
        });
        break;

      case 'gauge':
        promMetric = new promClient.Gauge({
          name,
          help: metric.description,
          labelNames: metric.labels,
        });
        break;

      case 'histogram':
        promMetric = new promClient.Histogram({
          name,
          help: metric.description,
          labelNames: metric.labels,
          buckets: metric.buckets,
        });
        break;

      case 'summary':
        promMetric = new promClient.Summary({
          name,
          help: metric.description,
          labelNames: metric.labels,
          percentiles: metric.percentiles,
        });
        break;

      default:
        throw new Error(`Unknown metric type: ${metric.type}`);
    }

    this.customMetrics.set(metric.name, promMetric);
  }

  /**
   * 获取指标数量
   * @returns 指标数量
   */
  getMetricCount(): number {
    return Object.keys(this.metrics).length + this.customMetrics.size;
  }

  /**
   * 获取 Prometheus 指标集合
   * @returns Prometheus 指标集合
   */
  getMetrics(): PrometheusMetrics {
    return this.metrics;
  }

  /**
   * 获取自定义指标
   * @returns 自定义指标映射
   */
  getCustomMetrics(): Map<string, promClient.Metric<string>> {
    return this.customMetrics;
  }
}

/**
 * 创建 Prometheus 导出器实例的工厂函数
 * @param config Prometheus 配置选项
 * @returns Prometheus 导出器实例
 */
export function createPrometheusExporter(config: any): PrometheusExporter {
  return new PrometheusExporter(config);
}