import { Client } from '@elastic/elasticsearch';
import type { MonitoringEvent, ElkConfig } from '../types';

/**
 * ELK 集成
 * 负责将工作流执行日志和性能数据发送到 ELK Stack
 */
export class ElkIntegration {
  private config: ElkConfig;
  private client: Client | null = null;
  private isRunning: boolean = false;

  /**
   * 构造函数
   * @param config ELK 配置选项
   */
  constructor(config: ElkConfig) {
    this.config = config;
  }

  /**
   * 启动 ELK 集成
   */
  async start(): Promise<void> {
    try {
      // 创建 Elasticsearch 客户端
      this.client = new Client({
        nodes: this.config.nodes,
        auth: this.config.auth,
        tls: this.config.tls,
      });

      // 检查连接
      await this.client.ping();
      console.log('Connected to Elasticsearch');

      // 创建索引（如果不存在）
      await this.createIndexIfNotExists();

      this.isRunning = true;
      console.log('ELK integration started');
    } catch (error) {
      console.error('Failed to start ELK integration:', error);
      throw error;
    }
  }

  /**
   * 停止 ELK 集成
   */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.isRunning = false;
    console.log('ELK integration stopped');
  }

  /**
   * 记录监控事件
   * @param event 监控事件
   */
  async recordEvent(event: MonitoringEvent): Promise<void> {
    if (!this.isRunning || !this.client) {
      return;
    }

    try {
      // 构建日志文档
      const logDocument = this.buildLogDocument(event);

      // 发送到 Elasticsearch
      await this.client.index({
        index: this.config.indexName,
        body: logDocument,
      });
    } catch (error) {
      console.warn('Failed to send event to ELK:', error);
    }
  }

  /**
   * 构建日志文档
   * @param event 监控事件
   * @returns 日志文档
   */
  private buildLogDocument(event: MonitoringEvent): any {
    const timestamp = new Date(event.timestamp).toISOString();

    const baseDocument = {
      '@timestamp': timestamp,
      event_type: event.type,
      level: event.level || 'info',
      message: this.generateLogMessage(event),
      workflow: event.data.workflow,
      node_id: event.data.nodeId,
      status: event.data.status,
      execution_time: event.data.executionTime,
      memory_usage: event.data.memoryUsage,
      cpu_usage: event.data.cpuUsage,
      data_processed: event.data.dataProcessed,
      error_message: event.data.errorMessage,
      labels: event.data.labels,
      metadata: event.data.metadata,
    };

    // 根据事件类型添加特定字段
    switch (event.type) {
      case 'workflow-start':
        return {
          ...baseDocument,
          event_subtype: 'workflow_start',
          workflow_id: event.data.workflow?.id,
          workflow_name: event.data.workflow?.name,
        };

      case 'workflow-end':
        return {
          ...baseDocument,
          event_subtype: 'workflow_end',
          workflow_id: event.data.workflow?.id,
          workflow_name: event.data.workflow?.name,
          execution_status: event.data.status,
          duration_ms: event.data.executionTime,
        };

      case 'node-start':
        return {
          ...baseDocument,
          event_subtype: 'node_start',
          node_id: event.data.nodeId,
          node_name: event.data.nodeName,
          node_type: event.data.nodeType,
          workflow_id: event.data.workflow?.id,
        };

      case 'node-end':
        return {
          ...baseDocument,
          event_subtype: 'node_end',
          node_id: event.data.nodeId,
          node_name: event.data.nodeName,
          node_type: event.data.nodeType,
          workflow_id: event.data.workflow?.id,
          execution_status: event.data.status,
          duration_ms: event.data.executionTime,
        };

      case 'error':
        return {
          ...baseDocument,
          event_subtype: 'error',
          error_type: event.data.errorType,
          error_stack: event.data.errorStack,
          workflow_id: event.data.workflow?.id,
          node_id: event.data.nodeId,
        };

      case 'system':
        return {
          ...baseDocument,
          event_subtype: 'system',
          component: event.data.labels?.component,
          host: event.data.labels?.host,
        };

      default:
        return baseDocument;
    }
  }

  /**
   * 生成日志消息
   * @param event 监控事件
   * @returns 日志消息
   */
  private generateLogMessage(event: MonitoringEvent): string {
    switch (event.type) {
      case 'workflow-start':
        return `Workflow ${event.data.workflow?.name || 'unnamed'} (${event.data.workflow?.id || 'unknown'}) started`;

      case 'workflow-end':
        return `Workflow ${event.data.workflow?.name || 'unnamed'} (${event.data.workflow?.id || 'unknown'}) completed with status ${event.data.status} in ${event.data.executionTime || 0}ms`;

      case 'node-start':
        return `Node ${event.data.nodeName || 'unnamed'} (${event.data.nodeId || 'unknown'}) started execution`;

      case 'node-end':
        return `Node ${event.data.nodeName || 'unnamed'} (${event.data.nodeId || 'unknown'}) completed with status ${event.data.status} in ${event.data.executionTime || 0}ms`;

      case 'error':
        return `Error: ${event.data.errorMessage || 'Unknown error'} in ${event.data.nodeId ? `node ${event.data.nodeId}` : `workflow ${event.data.workflow?.name}`}`;

      case 'system':
        return `System event: ${event.data.labels?.component || 'unknown'} on ${event.data.labels?.host || 'unknown'}`;

      default:
        return `Monitoring event: ${event.type}`;
    }
  }

  /**
   * 创建索引（如果不存在）
   */
  private async createIndexIfNotExists(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const indexExists = await this.client.indices.exists({
        index: this.config.indexName,
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.config.indexName,
          body: {
            mappings: {
              properties: {
                '@timestamp': {
                  type: 'date',
                },
                event_type: {
                  type: 'keyword',
                },
                event_subtype: {
                  type: 'keyword',
                },
                level: {
                  type: 'keyword',
                },
                message: {
                  type: 'text',
                },
                workflow: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'keyword',
                    },
                    name: {
                      type: 'keyword',
                    },
                  },
                },
                node_id: {
                  type: 'keyword',
                },
                node_name: {
                  type: 'keyword',
                },
                node_type: {
                  type: 'keyword',
                },
                status: {
                  type: 'keyword',
                },
                execution_time: {
                  type: 'long',
                },
                memory_usage: {
                  type: 'long',
                },
                cpu_usage: {
                  type: 'float',
                },
                data_processed: {
                  type: 'long',
                },
                error_message: {
                  type: 'text',
                },
                error_type: {
                  type: 'keyword',
                },
                error_stack: {
                  type: 'text',
                },
                labels: {
                  type: 'object',
                  dynamic: true,
                },
                metadata: {
                  type: 'object',
                  dynamic: true,
                },
              },
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 1,
            },
          },
        });
        console.log(`Created index: ${this.config.indexName}`);
      }
    } catch (error) {
      console.warn('Failed to create index:', error);
    }
  }

  /**
   * 搜索日志
   * @param query 搜索查询
   * @param size 结果大小
   * @returns 搜索结果
   */
  async searchLogs(query: any, size: number = 10): Promise<any> {
    if (!this.isRunning || !this.client) {
      throw new Error('ELK integration is not running');
    }

    try {
      const response = await this.client.search({
        index: this.config.indexName,
        body: {
          query,
          size,
          sort: [
            {
              '@timestamp': {
                order: 'desc',
              },
            },
          ],
        },
      });

      return response.hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      console.error('Failed to search logs:', error);
      throw error;
    }
  }

  /**
   * 获取工作流执行统计
   * @param workflowId 工作流 ID
   * @param timeRange 时间范围
   * @returns 执行统计
   */
  async getWorkflowStats(workflowId: string, timeRange: string = '24h'): Promise<any> {
    if (!this.isRunning || !this.client) {
      throw new Error('ELK integration is not running');
    }

    try {
      const response = await this.client.search({
        index: this.config.indexName,
        body: {
          query: {
            bool: {
              must: [
                {
                  match: {
                    'workflow.id': workflowId,
                  },
                },
                {
                  range: {
                    '@timestamp': {
                      gte: `now-${timeRange}`,
                    },
                  },
                },
              ],
            },
          },
          aggs: {
            total_executions: {
              value_count: {
                field: 'event_type',
              },
            },
            status_count: {
              terms: {
                field: 'status',
              },
            },
            avg_execution_time: {
              avg: {
                field: 'execution_time',
              },
            },
            max_execution_time: {
              max: {
                field: 'execution_time',
              },
            },
            min_execution_time: {
              min: {
                field: 'execution_time',
              },
            },
          },
        },
      });

      return {
        totalExecutions: response.aggregations.total_executions.value,
        statusCount: response.aggregations.status_count.buckets,
        avgExecutionTime: response.aggregations.avg_execution_time.value,
        maxExecutionTime: response.aggregations.max_execution_time.value,
        minExecutionTime: response.aggregations.min_execution_time.value,
      };
    } catch (error) {
      console.error('Failed to get workflow stats:', error);
      throw error;
    }
  }

  /**
   * 获取节点执行统计
   * @param nodeId 节点 ID
   * @param timeRange 时间范围
   * @returns 执行统计
   */
  async getNodeStats(nodeId: string, timeRange: string = '24h'): Promise<any> {
    if (!this.isRunning || !this.client) {
      throw new Error('ELK integration is not running');
    }

    try {
      const response = await this.client.search({
        index: this.config.indexName,
        body: {
          query: {
            bool: {
              must: [
                {
                  match: {
                    node_id: nodeId,
                  },
                },
                {
                  range: {
                    '@timestamp': {
                      gte: `now-${timeRange}`,
                    },
                  },
                },
              ],
            },
          },
          aggs: {
            total_executions: {
              value_count: {
                field: 'event_type',
              },
            },
            status_count: {
              terms: {
                field: 'status',
              },
            },
            avg_execution_time: {
              avg: {
                field: 'execution_time',
              },
            },
            max_execution_time: {
              max: {
                field: 'execution_time',
              },
            },
            min_execution_time: {
              min: {
                field: 'execution_time',
              },
            },
          },
        },
      });

      return {
        totalExecutions: response.aggregations.total_executions.value,
        statusCount: response.aggregations.status_count.buckets,
        avgExecutionTime: response.aggregations.avg_execution_time.value,
        maxExecutionTime: response.aggregations.max_execution_time.value,
        minExecutionTime: response.aggregations.min_execution_time.value,
      };
    } catch (error) {
      console.error('Failed to get node stats:', error);
      throw error;
    }
  }

  /**
   * 清理旧日志
   * @param olderThan 清理早于指定时间的日志
   */
  async cleanOldLogs(olderThan: string = '30d'): Promise<void> {
    if (!this.isRunning || !this.client) {
      return;
    }

    try {
      await this.client.deleteByQuery({
        index: this.config.indexName,
        body: {
          query: {
            range: {
              '@timestamp': {
                lt: `now-${olderThan}`,
              },
            },
          },
        },
      });
      console.log(`Cleaned logs older than ${olderThan}`);
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * 获取 ELK 集成状态
   * @returns 状态信息
   */
  getStatus(): any {
    return {
      running: this.isRunning,
      nodes: this.config.nodes,
      indexName: this.config.indexName,
      logLevel: this.config.logLevel,
    };
  }
}

/**
 * 创建 ELK 集成实例的工厂函数
 * @param config ELK 配置选项
 * @returns ELK 集成实例
 */
export function createElkIntegration(config: ElkConfig): ElkIntegration {
  return new ElkIntegration(config);
}
