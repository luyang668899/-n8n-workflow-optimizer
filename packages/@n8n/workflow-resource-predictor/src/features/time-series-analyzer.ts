import type { ResourceDataPoint, TimeSeriesAnalysis } from '../types';

/**
 * 时间序列分析器
 * 负责分析历史数据的趋势、季节性和异常
 */
export class TimeSeriesAnalyzer {
  /**
   * 分析时间序列数据
   * @param data 历史数据
   * @returns 时间序列分析结果
   */
  analyze(data: ResourceDataPoint[]): TimeSeriesAnalysis {
    if (data.length < 2) {
      return this.getDefaultAnalysis();
    }

    // 分析内存使用趋势
    const memoryData = data.map(d => d.memoryUsage);
    const memoryTrend = this.analyzeTrend(memoryData);

    // 分析CPU使用趋势
    const cpuData = data.map(d => d.cpuUsage);
    const cpuTrend = this.analyzeTrend(cpuData);

    // 分析网络流量趋势
    const networkData = data.map(d => d.networkTraffic);
    const networkTrend = this.analyzeTrend(networkData);

    // 分析存储使用趋势
    const storageData = data.map(d => d.storageUsage);
    const storageTrend = this.analyzeTrend(storageData);

    // 综合趋势分析
    const overallTrend = this.combineTrends([memoryTrend, cpuTrend, networkTrend, storageTrend]);

    // 分析季节性
    const seasonality = this.analyzeSeasonality(data);

    // 分析异常
    const anomalies = this.analyzeAnomalies(data);

    // 计算统计特征
    const statistics = this.calculateStatistics(data);

    return {
      trend: overallTrend,
      seasonality,
      anomalies,
      statistics,
    };
  }

  /**
   * 分析趋势
   * @param values 数值数组
   * @returns 趋势分析结果
   */
  private analyzeTrend(values: number[]): {
    type: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    slope: number;
  } {
    const n = values.length;
    if (n < 2) {
      return {
        type: 'stable',
        strength: 0,
        slope: 0,
      };
    }

    // 计算线性回归斜率
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // 计算趋势强度
    const mean = sumY / n;
    const totalVariance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    const explainedVariance = Math.pow(slope, 2) * sumX2;
    const strength = totalVariance > 0 ? Math.min(1, explainedVariance / totalVariance) : 0;

    // 确定趋势类型
    let type: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      type = 'stable';
    } else if (slope > 0) {
      type = 'increasing';
    } else {
      type = 'decreasing';
    }

    return {
      type,
      strength,
      slope,
    };
  }

  /**
   * 合并多个趋势分析结果
   * @param trends 趋势分析结果数组
   * @returns 综合趋势分析结果
   */
  private combineTrends(trends: Array<{
    type: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    slope: number;
  }>): {
    type: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    slope: number;
  } {
    // 计算平均斜率和强度
    const avgSlope = trends.reduce((sum, trend) => sum + trend.slope, 0) / trends.length;
    const avgStrength = trends.reduce((sum, trend) => sum + trend.strength, 0) / trends.length;

    // 确定综合趋势类型
    let type: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(avgSlope) < 0.01) {
      type = 'stable';
    } else if (avgSlope > 0) {
      type = 'increasing';
    } else {
      type = 'decreasing';
    }

    return {
      type,
      strength: avgStrength,
      slope: avgSlope,
    };
  }

  /**
   * 分析季节性
   * @param data 历史数据
   * @returns 季节性分析结果
   */
  private analyzeSeasonality(data: ResourceDataPoint[]): {
    present: boolean;
    period?: number;
    strength?: number;
  } {
    if (data.length < 24) { // 需要至少24个数据点来检测小时级季节性
      return {
        present: false,
      };
    }

    // 简单的季节性检测：检查每小时的模式
    const hourlyData: Record<number, number[]> = {};

    data.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = [];
      }
      hourlyData[hour].push(point.memoryUsage);
    });

    // 计算每小时的平均值
    const hourlyAverages: number[] = [];
    for (let i = 0; i < 24; i++) {
      if (hourlyData[i] && hourlyData[i].length > 0) {
        const avg = hourlyData[i].reduce((sum, val) => sum + val, 0) / hourlyData[i].length;
        hourlyAverages.push(avg);
      } else {
        hourlyAverages.push(0);
      }
    }

    // 计算季节性强度（基于每小时平均值的变异系数）
    const mean = hourlyAverages.reduce((sum, val) => sum + val, 0) / hourlyAverages.length;
    const std = Math.sqrt(hourlyAverages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / hourlyAverages.length);
    const coefficientOfVariation = mean > 0 ? std / mean : 0;

    // 如果变异系数大于0.1，则认为存在季节性
    const present = coefficientOfVariation > 0.1;

    return {
      present,
      period: present ? 24 : undefined, // 24小时周期
      strength: present ? coefficientOfVariation : undefined,
    };
  }

  /**
   * 分析异常
   * @param data 历史数据
   * @returns 异常分析结果
   */
  private analyzeAnomalies(data: ResourceDataPoint[]): {
    present: boolean;
    points: number[];
    strength?: number;
  } {
    if (data.length < 3) {
      return {
        present: false,
        points: [],
      };
    }

    // 使用移动平均和标准差方法检测异常
    const memoryData = data.map(d => d.memoryUsage);
    const windowSize = 5;
    const anomalies: number[] = [];

    for (let i = windowSize - 1; i < memoryData.length; i++) {
      // 计算移动平均
      const window = memoryData.slice(i - windowSize + 1, i + 1);
      const mean = window.reduce((sum, val) => sum + val, 0) / windowSize;

      // 计算标准差
      const std = Math.sqrt(window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windowSize);

      // 检查是否为异常（超出2个标准差）
      if (Math.abs(memoryData[i] - mean) > 2 * std) {
        anomalies.push(i);
      }
    }

    const present = anomalies.length > 0;
    const strength = present ? anomalies.length / data.length : undefined;

    return {
      present,
      points: anomalies,
      strength,
    };
  }

  /**
   * 计算统计特征
   * @param data 历史数据
   * @returns 统计特征
   */
  private calculateStatistics(data: ResourceDataPoint[]): {
    mean: number;
    std: number;
    min: number;
    max: number;
    median: number;
    skewness: number;
    kurtosis: number;
  } {
    const memoryData = data.map(d => d.memoryUsage);
    const sorted = memoryData.sort((a, b) => a - b);
    const n = memoryData.length;
    const mean = memoryData.reduce((sum, val) => sum + val, 0) / n;
    const std = Math.sqrt(memoryData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n);
    const min = sorted[0];
    const max = sorted[n - 1];
    const median = sorted[Math.floor(n / 2)];

    // 计算偏度
    const skewness = memoryData.reduce((sum, val) => sum + Math.pow((val - mean) / std, 3), 0) / n;

    // 计算峰度
    const kurtosis = memoryData.reduce((sum, val) => sum + Math.pow((val - mean) / std, 4), 0) / n - 3;

    return {
      mean,
      std,
      min,
      max,
      median,
      skewness,
      kurtosis,
    };
  }

  /**
   * 获取默认分析结果
   * @returns 默认分析结果
   */
  private getDefaultAnalysis(): TimeSeriesAnalysis {
    return {
      trend: {
        type: 'stable',
        strength: 0,
        slope: 0,
      },
      seasonality: {
        present: false,
      },
      anomalies: {
        present: false,
        points: [],
      },
      statistics: {
        mean: 0,
        std: 0,
        min: 0,
        max: 0,
        median: 0,
        skewness: 0,
        kurtosis: 0,
      },
    };
  }
}
