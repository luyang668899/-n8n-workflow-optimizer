import type { Workflow } from 'n8n-workflow';
import { v4 as uuidv4 } from 'uuid';
import {
  PerformanceComparator,
  BenchmarkOptions,
  BenchmarkResult,
  ComparisonResult,
  PerformanceHistory,
  ResourceUsage
} from '../scheduler/types';
import { SmartWorkflowScheduler } from '../scheduler/workflow-scheduler';
import * as si from 'systeminformation';

/**
 * 工作流性能比较器
 * 负责运行基准测试和比较不同版本工作流的性能
 */
export class WorkflowPerformanceComparator implements PerformanceComparator {
  private benchmarkResults: Map<string, BenchmarkResult> = new Map();
  private performanceHistory: Map<string, PerformanceHistory> = new Map();
  private workflowScheduler: SmartWorkflowScheduler;

  constructor() {
    this.workflowScheduler = new SmartWorkflowScheduler();
  }

  /**
   * 运行基准测试
   * @param workflow 工作流实例
   * @param options 基准测试选项
   * @returns 基准测试结果
   */
  async runBenchmark(workflow: Workflow, options: BenchmarkOptions): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const rawData: Array<{
      iteration: number;
      duration: number;
      memoryUsage: number;
      cpuUsage: number;
      success: boolean;
      error?: string;
    }> = [];

    // 运行测试迭代
    for (let i = 0; i < options.iterations; i++) {
      try {
        // 获取测试前的资源使用情况
        const preResourceUsage = await this.getResourceUsage();

        // 执行工作流（模拟）
        const executionStart = Date.now();
        await this.executeWorkflow(workflow);
        const executionEnd = Date.now();

        // 获取测试后的资源使用情况
        const postResourceUsage = await this.getResourceUsage();

        // 计算资源使用差异
        const memoryUsage = postResourceUsage.memory.used - preResourceUsage.memory.used;
        const cpuUsage = (preResourceUsage.cpu.usage + postResourceUsage.cpu.usage) / 2;

        // 记录测试数据
        rawData.push({
          iteration: i + 1,
          duration: executionEnd - executionStart,
          memoryUsage: Math.max(0, memoryUsage), // 确保不为负数
          cpuUsage,
          success: true
        });

        // 等待一段时间，避免资源竞争
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // 记录失败的测试
        rawData.push({
          iteration: i + 1,
          duration: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          success: false,
          error: (error as Error).message
        });
      }
    }

    // 计算统计数据
    const statistics = this.calculateStatistics(rawData);

    // 创建基准测试结果
    const result: BenchmarkResult = {
      name: options.name || `Benchmark for ${workflow.name || workflow.id}`,
      timestamp: startTime,
      workflow: {
        id: workflow.id,
        name: workflow.name || workflow.id
      },
      config: options,
      statistics,
      rawData
    };

    // 保存测试结果
    const resultKey = `${workflow.id}_${Date.now()}`;
    this.benchmarkResults.set(resultKey, result);

    // 更新性能历史数据
    await this.updatePerformanceHistory(workflow.id, result);

    return result;
  }

  /**
   * 比较多个版本的性能
   * @param workflowId 工作流ID
   * @param versions 版本ID列表
   * @returns 比较结果
   */
  async compareVersions(workflowId: string, versions: string[]): Promise<ComparisonResult> {
    const timestamp = Date.now();
    const versionResults: Array<{
      version: string;
      benchmark: BenchmarkResult;
      diff?: {
        executionTime: number;
        memoryUsage: number;
        cpuUsage: number;
        successRate: number;
      };
    }> = [];

    // 获取每个版本的基准测试结果
    for (const version of versions) {
      const benchmark = await this.getBenchmarkResult(workflowId, version);
      if (benchmark) {
        versionResults.push({ version, benchmark });
      }
    }

    // 计算与基准版本的差异
    if (versionResults.length > 1) {
      const baseBenchmark = versionResults[0].benchmark;

      for (let i = 1; i < versionResults.length; i++) {
        const current = versionResults[i];
        const diff = this.calculatePerformanceDiff(baseBenchmark, current.benchmark);
        current.diff = diff;
      }
    }

    // 确定最佳版本
    let bestVersion = '';
    let bestScore = Infinity;

    versionResults.forEach(result => {
      // 计算综合性能评分（越低越好）
      const score = result.benchmark.statistics.executionTime.mean +
                    result.benchmark.statistics.memoryUsage.mean +
                    result.benchmark.statistics.cpuUsage.mean +
                    (100 - result.benchmark.statistics.successRate);

      if (score < bestScore) {
        bestScore = score;
        bestVersion = result.version;
      }
    });

    // 分析性能趋势
    const trend = this.analyzePerformanceTrend(versionResults);

    // 创建比较结果
    const comparisonResult: ComparisonResult = {
      timestamp,
      workflowId,
      workflowName: versionResults[0]?.benchmark.workflow.name || workflowId,
      versions: versionResults,
      bestVersion,
      trend
    };

    return comparisonResult;
  }

  /**
   * 获取性能历史数据
   * @param workflowId 工作流ID
   * @param limit 限制数量
   * @returns 性能历史数据
   */
  async getHistoricalData(workflowId: string, limit: number = 10): Promise<PerformanceHistory> {
    if (this.performanceHistory.has(workflowId)) {
      const history = this.performanceHistory.get(workflowId)!;
      // 按时间戳排序并限制数量
      const sortedRecords = [...history.records]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return {
        workflowId,
        records: sortedRecords
      };
    }

    // 返回空历史数据
    return {
      workflowId,
      records: []
    };
  }

  /**
   * 保存基准测试结果
   * @param result 基准测试结果
   * @returns 是否保存成功
   */
  async saveBenchmarkResult(result: BenchmarkResult): Promise<boolean> {
    try {
      const resultKey = `${result.workflow.id}_${result.timestamp}`;
      this.benchmarkResults.set(resultKey, result);

      // 更新性能历史数据
      await this.updatePerformanceHistory(result.workflow.id, result);

      return true;
    } catch (error) {
      console.error('Failed to save benchmark result:', error);
      return false;
    }
  }

  /**
   * 获取基准测试结果
   * @param workflowId 工作流ID
   * @param version 版本ID
   * @returns 基准测试结果
   */
  async getBenchmarkResult(workflowId: string, version: string): Promise<BenchmarkResult | null> {
    // 查找匹配的基准测试结果
    for (const [key, result] of this.benchmarkResults.entries()) {
      if (result.workflow.id === workflowId && key.includes(version)) {
        return result;
      }
    }

    // 如果没有找到，返回null
    return null;
  }

  /**
   * 获取资源使用情况
   * @returns 资源使用情况
   */
  private async getResourceUsage(): Promise<ResourceUsage> {
    try {
      // 获取系统信息
      const cpuData = await si.currentLoad();
      const memData = await si.mem();

      return {
        cpu: {
          usage: cpuData.currentLoad || 0,
          cores: cpuData.cpus?.length || 1
        },
        memory: {
          used: memData.used / (1024 * 1024), // 转换为 MB
          total: memData.total / (1024 * 1024), // 转换为 MB
          usage: (memData.used / memData.total) * 100
        }
      };
    } catch (error) {
      // 如果获取系统信息失败，返回默认值
      return {
        cpu: {
          usage: 0,
          cores: 1
        },
        memory: {
          used: 0,
          total: 1024,
          usage: 0
        }
      };
    }
  }

  /**
   * 执行工作流（模拟）
   * @param workflow 工作流实例
   */
  private async executeWorkflow(workflow: Workflow): Promise<void> {
    // 模拟工作流执行
    // 在实际实现中，这里应该调用n8n的工作流执行引擎
    const nodeCount = Object.keys(workflow.nodes || {}).length;
    const executionTime = nodeCount * 100; // 每个节点模拟100ms执行时间

    await new Promise(resolve => setTimeout(resolve, executionTime));
  }

  /**
   * 计算测试统计数据
   * @param rawData 原始测试数据
   * @returns 统计数据
   */
  private calculateStatistics(rawData: Array<{
    iteration: number;
    duration: number;
    memoryUsage: number;
    cpuUsage: number;
    success: boolean;
    error?: string;
  }>) {
    // 过滤出成功的测试
    const successfulTests = rawData.filter(test => test.success);

    if (successfulTests.length === 0) {
      // 如果没有成功的测试，返回默认值
      return {
        executionTime: {
          mean: 0,
          median: 0,
          min: 0,
          max: 0,
          stdDev: 0,
          p95: 0,
          p99: 0
        },
        memoryUsage: {
          mean: 0,
          max: 0
        },
        cpuUsage: {
          mean: 0,
          max: 0
        },
        successRate: 0,
        throughput: 0
      };
    }

    // 计算执行时间统计
    const durations = successfulTests.map(test => test.duration);
    durations.sort((a, b) => a - b);

    const meanDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    const medianDuration = durations[Math.floor(durations.length / 2)];
    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];
    const stdDevDuration = Math.sqrt(
      durations.reduce((sum, duration) => sum + Math.pow(duration - meanDuration, 2), 0) / durations.length
    );
    const p95Duration = durations[Math.floor(durations.length * 0.95)];
    const p99Duration = durations[Math.floor(durations.length * 0.99)];

    // 计算内存使用统计
    const memoryUsages = successfulTests.map(test => test.memoryUsage);
    const meanMemoryUsage = memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length;
    const maxMemoryUsage = Math.max(...memoryUsages);

    // 计算CPU使用统计
    const cpuUsages = successfulTests.map(test => test.cpuUsage);
    const meanCpuUsage = cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length;
    const maxCpuUsage = Math.max(...cpuUsages);

    // 计算成功率
    const successRate = (successfulTests.length / rawData.length) * 100;

    // 计算吞吐量（迭代/秒）
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const throughput = successfulTests.length / (totalDuration / 1000);

    return {
      executionTime: {
        mean: meanDuration,
        median: medianDuration,
        min: minDuration,
        max: maxDuration,
        stdDev: stdDevDuration,
        p95: p95Duration,
        p99: p99Duration
      },
      memoryUsage: {
        mean: meanMemoryUsage,
        max: maxMemoryUsage
      },
      cpuUsage: {
        mean: meanCpuUsage,
        max: maxCpuUsage
      },
      successRate,
      throughput
    };
  }

  /**
   * 计算性能差异
   * @param baseBenchmark 基准版本的测试结果
   * @param currentBenchmark 当前版本的测试结果
   * @returns 性能差异
   */
  private calculatePerformanceDiff(baseBenchmark: BenchmarkResult, currentBenchmark: BenchmarkResult) {
    const baseStats = baseBenchmark.statistics;
    const currentStats = currentBenchmark.statistics;

    return {
      executionTime: ((currentStats.executionTime.mean - baseStats.executionTime.mean) / baseStats.executionTime.mean) * 100,
      memoryUsage: ((currentStats.memoryUsage.mean - baseStats.memoryUsage.mean) / baseStats.memoryUsage.mean) * 100,
      cpuUsage: ((currentStats.cpuUsage.mean - baseStats.cpuUsage.mean) / baseStats.cpuUsage.mean) * 100,
      successRate: currentStats.successRate - baseStats.successRate
    };
  }

  /**
   * 分析性能趋势
   * @param versionResults 版本测试结果
   * @returns 性能趋势
   */
  private analyzePerformanceTrend(versionResults: Array<{
    version: string;
    benchmark: BenchmarkResult;
    diff?: any;
  }>): 'improving' | 'declining' | 'stable' {
    if (versionResults.length < 2) {
      return 'stable';
    }

    // 计算性能变化趋势
    let executionTimeTrend = 0;
    let memoryUsageTrend = 0;
    let cpuUsageTrend = 0;

    for (let i = 1; i < versionResults.length; i++) {
      const prev = versionResults[i - 1].benchmark.statistics;
      const current = versionResults[i].benchmark.statistics;

      executionTimeTrend += current.executionTime.mean - prev.executionTime.mean;
      memoryUsageTrend += current.memoryUsage.mean - prev.memoryUsage.mean;
      cpuUsageTrend += current.cpuUsage.mean - prev.cpuUsage.mean;
    }

    // 计算综合趋势
    const totalTrend = executionTimeTrend + memoryUsageTrend + cpuUsageTrend;

    if (totalTrend < -5) { // 性能提升超过5%
      return 'improving';
    } else if (totalTrend > 5) { // 性能下降超过5%
      return 'declining';
    } else {
      return 'stable';
    }
  }

  /**
   * 更新性能历史数据
   * @param workflowId 工作流ID
   * @param result 基准测试结果
   */
  private async updatePerformanceHistory(workflowId: string, result: BenchmarkResult): Promise<void> {
    if (!this.performanceHistory.has(workflowId)) {
      this.performanceHistory.set(workflowId, {
        workflowId,
        records: []
      });
    }

    const history = this.performanceHistory.get(workflowId)!;

    // 添加新的历史记录
    history.records.push({
      timestamp: result.timestamp,
      version: `v${Date.now()}`, // 模拟版本号
      executionTime: result.statistics.executionTime.mean,
      memoryUsage: result.statistics.memoryUsage.mean,
      cpuUsage: result.statistics.cpuUsage.mean,
      successRate: result.statistics.successRate
    });

    // 限制历史记录数量
    if (history.records.length > 50) {
      history.records = history.records.slice(-50);
    }

    this.performanceHistory.set(workflowId, history);
  }

  /**
   * 清理过期的测试结果
   * @returns 清理的结果数量
   */
  public cleanupOldResults(): number {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let count = 0;

    // 清理过期的基准测试结果
    for (const [key, result] of this.benchmarkResults.entries()) {
      if (result.timestamp < oneWeekAgo) {
        this.benchmarkResults.delete(key);
        count++;
      }
    }

    // 清理过期的性能历史数据
    for (const [workflowId, history] of this.performanceHistory.entries()) {
      const recentRecords = history.records.filter(record => record.timestamp > oneWeekAgo);
      if (recentRecords.length < history.records.length) {
        this.performanceHistory.set(workflowId, {
          workflowId,
          records: recentRecords
        });
        count++;
      }
    }

    return count;
  }

  /**
   * 关闭比较器
   */
  public close(): void {
    this.benchmarkResults.clear();
    this.performanceHistory.clear();
  }
}

/**
 * 创建性能比较器实例
 * @returns 性能比较器实例
 */
export function createPerformanceComparator(): PerformanceComparator {
  return new WorkflowPerformanceComparator();
}
