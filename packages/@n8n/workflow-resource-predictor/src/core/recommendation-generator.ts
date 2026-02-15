import type { ResourcePrediction, WorkflowFeatures, ResourceAlert, ResourceRecommendation } from '../types';

/**
 * 建议生成器
 * 负责根据预测结果和预警生成资源需求建议
 */
export class RecommendationGenerator {
  private config: {
    enabled: boolean;
    generationFrequency: number;
    maxRecommendations: number;
  };

  /**
   * 构造函数
   * @param config 建议配置
   */
  constructor(config: {
    enabled: boolean;
    generationFrequency: number;
    maxRecommendations: number;
  }) {
    this.config = config;
  }

  /**
   * 生成建议
   * @param predictions 预测结果
   * @param workflowFeatures 工作流特征
   * @param alerts 预警列表
   * @returns 建议列表
   */
  generate(
    predictions: ResourcePrediction[],
    workflowFeatures: WorkflowFeatures,
    alerts: ResourceAlert[]
  ): ResourceRecommendation[] {
    if (!this.config.enabled || predictions.length === 0) {
      return [];
    }

    const recommendations: ResourceRecommendation[] = [];

    // 基于预警生成建议
    this.generateAlertsBasedRecommendations(alerts, workflowFeatures, recommendations);

    // 基于预测趋势生成建议
    this.generateTrendBasedRecommendations(predictions, workflowFeatures, recommendations);

    // 基于工作流特征生成建议
    this.generateFeatureBasedRecommendations(workflowFeatures, recommendations);

    // 排序并限制建议数量
    return this.sortAndLimitRecommendations(recommendations);
  }

  /**
   * 基于预警生成建议
   * @param alerts 预警列表
   * @param workflowFeatures 工作流特征
   * @param recommendations 建议列表
   */
  private generateAlertsBasedRecommendations(
    alerts: ResourceAlert[],
    workflowFeatures: WorkflowFeatures,
    recommendations: ResourceRecommendation[]
  ): void {
    alerts.forEach(alert => {
      let recommendation: ResourceRecommendation | undefined;

      switch (alert.alertType) {
        case 'memory':
          recommendation = this.generateMemoryRecommendation(alert, workflowFeatures);
          break;
        case 'cpu':
          recommendation = this.generateCpuRecommendation(alert, workflowFeatures);
          break;
        case 'network':
          recommendation = this.generateNetworkRecommendation(alert, workflowFeatures);
          break;
        case 'storage':
          recommendation = this.generateStorageRecommendation(alert, workflowFeatures);
          break;
      }

      if (recommendation) {
        recommendations.push(recommendation);
      }
    });
  }

  /**
   * 基于预测趋势生成建议
   * @param predictions 预测结果
   * @param workflowFeatures 工作流特征
   * @param recommendations 建议列表
   */
  private generateTrendBasedRecommendations(
    predictions: ResourcePrediction[],
    workflowFeatures: WorkflowFeatures,
    recommendations: ResourceRecommendation[]
  ): void {
    // 分析内存使用趋势
    const memoryTrend = this.analyzeTrend(predictions.map(p => p.memoryUsage));
    if (memoryTrend > 0.1) { // 内存使用呈上升趋势
      recommendations.push({
        recommendationId: `rec-memory-trend-${Date.now()}`,
        type: 'memory',
        description: '内存使用呈上升趋势，建议优化内存配置',
        details: `基于预测分析，内存使用在未来将持续增长，增长率为 ${(memoryTrend * 100).toFixed(2)}%。建议检查工作流中的内存密集型操作并进行优化。`,
        expectedPerformanceGain: 15,
        complexity: 'medium',
        costImpact: 'low',
        priority: 'medium',
        relatedPredictions: predictions,
      });
    }

    // 分析CPU使用趋势
    const cpuTrend = this.analyzeTrend(predictions.map(p => p.cpuUsage));
    if (cpuTrend > 0.15) { // CPU使用呈显著上升趋势
      recommendations.push({
        recommendationId: `rec-cpu-trend-${Date.now()}`,
        type: 'cpu',
        description: 'CPU使用呈显著上升趋势，建议优化CPU密集型操作',
        details: `基于预测分析，CPU使用在未来将持续增长，增长率为 ${(cpuTrend * 100).toFixed(2)}%。建议检查工作流中的CPU密集型节点并进行优化。`,
        expectedPerformanceGain: 20,
        complexity: 'medium',
        costImpact: 'low',
        priority: 'high',
        relatedPredictions: predictions,
      });
    }
  }

  /**
   * 基于工作流特征生成建议
   * @param workflowFeatures 工作流特征
   * @param recommendations 建议列表
   */
  private generateFeatureBasedRecommendations(
    workflowFeatures: WorkflowFeatures,
    recommendations: ResourceRecommendation[]
  ): void {
    // 基于节点数量
    if (workflowFeatures.nodeCount > 50) {
      recommendations.push({
        recommendationId: `rec-node-count-${Date.now()}`,
        type: 'general',
        description: '工作流节点数量较多，建议拆分工作流',
        details: `当前工作流包含 ${workflowFeatures.nodeCount} 个节点，可能导致性能瓶颈。建议将工作流拆分为多个较小的工作流，以提高执行效率和可维护性。`,
        expectedPerformanceGain: 25,
        complexity: 'high',
        costImpact: 'low',
        priority: 'medium',
        relatedPredictions: [],
      });
    }

    // 基于执行频率
    if (workflowFeatures.executionFrequency > 100) {
      recommendations.push({
        recommendationId: `rec-execution-frequency-${Date.now()}`,
        type: 'general',
        description: '工作流执行频率较高，建议优化执行策略',
        details: `当前工作流执行频率为 ${workflowFeatures.executionFrequency} 次/天，可能导致系统负载过高。建议考虑批量处理或优化触发器配置，以减少执行次数。`,
        expectedPerformanceGain: 15,
        complexity: 'medium',
        costImpact: 'low',
        priority: 'medium',
        relatedPredictions: [],
      });
    }

    // 基于失败率
    if (workflowFeatures.failureRate > 0.1) {
      recommendations.push({
        recommendationId: `rec-failure-rate-${Date.now()}`,
        type: 'general',
        description: '工作流失败率较高，建议优化错误处理',
        details: `当前工作流失败率为 ${(workflowFeatures.failureRate * 100).toFixed(2)}%，可能导致资源浪费和性能下降。建议增加错误处理节点和重试机制，以提高工作流的稳定性。`,
        expectedPerformanceGain: 10,
        complexity: 'medium',
        costImpact: 'low',
        priority: 'high',
        relatedPredictions: [],
      });
    }
  }

  /**
   * 生成内存相关建议
   * @param alert 预警
   * @param workflowFeatures 工作流特征
   * @returns 内存建议
   */
  private generateMemoryRecommendation(
    alert: ResourceAlert,
    workflowFeatures: WorkflowFeatures
  ): ResourceRecommendation {
    return {
      recommendationId: `rec-memory-${Date.now()}`,
      type: 'memory',
      description: '内存使用将超过阈值，建议增加内存资源或优化配置',
      details: `基于预警分析，内存使用预计将达到 ${alert.currentValue.toFixed(2)} MB，超过阈值 ${alert.threshold} MB。${alert.recommendedAction}`,
      expectedPerformanceGain: 20,
      complexity: alert.severity === 'critical' ? 'high' : 'medium',
      costImpact: 'medium',
      priority: alert.severity === 'critical' ? 'high' : 'medium',
      relatedPredictions: [],
    };
  }

  /**
   * 生成CPU相关建议
   * @param alert 预警
   * @param workflowFeatures 工作流特征
   * @returns CPU建议
   */
  private generateCpuRecommendation(
    alert: ResourceAlert,
    workflowFeatures: WorkflowFeatures
  ): ResourceRecommendation {
    return {
      recommendationId: `rec-cpu-${Date.now()}`,
      type: 'cpu',
      description: 'CPU使用率将超过阈值，建议增加CPU资源或优化配置',
      details: `基于预警分析，CPU使用率预计将达到 ${alert.currentValue.toFixed(2)}%，超过阈值 ${alert.threshold}%。${alert.recommendedAction}`,
      expectedPerformanceGain: 25,
      complexity: alert.severity === 'critical' ? 'high' : 'medium',
      costImpact: 'medium',
      priority: alert.severity === 'critical' ? 'high' : 'medium',
      relatedPredictions: [],
    };
  }

  /**
   * 生成网络相关建议
   * @param alert 预警
   * @param workflowFeatures 工作流特征
   * @returns 网络建议
   */
  private generateNetworkRecommendation(
    alert: ResourceAlert,
    workflowFeatures: WorkflowFeatures
  ): ResourceRecommendation {
    return {
      recommendationId: `rec-network-${Date.now()}`,
      type: 'network',
      description: '网络流量将超过阈值，建议优化数据传输或增加带宽',
      details: `基于预警分析，网络流量预计将达到 ${(alert.currentValue / (1024 * 1024)).toFixed(2)} MB/s，超过阈值 ${(alert.threshold / (1024 * 1024)).toFixed(2)} MB/s。${alert.recommendedAction}`,
      expectedPerformanceGain: 15,
      complexity: 'medium',
      costImpact: 'medium',
      priority: 'medium',
      relatedPredictions: [],
    };
  }

  /**
   * 生成存储相关建议
   * @param alert 预警
   * @param workflowFeatures 工作流特征
   * @returns 存储建议
   */
  private generateStorageRecommendation(
    alert: ResourceAlert,
    workflowFeatures: WorkflowFeatures
  ): ResourceRecommendation {
    return {
      recommendationId: `rec-storage-${Date.now()}`,
      type: 'storage',
      description: '存储使用将超过阈值，建议清理空间或增加存储容量',
      details: `基于预警分析，存储使用预计将达到 ${alert.currentValue.toFixed(2)} MB，超过阈值 ${alert.threshold} MB。${alert.recommendedAction}`,
      expectedPerformanceGain: 10,
      complexity: 'low',
      costImpact: 'medium',
      priority: 'low',
      relatedPredictions: [],
    };
  }

  /**
   * 分析趋势
   * @param values 数值数组
   * @returns 趋势值
   */
  private analyzeTrend(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const trend = (lastValue - firstValue) / firstValue;

    return trend;
  }

  /**
   * 排序并限制建议数量
   * @param recommendations 建议列表
   * @returns 排序后的建议列表
   */
  private sortAndLimitRecommendations(recommendations: ResourceRecommendation[]): ResourceRecommendation[] {
    // 排序：优先级 > 预期性能提升 > 复杂度
    recommendations.sort((a, b) => {
      // 优先级排序
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // 预期性能提升排序
      const performanceDiff = b.expectedPerformanceGain - a.expectedPerformanceGain;
      if (performanceDiff !== 0) {
        return performanceDiff;
      }

      // 复杂度排序（低复杂度优先）
      const complexityOrder = { low: 1, medium: 2, high: 3 };
      return complexityOrder[a.complexity] - complexityOrder[b.complexity];
    });

    // 限制建议数量
    return recommendations.slice(0, this.config.maxRecommendations);
  }
}
