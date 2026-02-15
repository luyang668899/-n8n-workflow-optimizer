import type { Workflow } from 'n8n-workflow';
import type { WorkflowFeatures, ResourceDataPoint } from '../types';

/**
 * 特征提取器
 * 负责从工作流和历史数据中提取特征
 */
export class FeatureExtractor {
  /**
   * 从工作流中提取特征
   * @param workflowId 工作流ID
   * @param workflow 工作流实例
   * @returns 工作流特征
   */
  async extractFromWorkflow(workflowId: string, workflow?: Workflow): Promise<WorkflowFeatures> {
    // 基础特征
    const baseFeatures = {
      workflowId,
      workflowName: workflow?.name || 'Unknown Workflow',
      nodeCount: workflow?.nodes.length || 0,
      connectionCount: workflow?.connections.length || 0,
      triggerType: this.extractTriggerType(workflow),
      averageExecutionTime: 0,
      executionFrequency: 0,
      failureRate: 0,
      averageDataProcessed: 0,
      averageMemoryUsage: 0,
      averageCpuUsage: 0,
      averageNetworkTraffic: 0,
      averageStorageUsage: 0,
      nodeTypeDistribution: this.extractNodeTypeDistribution(workflow),
      executionTimeDistribution: {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        std: 0,
      },
    };

    return baseFeatures;
  }

  /**
   * 从历史数据中提取特征
   * @param workflowId 工作流ID
   * @param historicalData 历史数据
   * @returns 工作流特征
   */
  async extractFromHistoricalData(workflowId: string, historicalData: ResourceDataPoint[]): Promise<WorkflowFeatures> {
    if (historicalData.length === 0) {
      return {
        workflowId,
        workflowName: 'Unknown Workflow',
        nodeCount: 0,
        connectionCount: 0,
        triggerType: 'unknown',
        averageExecutionTime: 0,
        executionFrequency: 0,
        failureRate: 0,
        averageDataProcessed: 0,
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        averageNetworkTraffic: 0,
        averageStorageUsage: 0,
        nodeTypeDistribution: {},
        executionTimeDistribution: {
          min: 0,
          max: 0,
          mean: 0,
          median: 0,
          std: 0,
        },
      };
    }

    // 计算平均值
    const averageExecutionTime = historicalData
      .filter(d => d.executionTime)
      .reduce((sum, d) => sum + (d.executionTime || 0), 0) / historicalData.length;

    const averageDataProcessed = historicalData
      .filter(d => d.dataProcessed)
      .reduce((sum, d) => sum + (d.dataProcessed || 0), 0) / historicalData.length;

    const averageMemoryUsage = historicalData.reduce((sum, d) => sum + d.memoryUsage, 0) / historicalData.length;
    const averageCpuUsage = historicalData.reduce((sum, d) => sum + d.cpuUsage, 0) / historicalData.length;
    const averageNetworkTraffic = historicalData.reduce((sum, d) => sum + d.networkTraffic, 0) / historicalData.length;
    const averageStorageUsage = historicalData.reduce((sum, d) => sum + d.storageUsage, 0) / historicalData.length;

    // 计算执行频率（假设数据是最近一天的）
    const executionFrequency = historicalData.length;

    // 计算失败率
    const failureCount = historicalData.filter(d => d.status === 'error').length;
    const failureRate = failureCount / historicalData.length;

    // 计算执行时间分布
    const executionTimes = historicalData.filter(d => d.executionTime).map(d => d.executionTime || 0);
    const executionTimeDistribution = this.calculateDistribution(executionTimes);

    return {
      workflowId,
      workflowName: 'Unknown Workflow',
      nodeCount: 0,
      connectionCount: 0,
      triggerType: 'unknown',
      averageExecutionTime,
      executionFrequency,
      failureRate,
      averageDataProcessed,
      averageMemoryUsage,
      averageCpuUsage,
      averageNetworkTraffic,
      averageStorageUsage,
      nodeTypeDistribution: {},
      executionTimeDistribution,
    };
  }

  /**
   * 从工作流和历史数据中提取综合特征
   * @param workflowId 工作流ID
   * @param workflow 工作流实例
   * @param historicalData 历史数据
   * @returns 工作流特征
   */
  async extractCombinedFeatures(workflowId: string, workflow?: Workflow, historicalData?: ResourceDataPoint[]): Promise<WorkflowFeatures> {
    const workflowFeatures = await this.extractFromWorkflow(workflowId, workflow);

    if (historicalData && historicalData.length > 0) {
      const historicalFeatures = await this.extractFromHistoricalData(workflowId, historicalData);

      // 合并特征
      return {
        ...workflowFeatures,
        averageExecutionTime: historicalFeatures.averageExecutionTime,
        executionFrequency: historicalFeatures.executionFrequency,
        failureRate: historicalFeatures.failureRate,
        averageDataProcessed: historicalFeatures.averageDataProcessed,
        averageMemoryUsage: historicalFeatures.averageMemoryUsage,
        averageCpuUsage: historicalFeatures.averageCpuUsage,
        averageNetworkTraffic: historicalFeatures.averageNetworkTraffic,
        averageStorageUsage: historicalFeatures.averageStorageUsage,
        executionTimeDistribution: historicalFeatures.executionTimeDistribution,
      };
    }

    return workflowFeatures;
  }

  /**
   * 提取触发器类型
   * @param workflow 工作流实例
   * @returns 触发器类型
   */
  private extractTriggerType(workflow?: Workflow): string {
    if (!workflow || !workflow.nodes) {
      return 'unknown';
    }

    const triggerNode = workflow.nodes.find(node => node.type.includes('trigger'));
    return triggerNode?.type || 'unknown';
  }

  /**
   * 提取节点类型分布
   * @param workflow 工作流实例
   * @returns 节点类型分布
   */
  private extractNodeTypeDistribution(workflow?: Workflow): Record<string, number> {
    const distribution: Record<string, number> = {};

    if (!workflow || !workflow.nodes) {
      return distribution;
    }

    workflow.nodes.forEach(node => {
      const type = node.type;
      distribution[type] = (distribution[type] || 0) + 1;
    });

    return distribution;
  }

  /**
   * 计算分布统计
   * @param values 数值数组
   * @returns 分布统计
   */
  private calculateDistribution(values: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    std: number;
  } {
    if (values.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        std: 0,
      };
    }

    const sorted = values.sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);

    return {
      min,
      max,
      mean,
      median,
      std,
    };
  }
}
