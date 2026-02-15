import type { ResourcePrediction, WorkflowFeatures, ResourceAlert } from '../types';

/**
 * 预警生成器
 * 负责根据预测结果生成资源预警
 */
export class AlertGenerator {
  private config: {
    enabled: boolean;
    memoryThreshold: number;
    cpuThreshold: number;
    networkThreshold: number;
    storageThreshold: number;
    alertAdvanceTime: number;
  };

  /**
   * 构造函数
   * @param config 预警配置
   */
  constructor(config: {
    enabled: boolean;
    memoryThreshold: number;
    cpuThreshold: number;
    networkThreshold: number;
    storageThreshold: number;
    alertAdvanceTime: number;
  }) {
    this.config = config;
  }

  /**
   * 生成预警
   * @param predictions 预测结果
   * @param workflowFeatures 工作流特征
   * @returns 预警列表
   */
  generate(predictions: ResourcePrediction[], workflowFeatures: WorkflowFeatures): ResourceAlert[] {
    if (!this.config.enabled || predictions.length === 0) {
      return [];
    }

    const alerts: ResourceAlert[] = [];

    // 检查每个预测点
    predictions.forEach(prediction => {
      // 检查内存使用
      this.checkMemoryUsage(prediction, workflowFeatures, alerts);

      // 检查CPU使用
      this.checkCpuUsage(prediction, workflowFeatures, alerts);

      // 检查网络流量
      this.checkNetworkTraffic(prediction, workflowFeatures, alerts);

      // 检查存储使用
      this.checkStorageUsage(prediction, workflowFeatures, alerts);
    });

    return alerts;
  }

  /**
   * 检查内存使用并生成预警
   * @param prediction 预测结果
   * @param workflowFeatures 工作流特征
   * @param alerts 预警列表
   */
  private checkMemoryUsage(
    prediction: ResourcePrediction,
    workflowFeatures: WorkflowFeatures,
    alerts: ResourceAlert[]
  ): void {
    if (prediction.memoryUsage > this.config.memoryThreshold) {
      const severity = this.calculateSeverity(prediction.memoryUsage, this.config.memoryThreshold);
      const alert: ResourceAlert = {
        alertId: `alert-memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        alertType: 'memory',
        severity,
        message: `内存使用预测将超过阈值: ${prediction.memoryUsage.toFixed(2)} MB (阈值: ${this.config.memoryThreshold} MB)`,
        timestamp: Date.now(),
        predictedTimestamp: prediction.timestamp,
        currentValue: prediction.memoryUsage,
        threshold: this.config.memoryThreshold,
        workflowId: workflowFeatures.workflowId,
        recommendedAction: this.getMemoryRecommendation(prediction.memoryUsage, workflowFeatures),
      };
      alerts.push(alert);
    }
  }

  /**
   * 检查CPU使用并生成预警
   * @param prediction 预测结果
   * @param workflowFeatures 工作流特征
   * @param alerts 预警列表
   */
  private checkCpuUsage(
    prediction: ResourcePrediction,
    workflowFeatures: WorkflowFeatures,
    alerts: ResourceAlert[]
  ): void {
    if (prediction.cpuUsage > this.config.cpuThreshold) {
      const severity = this.calculateSeverity(prediction.cpuUsage, this.config.cpuThreshold);
      const alert: ResourceAlert = {
        alertId: `alert-cpu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        alertType: 'cpu',
        severity,
        message: `CPU使用率预测将超过阈值: ${prediction.cpuUsage.toFixed(2)}% (阈值: ${this.config.cpuThreshold}%)`,
        timestamp: Date.now(),
        predictedTimestamp: prediction.timestamp,
        currentValue: prediction.cpuUsage,
        threshold: this.config.cpuThreshold,
        workflowId: workflowFeatures.workflowId,
        recommendedAction: this.getCpuRecommendation(prediction.cpuUsage, workflowFeatures),
      };
      alerts.push(alert);
    }
  }

  /**
   * 检查网络流量并生成预警
   * @param prediction 预测结果
   * @param workflowFeatures 工作流特征
   * @param alerts 预警列表
   */
  private checkNetworkTraffic(
    prediction: ResourcePrediction,
    workflowFeatures: WorkflowFeatures,
    alerts: ResourceAlert[]
  ): void {
    if (prediction.networkTraffic > this.config.networkThreshold) {
      const severity = this.calculateSeverity(prediction.networkTraffic, this.config.networkThreshold);
      const alert: ResourceAlert = {
        alertId: `alert-network-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        alertType: 'network',
        severity,
        message: `网络流量预测将超过阈值: ${(prediction.networkTraffic / (1024 * 1024)).toFixed(2)} MB/s (阈值: ${(this.config.networkThreshold / (1024 * 1024)).toFixed(2)} MB/s)`,
        timestamp: Date.now(),
        predictedTimestamp: prediction.timestamp,
        currentValue: prediction.networkTraffic,
        threshold: this.config.networkThreshold,
        workflowId: workflowFeatures.workflowId,
        recommendedAction: this.getNetworkRecommendation(prediction.networkTraffic, workflowFeatures),
      };
      alerts.push(alert);
    }
  }

  /**
   * 检查存储使用并生成预警
   * @param prediction 预测结果
   * @param workflowFeatures 工作流特征
   * @param alerts 预警列表
   */
  private checkStorageUsage(
    prediction: ResourcePrediction,
    workflowFeatures: WorkflowFeatures,
    alerts: ResourceAlert[]
  ): void {
    if (prediction.storageUsage > this.config.storageThreshold) {
      const severity = this.calculateSeverity(prediction.storageUsage, this.config.storageThreshold);
      const alert: ResourceAlert = {
        alertId: `alert-storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        alertType: 'storage',
        severity,
        message: `存储使用预测将超过阈值: ${prediction.storageUsage.toFixed(2)} MB (阈值: ${this.config.storageThreshold} MB)`,
        timestamp: Date.now(),
        predictedTimestamp: prediction.timestamp,
        currentValue: prediction.storageUsage,
        threshold: this.config.storageThreshold,
        workflowId: workflowFeatures.workflowId,
        recommendedAction: this.getStorageRecommendation(prediction.storageUsage, workflowFeatures),
      };
      alerts.push(alert);
    }
  }

  /**
   * 计算预警严重程度
   * @param value 当前值
   * @param threshold 阈值
   * @returns 严重程度
   */
  private calculateSeverity(value: number, threshold: number): 'info' | 'warning' | 'error' | 'critical' {
    const ratio = value / threshold;
    if (ratio < 1.1) {
      return 'info';
    } else if (ratio < 1.3) {
      return 'warning';
    } else if (ratio < 1.5) {
      return 'error';
    } else {
      return 'critical';
    }
  }

  /**
   * 获取内存使用建议
   * @param memoryUsage 内存使用
   * @param workflowFeatures 工作流特征
   * @returns 建议操作
   */
  private getMemoryRecommendation(memoryUsage: number, workflowFeatures: WorkflowFeatures): string {
    if (workflowFeatures.nodeCount > 50) {
      return '考虑拆分工作流为多个较小的工作流，减少单个工作流的节点数量';
    } else if (workflowFeatures.averageDataProcessed > 100 * 1024 * 1024) {
      return '考虑增加数据处理的批处理大小，减少内存中的数据量';
    } else {
      return '考虑增加服务器内存资源或优化节点配置以减少内存使用';
    }
  }

  /**
   * 获取CPU使用建议
   * @param cpuUsage CPU使用
   * @param workflowFeatures 工作流特征
   * @returns 建议操作
   */
  private getCpuRecommendation(cpuUsage: number, workflowFeatures: WorkflowFeatures): string {
    if (workflowFeatures.executionFrequency > 100) {
      return '考虑降低工作流执行频率或增加执行间隔';
    } else if (workflowFeatures.nodeCount > 30) {
      return '考虑优化工作流结构，减少不必要的节点或合并相似操作';
    } else {
      return '考虑增加服务器CPU资源或优化节点配置以减少CPU使用';
    }
  }

  /**
   * 获取网络流量建议
   * @param networkTraffic 网络流量
   * @param workflowFeatures 工作流特征
   * @returns 建议操作
   */
  private getNetworkRecommendation(networkTraffic: number, workflowFeatures: WorkflowFeatures): string {
    return '考虑优化数据传输，减少不必要的网络请求，或增加网络带宽';
  }

  /**
   * 获取存储使用建议
   * @param storageUsage 存储使用
   * @param workflowFeatures 工作流特征
   * @returns 建议操作
   */
  private getStorageRecommendation(storageUsage: number, workflowFeatures: WorkflowFeatures): string {
    return '考虑清理临时文件，优化数据存储方式，或增加存储容量';
  }
}
