import type { Workflow } from 'n8n-workflow';
import type {
  ResourceDataPoint,
  ResourcePrediction,
  ResourcePredictionRequest,
  ResourcePredictionResponse,
  ResourcePredictionRequest,
  ResourcePredictionResponse,
  ModelType,
  ModelInfo,
  WorkflowFeatures,
  ResourceAlert,
  ResourceRecommendation,
  PredictionStatistics,
  ResourcePredictorConfig,
  ModelConfig,
  TimeSeriesAnalysis,
  ModelEvaluation
} from '../types';
import { ModelType as ModelTypeEnum } from '../types';
import { ArimaModel } from '../models/arima-model';
import { LstmModel } from '../models/lstm-model';
import { RandomForestModel } from '../models/random-forest-model';
import { LinearRegressionModel } from '../models/linear-regression-model';
import { FeatureExtractor } from '../features/feature-extractor';
import { TimeSeriesAnalyzer } from '../features/time-series-analyzer';
import { AlertGenerator } from '../core/alert-generator';
import { RecommendationGenerator } from '../core/recommendation-generator';
import { DataStore } from '../core/data-store';

/**
 * 资源使用预测器
 * 负责预测工作流资源使用情况，生成预警和建议
 */
export class ResourcePredictor {
  private config: ResourcePredictorConfig;
  private models: Map<ModelType, any> = new Map();
  private featureExtractor: FeatureExtractor;
  private timeSeriesAnalyzer: TimeSeriesAnalyzer;
  private alertGenerator: AlertGenerator;
  private recommendationGenerator: RecommendationGenerator;
  private dataStore: DataStore;

  /**
   * 构造函数
   * @param config 资源使用预测器配置
   */
  constructor(config: Partial<ResourcePredictorConfig> = {}) {
    this.config = {
      defaultModelType: config.defaultModelType ?? ModelTypeEnum.AUTO,
      modelConfig: config.modelConfig ?? this.getDefaultModelConfig(),
      dataCollection: config.dataCollection ?? this.getDefaultDataCollectionConfig(),
      alertConfig: config.alertConfig ?? this.getDefaultAlertConfig(),
      recommendationConfig: config.recommendationConfig ?? this.getDefaultRecommendationConfig(),
      storageConfig: config.storageConfig ?? this.getDefaultStorageConfig(),
    };

    this.featureExtractor = new FeatureExtractor();
    this.timeSeriesAnalyzer = new TimeSeriesAnalyzer();
    this.alertGenerator = new AlertGenerator(this.config.alertConfig);
    this.recommendationGenerator = new RecommendationGenerator(this.config.recommendationConfig);
    this.dataStore = new DataStore(this.config.storageConfig);

    this.initializeModels();
  }

  /**
   * 初始化预测模型
   */
  private initializeModels(): void {
    // 初始化 ARIMA 模型
    this.models.set(ModelTypeEnum.ARIMA, new ArimaModel(this.config.modelConfig));

    // 初始化 LSTM 模型
    this.models.set(ModelTypeEnum.LSTM, new LstmModel(this.config.modelConfig));

    // 初始化随机森林模型
    this.models.set(ModelTypeEnum.RANDOM_FOREST, new RandomForestModel(this.config.modelConfig));

    // 初始化线性回归模型
    this.models.set(ModelTypeEnum.LINEAR_REGRESSION, new LinearRegressionModel(this.config.modelConfig));
  }

  /**
   * 获取默认模型配置
   * @returns 默认模型配置
   */
  private getDefaultModelConfig(): ModelConfig {
    return {
      modelType: ModelTypeEnum.AUTO,
      trainingParams: {
        epochs: 100,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        earlyStoppingPatience: 10,
      },
      featureParams: {
        useTimeFeatures: true,
        useWorkflowFeatures: true,
        useExecutionFeatures: true,
        normalizationMethod: 'min-max',
      },
      predictionParams: {
        predictionSteps: 24,
        confidenceInterval: 0.95,
        enableTrendDetection: true,
        enableSeasonalityDetection: true,
      },
    };
  }

  /**
   * 获取默认数据收集配置
   * @returns 默认数据收集配置
   */
  private getDefaultDataCollectionConfig(): ResourcePredictorConfig['dataCollection'] {
    return {
      collectionInterval: 5000,
      retentionDays: 30,
      samplingRate: 1.0,
    };
  }

  /**
   * 获取默认预警配置
   * @returns 默认预警配置
   */
  private getDefaultAlertConfig(): ResourcePredictorConfig['alertConfig'] {
    return {
      enabled: true,
      memoryThreshold: 800,
      cpuThreshold: 80,
      networkThreshold: 10 * 1024 * 1024, // 10 MB/s
      storageThreshold: 10000, // 10 GB
      alertAdvanceTime: 30,
    };
  }

  /**
   * 获取默认建议配置
   * @returns 默认建议配置
   */
  private getDefaultRecommendationConfig(): ResourcePredictorConfig['recommendationConfig'] {
    return {
      enabled: true,
      generationFrequency: 60,
      maxRecommendations: 5,
    };
  }

  /**
   * 获取默认存储配置
   * @returns 默认存储配置
   */
  private getDefaultStorageConfig(): ResourcePredictorConfig['storageConfig'] {
    return {
      storageType: 'in-memory',
    };
  }

  /**
   * 预测资源使用
   * @param request 预测请求
   * @returns 预测响应
   */
  async predict(request: ResourcePredictionRequest): Promise<ResourcePredictionResponse> {
    const startTime = Date.now();

    // 提取工作流特征
    let workflowFeatures: WorkflowFeatures;
    if (request.features) {
      workflowFeatures = request.features;
    } else {
      workflowFeatures = await this.featureExtractor.extractFromWorkflow(
        request.workflowId,
        request.workflow
      );
    }

    // 获取历史数据
    const historicalData = await this.dataStore.getHistoricalData(
      request.workflowId,
      request.historyPoints
    );

    // 选择模型
    const modelType = this.selectModelType(historicalData, workflowFeatures);
    const model = this.models.get(modelType);

    if (!model) {
      throw new Error(`Model ${modelType} not found`);
    }

    // 训练模型
    await model.train(historicalData, workflowFeatures);

    // 生成预测
    const predictions = await model.predict(
      historicalData,
      workflowFeatures,
      request.predictionRange,
      request.predictionGranularity
    );

    // 分析时间序列
    const timeSeriesAnalysis = this.timeSeriesAnalyzer.analyze(historicalData);

    // 生成预警
    const alerts = this.alertGenerator.generate(predictions, workflowFeatures);

    // 生成建议
    const recommendations = this.recommendationGenerator.generate(
      predictions,
      workflowFeatures,
      alerts
    );

    // 评估模型
    const modelEvaluation = await model.evaluate(historicalData);

    // 计算统计信息
    const statistics = this.calculateStatistics(predictions, modelEvaluation);

    // 保存预测结果
    await this.dataStore.savePredictions(predictions);

    // 构建响应
    const response: ResourcePredictionResponse = {
      predictions,
      modelInfo: {
        modelId: model.getId(),
        modelType,
        trainingTime: model.getTrainingTime(),
        accuracy: modelEvaluation.metrics.accuracy,
        parameters: model.getParameters(),
        lastTrained: Date.now(),
      },
      workflowFeatures,
      alerts,
      recommendations,
      statistics,
    };

    return response;
  }

  /**
   * 选择模型类型
   * @param historicalData 历史数据
   * @param workflowFeatures 工作流特征
   * @returns 模型类型
   */
  private selectModelType(historicalData: ResourceDataPoint[], workflowFeatures: WorkflowFeatures): ModelType {
    if (this.config.defaultModelType !== ModelTypeEnum.AUTO) {
      return this.config.defaultModelType;
    }

    // 基于数据特征选择模型
    const dataSize = historicalData.length;
    const executionFrequency = workflowFeatures.executionFrequency;
    const nodeCount = workflowFeatures.nodeCount;

    // 数据量小，使用简单模型
    if (dataSize < 50) {
      return ModelTypeEnum.LINEAR_REGRESSION;
    }

    // 数据量中等，使用随机森林
    if (dataSize < 200) {
      return ModelTypeEnum.RANDOM_FOREST;
    }

    // 高频执行，使用 ARIMA
    if (executionFrequency > 100) {
      return ModelTypeEnum.ARIMA;
    }

    // 复杂工作流，使用 LSTM
    if (nodeCount > 20) {
      return ModelTypeEnum.LSTM;
    }

    // 默认使用 LSTM
    return ModelTypeEnum.LSTM;
  }

  /**
   * 计算统计信息
   * @param predictions 预测结果
   * @param modelEvaluation 模型评估
   * @returns 统计信息
   */
  private calculateStatistics(predictions: ResourcePrediction[], modelEvaluation: ModelEvaluation): PredictionStatistics {
    const averageConfidence = predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length;

    return {
      averageConfidence,
      errorStatistics: {
        memoryUsage: {
          mae: modelEvaluation.metrics.mae,
          rmse: modelEvaluation.metrics.rmse,
          mape: modelEvaluation.metrics.mape,
        },
        cpuUsage: {
          mae: modelEvaluation.metrics.mae,
          rmse: modelEvaluation.metrics.rmse,
          mape: modelEvaluation.metrics.mape,
        },
        networkTraffic: {
          mae: modelEvaluation.metrics.mae,
          rmse: modelEvaluation.metrics.rmse,
          mape: modelEvaluation.metrics.mape,
        },
        storageUsage: {
          mae: modelEvaluation.metrics.mae,
          rmse: modelEvaluation.metrics.rmse,
          mape: modelEvaluation.metrics.mape,
        },
      },
      alertCount: 0, // 由 alertGenerator 生成
      recommendationCount: 0, // 由 recommendationGenerator 生成
      executionTime: modelEvaluation.inferenceTime,
      historyDataPoints: modelEvaluation.dataPoints,
      predictionDataPoints: predictions.length,
    };
  }

  /**
   * 添加资源使用数据点
   * @param dataPoint 数据点
   */
  async addDataPoint(dataPoint: ResourceDataPoint): Promise<void> {
    await this.dataStore.addDataPoint(dataPoint);
  }

  /**
   * 获取历史数据
   * @param workflowId 工作流ID
   * @param limit 数据点数量
   * @returns 历史数据
   */
  async getHistoricalData(workflowId: string, limit: number): Promise<ResourceDataPoint[]> {
    return this.dataStore.getHistoricalData(workflowId, limit);
  }

  /**
   * 分析时间序列
   * @param workflowId 工作流ID
   * @param limit 数据点数量
   * @returns 时间序列分析
   */
  async analyzeTimeSeries(workflowId: string, limit: number): Promise<TimeSeriesAnalysis> {
    const historicalData = await this.dataStore.getHistoricalData(workflowId, limit);
    return this.timeSeriesAnalyzer.analyze(historicalData);
  }

  /**
   * 获取模型信息
   * @param modelType 模型类型
   * @returns 模型信息
   */
  getModelInfo(modelType: ModelType): ModelInfo {
    const model = this.models.get(modelType);
    if (!model) {
      throw new Error(`Model ${modelType} not found`);
    }

    return {
      modelId: model.getId(),
      modelType,
      trainingTime: model.getTrainingTime(),
      accuracy: 0, // 需要评估
      parameters: model.getParameters(),
      lastTrained: model.getLastTrained(),
    };
  }

  /**
   * 更新配置
   * @param config 配置
   */
  updateConfig(config: Partial<ResourcePredictorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 清理数据
   * @param days 保留天数
   */
  async cleanData(days: number): Promise<void> {
    await this.dataStore.cleanData(days);
  }

  /**
   * 关闭预测器
   */
  async close(): Promise<void> {
    await this.dataStore.close();
  }
}

/**
 * 创建资源使用预测器实例的工厂函数
 * @param config 配置
 * @returns 资源使用预测器实例
 */
export function createResourcePredictor(config?: Partial<ResourcePredictorConfig>): ResourcePredictor {
  return new ResourcePredictor(config);
}
