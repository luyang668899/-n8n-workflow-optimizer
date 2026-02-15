import type { ResourceDataPoint, ResourcePrediction } from '../types';

/**
 * 数据存储
 * 负责存储和管理历史数据和预测结果
 */
export class DataStore {
  private config: {
    storageType: 'in-memory' | 'file' | 'database';
    storagePath?: string;
    databaseUrl?: string;
  };
  private data: Map<string, ResourceDataPoint[]> = new Map();
  private predictions: ResourcePrediction[] = [];

  /**
   * 构造函数
   * @param config 存储配置
   */
  constructor(config: {
    storageType: 'in-memory' | 'file' | 'database';
    storagePath?: string;
    databaseUrl?: string;
  }) {
    this.config = config;
  }

  /**
   * 添加数据点
   * @param dataPoint 数据点
   */
  async addDataPoint(dataPoint: ResourceDataPoint): Promise<void> {
    if (!this.data.has(dataPoint.workflowId)) {
      this.data.set(dataPoint.workflowId, []);
    }

    const workflowData = this.data.get(dataPoint.workflowId)!;
    workflowData.push(dataPoint);

    // 限制每个工作流的数据点数量
    this.limitDataPoints(dataPoint.workflowId);

    // 对于文件或数据库存储，这里可以添加持久化逻辑
  }

  /**
   * 获取历史数据
   * @param workflowId 工作流ID
   * @param limit 数据点数量
   * @returns 历史数据
   */
  async getHistoricalData(workflowId: string, limit: number): Promise<ResourceDataPoint[]> {
    const workflowData = this.data.get(workflowId) || [];
    return workflowData.slice(-limit);
  }

  /**
   * 保存预测结果
   * @param predictions 预测结果
   */
  async savePredictions(predictions: ResourcePrediction[]): Promise<void> {
    this.predictions.push(...predictions);

    // 限制预测结果的数量
    this.limitPredictions();

    // 对于文件或数据库存储，这里可以添加持久化逻辑
  }

  /**
   * 获取预测结果
   * @param workflowId 工作流ID
   * @param limit 预测结果数量
   * @returns 预测结果
   */
  async getPredictions(workflowId: string, limit: number): Promise<ResourcePrediction[]> {
    return this.predictions
      .filter(prediction => prediction.modelId.includes(workflowId))
      .slice(-limit);
  }

  /**
   * 清理数据
   * @param days 保留天数
   */
  async cleanData(days: number): Promise<void> {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    // 清理历史数据
    for (const [workflowId, workflowData] of this.data.entries()) {
      const filteredData = workflowData.filter(dataPoint => dataPoint.timestamp > cutoffTime);
      this.data.set(workflowId, filteredData);
    }

    // 清理预测结果
    this.predictions = this.predictions.filter(prediction => prediction.timestamp > cutoffTime);
  }

  /**
   * 关闭存储
   */
  async close(): Promise<void> {
    // 对于文件或数据库存储，这里可以添加关闭连接的逻辑
  }

  /**
   * 限制数据点数量
   * @param workflowId 工作流ID
   */
  private limitDataPoints(workflowId: string): void {
    const workflowData = this.data.get(workflowId);
    if (workflowData && workflowData.length > 10000) { // 限制每个工作流最多10000个数据点
      this.data.set(workflowId, workflowData.slice(-10000));
    }
  }

  /**
   * 限制预测结果数量
   */
  private limitPredictions(): void {
    if (this.predictions.length > 5000) { // 限制最多5000个预测结果
      this.predictions = this.predictions.slice(-5000);
    }
  }
}
