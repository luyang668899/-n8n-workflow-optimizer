import type { Workflow } from 'n8n-workflow';
import { v4 as uuidv4 } from 'uuid';
import {
  HealthScoringSystem,
  HealthScore,
  HealthReport,
  ImprovementSuggestion,
  ScoreHistory,
  WorkflowFeatures
} from '../scheduler/types';
import { SmartWorkflowScheduler } from '../scheduler/workflow-scheduler';
import { WorkflowPerformanceComparator } from '../comparator/performance-comparator';

/**
 * 工作流健康评分系统
 * 负责评估工作流的健康度并生成改进建议
 */
export class WorkflowHealthScoringSystem implements HealthScoringSystem {
  private healthScores: Map<string, HealthScore> = new Map();
  private healthReports: Map<string, HealthReport> = new Map();
  private scoreHistory: Map<string, ScoreHistory> = new Map();
  private workflowScheduler: SmartWorkflowScheduler;
  private performanceComparator: WorkflowPerformanceComparator;

  constructor() {
    this.workflowScheduler = new SmartWorkflowScheduler();
    this.performanceComparator = new WorkflowPerformanceComparator();
  }

  /**
   * 计算工作流健康评分
   * @param workflow 工作流实例
   * @returns 健康评分
   */
  async calculateScore(workflow: Workflow): Promise<HealthScore> {
    const workflowId = workflow.id;
    const timestamp = Date.now();

    // 获取工作流特征
    const features = await this.workflowScheduler.getWorkflowFeatures(workflow);

    // 计算各维度评分
    const efficiencyScore = this.calculateEfficiencyScore(features);
    const resourceUsageScore = this.calculateResourceUsageScore(features);
    const stabilityScore = this.calculateStabilityScore(workflow);
    const complexityScore = this.calculateComplexityScore(features);
    const maintainabilityScore = this.calculateMaintainabilityScore(workflow);

    // 计算综合评分
    const totalScore = this.calculateTotalScore({
      efficiency: efficiencyScore,
      resourceUsage: resourceUsageScore,
      stability: stabilityScore,
      complexity: complexityScore,
      maintainability: maintainabilityScore
    });

    // 确定评分等级
    const grade = this.calculateGrade(totalScore);

    // 生成改进建议
    const suggestions = await this.generateImprovementSuggestions(workflow, features);

    const score: HealthScore = {
      workflowId,
      workflowName: workflow.name || '',
      score: totalScore,
      grade,
      timestamp,
      dimensions: {
        efficiency: efficiencyScore,
        resourceUsage: resourceUsageScore,
        stability: stabilityScore,
        complexity: complexityScore,
        maintainability: maintainabilityScore
      },
      suggestionCount: suggestions.length
    };

    // 保存评分
    const scoreKey = `${workflowId}_${timestamp}`;
    this.healthScores.set(scoreKey, score);

    // 更新评分历史
    await this.updateScoreHistory(workflowId, score);

    return score;
  }

  /**
   * 获取工作流健康报告
   * @param workflowId 工作流ID
   * @returns 健康报告
   */
  async getHealthReport(workflowId: string): Promise<HealthReport> {
    // 获取最新的健康评分
    const latestScore = await this.getLatestHealthScore(workflowId);
    if (!latestScore) {
      throw new Error(`No health score found for workflow ${workflowId}`);
    }

    // 生成分析
    const analysis = this.generateHealthAnalysis(latestScore);

    // 生成改进建议
    const suggestions = await this.getImprovementSuggestions(workflowId);

    // 获取评分历史
    const history = await this.getScoreHistory(workflowId, 10);

    const report: HealthReport = {
      score: latestScore,
      analysis,
      suggestions,
      history: history.records.map(record => ({
        timestamp: record.timestamp,
        score: record.score,
        grade: record.grade
      }))
    };

    // 保存报告
    const reportKey = `${workflowId}_${Date.now()}`;
    this.healthReports.set(reportKey, report);

    return report;
  }

  /**
   * 获取评分历史
   * @param workflowId 工作流ID
   * @param limit 限制数量
   * @returns 评分历史
   */
  async getScoreHistory(workflowId: string, limit: number = 20): Promise<ScoreHistory> {
    if (this.scoreHistory.has(workflowId)) {
      const history = this.scoreHistory.get(workflowId)!;
      // 按时间戳排序并限制数量
      const sortedRecords = [...history.records]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return {
        workflowId,
        records: sortedRecords,
        trend: this.analyzeHealthTrend(sortedRecords)
      };
    }

    // 返回空历史数据
    return {
      workflowId,
      records: [],
      trend: {
        overall: 'stable',
        dimensions: {
          efficiency: 'stable',
          resourceUsage: 'stable',
          stability: 'stable',
          complexity: 'stable',
          maintainability: 'stable'
        }
      }
    };
  }

  /**
   * 获取改进建议
   * @param workflowId 工作流ID
   * @returns 改进建议列表
   */
  async getImprovementSuggestions(workflowId: string): Promise<ImprovementSuggestion[]> {
    // TODO: 从存储中获取工作流实例
    const workflow = this.mockGetWorkflow(workflowId);
    if (!workflow) {
      return [];
    }

    // 获取工作流特征
    const features = await this.workflowScheduler.getWorkflowFeatures(workflow);

    // 生成改进建议
    return this.generateImprovementSuggestions(workflow, features);
  }

  /**
   * 保存健康评分
   * @param score 健康评分
   * @returns 是否保存成功
   */
  async saveHealthScore(score: HealthScore): Promise<boolean> {
    try {
      const scoreKey = `${score.workflowId}_${score.timestamp}`;
      this.healthScores.set(scoreKey, score);

      // 更新评分历史
      await this.updateScoreHistory(score.workflowId, score);

      return true;
    } catch (error) {
      console.error('Failed to save health score:', error);
      return false;
    }
  }

  /**
   * 分析工作流健康趋势
   * @param workflowId 工作流ID
   * @param days 天数
   * @returns 健康趋势分析
   */
  async analyzeHealthTrend(workflowId: string, days: number): Promise<{
    trend: 'improving' | 'declining' | 'stable';
    scoreChange: number;
    keyInsights: string[];
  }> {
    const history = await this.getScoreHistory(workflowId);
    const records = history.records;

    if (records.length < 2) {
      return {
        trend: 'stable',
        scoreChange: 0,
        keyInsights: ['Insufficient data to analyze trend']
      };
    }

    // 过滤指定天数内的记录
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentRecords = records.filter(record => record.timestamp >= cutoffTime);

    if (recentRecords.length < 2) {
      return {
        trend: 'stable',
        scoreChange: 0,
        keyInsights: ['Insufficient data for the specified time period']
      };
    }

    // 计算分数变化
    const firstScore = recentRecords[recentRecords.length - 1].score;
    const lastScore = recentRecords[0].score;
    const scoreChange = lastScore - firstScore;

    // 确定趋势
    let trend: 'improving' | 'declining' | 'stable';
    if (scoreChange > 5) {
      trend = 'improving';
    } else if (scoreChange < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // 生成关键洞察
    const keyInsights = this.generateKeyInsights(recentRecords, trend, scoreChange);

    return {
      trend,
      scoreChange,
      keyInsights
    };
  }

  /**
   * 计算执行效率评分
   * @param features 工作流特征
   * @returns 执行效率评分（0-100）
   */
  private calculateEfficiencyScore(features: WorkflowFeatures): number {
    // 基于预计执行时长和复杂度的效率评分
    const estimatedDuration = features.estimatedDuration;
    const complexityScore = features.complexityScore;

    // 执行时长越短，评分越高
    const durationScore = Math.max(0, 100 - (estimatedDuration / 1000) * 10);

    // 复杂度适中的工作流评分更高
    const complexityAdjustment = Math.max(0, 100 - Math.abs(complexityScore - 50) * 2);

    // 加权平均
    return (durationScore * 0.7 + complexityAdjustment * 0.3);
  }

  /**
   * 计算资源使用评分
   * @param features 工作流特征
   * @returns 资源使用评分（0-100）
   */
  private calculateResourceUsageScore(features: WorkflowFeatures): number {
    const cpuUsage = features.resourceRequirements.cpu;
    const memoryUsage = features.resourceRequirements.memory;

    // CPU使用评分
    const cpuScore = Math.max(0, 100 - cpuUsage);

    // 内存使用评分
    const memoryScore = Math.max(0, 100 - (memoryUsage / 10));

    // 加权平均
    return (cpuScore * 0.5 + memoryScore * 0.5);
  }

  /**
   * 计算稳定性评分
   * @param workflow 工作流实例
   * @returns 稳定性评分（0-100）
   */
  private calculateStabilityScore(workflow: Workflow): number {
    // 基于工作流结构和节点类型的稳定性评分
    const nodeCount = Object.keys(workflow.nodes || {}).length;
    const connectionCount = this.calculateConnectionCount(workflow);

    // 节点数量适中的工作流更稳定
    const nodeCountScore = Math.max(0, 100 - Math.abs(nodeCount - 10) * 5);

    // 连接密度适中的工作流更稳定
    const connectionDensity = nodeCount > 0 ? connectionCount / nodeCount : 0;
    const connectionScore = Math.max(0, 100 - Math.abs(connectionDensity - 2) * 20);

    // 加权平均
    return (nodeCountScore * 0.6 + connectionScore * 0.4);
  }

  /**
   * 计算复杂度评分
   * @param features 工作流特征
   * @returns 复杂度评分（0-100）
   */
  private calculateComplexityScore(features: WorkflowFeatures): number {
    const complexityScore = features.complexityScore;

    // 复杂度适中的工作流评分更高
    return Math.max(0, 100 - Math.abs(complexityScore - 40) * 1.5);
  }

  /**
   * 计算可维护性评分
   * @param workflow 工作流实例
   * @returns 可维护性评分（0-100）
   */
  private calculateMaintainabilityScore(workflow: Workflow): number {
    const nodeCount = Object.keys(workflow.nodes || {}).length;
    const hasDescriptions = this.checkNodeDescriptions(workflow);
    const hasErrorHandling = this.checkErrorHandling(workflow);

    // 节点数量适中的工作流更易维护
    const nodeCountScore = Math.max(0, 100 - Math.abs(nodeCount - 10) * 5);

    // 有节点描述的工作流更易维护
    const descriptionScore = hasDescriptions ? 100 : 70;

    // 有错误处理的工作流更易维护
    const errorHandlingScore = hasErrorHandling ? 100 : 60;

    // 加权平均
    return (nodeCountScore * 0.4 + descriptionScore * 0.3 + errorHandlingScore * 0.3);
  }

  /**
   * 计算综合健康评分
   * @param dimensions 各维度评分
   * @returns 综合评分（0-100）
   */
  private calculateTotalScore(dimensions: {
    efficiency: number;
    resourceUsage: number;
    stability: number;
    complexity: number;
    maintainability: number;
  }): number {
    // 加权平均
    return (
      dimensions.efficiency * 0.3 +
      dimensions.resourceUsage * 0.25 +
      dimensions.stability * 0.2 +
      dimensions.complexity * 0.1 +
      dimensions.maintainability * 0.15
    );
  }

  /**
   * 计算评分等级
   * @param score 健康评分
   * @returns 评分等级
   */
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * 生成健康分析
   * @param score 健康评分
   * @returns 健康分析
   */
  private generateHealthAnalysis(score: HealthScore) {
    return {
      efficiency: {
        result: this.generateEfficiencyAnalysis(score.dimensions.efficiency),
        data: {
          score: score.dimensions.efficiency,
          grade: this.calculateGrade(score.dimensions.efficiency)
        }
      },
      resourceUsage: {
        result: this.generateResourceUsageAnalysis(score.dimensions.resourceUsage),
        data: {
          score: score.dimensions.resourceUsage,
          grade: this.calculateGrade(score.dimensions.resourceUsage)
        }
      },
      stability: {
        result: this.generateStabilityAnalysis(score.dimensions.stability),
        data: {
          score: score.dimensions.stability,
          grade: this.calculateGrade(score.dimensions.stability)
        }
      },
      complexity: {
        result: this.generateComplexityAnalysis(score.dimensions.complexity),
        data: {
          score: score.dimensions.complexity,
          grade: this.calculateGrade(score.dimensions.complexity)
        }
      }
    };
  }

  /**
   * 生成执行效率分析
   * @param score 执行效率评分
   * @returns 分析结果
   */
  private generateEfficiencyAnalysis(score: number): string {
    if (score >= 90) return '工作流执行效率优秀，响应迅速';
    if (score >= 80) return '工作流执行效率良好';
    if (score >= 70) return '工作流执行效率一般，有改进空间';
    if (score >= 60) return '工作流执行效率较低，建议优化';
    return '工作流执行效率差，需要立即优化';
  }

  /**
   * 生成资源使用分析
   * @param score 资源使用评分
   * @returns 分析结果
   */
  private generateResourceUsageAnalysis(score: number): string {
    if (score >= 90) return '工作流资源使用非常高效';
    if (score >= 80) return '工作流资源使用良好';
    if (score >= 70) return '工作流资源使用一般，有改进空间';
    if (score >= 60) return '工作流资源使用较高，建议优化';
    return '工作流资源使用过高，需要立即优化';
  }

  /**
   * 生成稳定性分析
   * @param score 稳定性评分
   * @returns 分析结果
   */
  private generateStabilityAnalysis(score: number): string {
    if (score >= 90) return '工作流结构稳定，可靠性高';
    if (score >= 80) return '工作流结构较为稳定';
    if (score >= 70) return '工作流结构稳定性一般，有改进空间';
    if (score >= 60) return '工作流结构稳定性较低，建议优化';
    return '工作流结构不稳定，需要立即优化';
  }

  /**
   * 生成复杂度分析
   * @param score 复杂度评分
   * @returns 分析结果
   */
  private generateComplexityAnalysis(score: number): string {
    if (score >= 90) return '工作流复杂度适中，易于理解和维护';
    if (score >= 80) return '工作流复杂度合理';
    if (score >= 70) return '工作流复杂度一般，有改进空间';
    if (score >= 60) return '工作流复杂度较高，建议简化';
    return '工作流过于复杂，需要立即简化';
  }

  /**
   * 生成改进建议
   * @param workflow 工作流实例
   * @param features 工作流特征
   * @returns 改进建议列表
   */
  private async generateImprovementSuggestions(workflow: Workflow, features: WorkflowFeatures): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    // 基于执行效率的建议
    if (features.estimatedDuration > 5000) {
      suggestions.push({
        id: uuidv4(),
        type: 'efficiency',
        title: '优化执行效率',
        description: '工作流执行时长较长，建议优化节点执行顺序和并行处理',
        priority: 'high',
        expectedImprovement: 30,
        difficulty: 'medium',
        steps: [
          '识别执行时间较长的节点',
          '考虑将串行执行改为并行执行',
          '优化节点配置，减少不必要的操作',
          '使用缓存减少重复计算'
        ],
        createdAt: Date.now()
      });
    }

    // 基于资源使用的建议
    if (features.resourceRequirements.cpu > 50 || features.resourceRequirements.memory > 500) {
      suggestions.push({
        id: uuidv4(),
        type: 'resource',
        title: '优化资源使用',
        description: '工作流资源使用较高，建议优化节点配置和数据处理',
        priority: 'medium',
        expectedImprovement: 25,
        difficulty: 'medium',
        steps: [
          '识别资源消耗较大的节点',
          '优化节点配置，减少内存使用',
          '考虑分批处理大量数据',
          '使用更高效的数据结构'
        ],
        createdAt: Date.now()
      });
    }

    // 基于复杂度的建议
    if (features.complexityScore > 70) {
      suggestions.push({
        id: uuidv4(),
        type: 'complexity',
        title: '简化工作流结构',
        description: '工作流过于复杂，建议拆分为多个子工作流',
        priority: 'medium',
        expectedImprovement: 20,
        difficulty: 'hard',
        steps: [
          '识别工作流中的逻辑模块',
          '将逻辑模块拆分为独立的子工作流',
          '使用工作流调用节点连接子工作流',
          '优化工作流连接结构'
        ],
        createdAt: Date.now()
      });
    }

    // 基于可维护性的建议
    if (!this.checkNodeDescriptions(workflow)) {
      suggestions.push({
        id: uuidv4(),
        type: 'maintainability',
        title: '添加节点描述',
        description: '工作流节点缺少描述，建议为重要节点添加描述',
        priority: 'low',
        expectedImprovement: 10,
        difficulty: 'easy',
        steps: [
          '为关键节点添加描述',
          '描述节点的功能和作用',
          '说明节点的配置参数',
          '记录节点的预期输入和输出'
        ],
        createdAt: Date.now()
      });
    }

    // 基于错误处理的建议
    if (!this.checkErrorHandling(workflow)) {
      suggestions.push({
        id: uuidv4(),
        type: 'stability',
        title: '添加错误处理',
        description: '工作流缺少错误处理机制，建议添加错误捕获和处理逻辑',
        priority: 'high',
        expectedImprovement: 15,
        difficulty: 'medium',
        steps: [
          '为关键节点添加错误触发器',
          '实现错误处理逻辑',
          '添加通知机制，及时发现错误',
          '考虑添加重试机制'
        ],
        createdAt: Date.now()
      });
    }

    return suggestions;
  }

  /**
   * 分析健康趋势
   * @param records 评分记录
   * @returns 趋势分析
   */
  private analyzeHealthTrend(records: Array<{
    timestamp: number;
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    dimensions: HealthScore['dimensions'];
  }>) {
    if (records.length < 2) {
      return {
        overall: 'stable' as const,
        dimensions: {
          efficiency: 'stable' as const,
          resourceUsage: 'stable' as const,
          stability: 'stable' as const,
          complexity: 'stable' as const,
          maintainability: 'stable' as const
        }
      };
    }

    // 计算整体趋势
    const firstScore = records[records.length - 1].score;
    const lastScore = records[0].score;
    const overallChange = lastScore - firstScore;

    let overallTrend: 'improving' | 'declining' | 'stable';
    if (overallChange > 5) {
      overallTrend = 'improving';
    } else if (overallChange < -5) {
      overallTrend = 'declining';
    } else {
      overallTrend = 'stable';
    }

    // 计算各维度趋势
    const dimensions = records[0].dimensions;
    const firstDimensions = records[records.length - 1].dimensions;

    const efficiencyChange = dimensions.efficiency - firstDimensions.efficiency;
    const resourceUsageChange = dimensions.resourceUsage - firstDimensions.resourceUsage;
    const stabilityChange = dimensions.stability - firstDimensions.stability;
    const complexityChange = dimensions.complexity - firstDimensions.complexity;
    const maintainabilityChange = dimensions.maintainability - firstDimensions.maintainability;

    return {
      overall: overallTrend,
      dimensions: {
        efficiency: this.getTrend(efficiencyChange),
        resourceUsage: this.getTrend(resourceUsageChange),
        stability: this.getTrend(stabilityChange),
        complexity: this.getTrend(complexityChange),
        maintainability: this.getTrend(maintainabilityChange)
      }
    };
  }

  /**
   * 获取趋势
   * @param change 变化值
   * @returns 趋势
   */
  private getTrend(change: number): 'improving' | 'declining' | 'stable' {
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  /**
   * 生成关键洞察
   * @param records 评分记录
   * @param trend 整体趋势
   * @param scoreChange 分数变化
   * @returns 关键洞察列表
   */
  private generateKeyInsights(
    records: Array<{
      timestamp: number;
      score: number;
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      dimensions: HealthScore['dimensions'];
    }>,
    trend: 'improving' | 'declining' | 'stable',
    scoreChange: number
  ): string[] {
    const insights: string[] = [];

    // 整体趋势洞察
    if (trend === 'improving') {
      insights.push(`工作流健康状况正在改善，评分提升了 ${scoreChange.toFixed(1)} 分`);
    } else if (trend === 'declining') {
      insights.push(`工作流健康状况正在下降，评分下降了 ${Math.abs(scoreChange).toFixed(1)} 分`);
    } else {
      insights.push('工作流健康状况保持稳定');
    }

    // 维度洞察
    const latestDimensions = records[0].dimensions;
    const worstDimension = Object.entries(latestDimensions)
      .sort((a, b) => a[1] - b[1])[0];

    if (latestDimensions[worstDimension[0] as keyof typeof latestDimensions] < 70) {
      insights.push(`${this.getDimensionName(worstDimension[0])} 是当前最需要改进的方面`);
    }

    // 评分等级洞察
    const latestGrade = records[0].grade;
    const firstGrade = records[records.length - 1].grade;

    if (latestGrade !== firstGrade) {
      insights.push(`工作流健康等级从 ${firstGrade} 变为 ${latestGrade}`);
    }

    return insights;
  }

  /**
   * 获取维度名称
   * @param dimension 维度键
   * @returns 维度名称
   */
  private getDimensionName(dimension: string): string {
    const names = {
      efficiency: '执行效率',
      resourceUsage: '资源使用',
      stability: '稳定性',
      complexity: '复杂度',
      maintainability: '可维护性'
    };

    return names[dimension as keyof typeof names] || dimension;
  }

  /**
   * 计算工作流连接数量
   * @param workflow 工作流实例
   * @returns 连接数量
   */
  private calculateConnectionCount(workflow: Workflow): number {
    let count = 0;
    const connections = workflow.connectionsBySourceNode;

    if (connections) {
      Object.values(connections).forEach(sourceConnections => {
        Object.values(sourceConnections).forEach(typeConnections => {
          Object.values(typeConnections).forEach(indexConnections => {
            count += indexConnections.length;
          });
        });
      });
    }

    return count;
  }

  /**
   * 检查节点描述
   * @param workflow 工作流实例
   * @returns 是否有节点描述
   */
  private checkNodeDescriptions(workflow: Workflow): boolean {
    // 检查是否有节点有描述
    const nodes = workflow.nodes || {};
    for (const nodeName in nodes) {
      const node = nodes[nodeName];
      if (node.description && node.description.trim()) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查错误处理
   * @param workflow 工作流实例
   * @returns 是否有错误处理
   */
  private checkErrorHandling(workflow: Workflow): boolean {
    // 检查是否有错误处理节点或错误触发器
    const nodes = workflow.nodes || {};
    for (const nodeName in nodes) {
      const node = nodes[nodeName];
      // 简单检查，实际应该检查节点配置中是否有错误处理
      if (node.type.includes('error') || node.type.includes('catch')) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取最新的健康评分
   * @param workflowId 工作流ID
   * @returns 最新的健康评分
   */
  private async getLatestHealthScore(workflowId: string): Promise<HealthScore | null> {
    // 查找最新的健康评分
    let latestScore: HealthScore | null = null;
    let latestTimestamp = 0;

    for (const [key, score] of this.healthScores.entries()) {
      if (score.workflowId === workflowId && score.timestamp > latestTimestamp) {
        latestScore = score;
        latestTimestamp = score.timestamp;
      }
    }

    return latestScore;
  }

  /**
   * 更新评分历史
   * @param workflowId 工作流ID
   * @param score 健康评分
   */
  private async updateScoreHistory(workflowId: string, score: HealthScore): Promise<void> {
    if (!this.scoreHistory.has(workflowId)) {
      this.scoreHistory.set(workflowId, {
        workflowId,
        records: [],
        trend: {
          overall: 'stable',
          dimensions: {
            efficiency: 'stable',
            resourceUsage: 'stable',
            stability: 'stable',
            complexity: 'stable',
            maintainability: 'stable'
          }
        }
      });
    }

    const history = this.scoreHistory.get(workflowId)!;

    // 添加新的评分记录
    history.records.push({
      timestamp: score.timestamp,
      score: score.score,
      grade: score.grade,
      dimensions: score.dimensions
    });

    // 限制历史记录数量
    if (history.records.length > 100) {
      history.records = history.records.slice(-100);
    }

    // 更新趋势
    history.trend = this.analyzeHealthTrend(history.records);

    this.scoreHistory.set(workflowId, history);
  }

  /**
   * 模拟获取工作流实例
   * TODO: 实现从存储中获取工作流的逻辑
   * @param workflowId 工作流ID
   * @returns 工作流实例
   */
  private mockGetWorkflow(workflowId: string): Workflow | null {
    // 这里是一个模拟实现，实际应该从数据库或存储中获取工作流
    return {
      id: workflowId,
      name: `Mock Workflow ${workflowId}`,
      nodes: {},
      connectionsBySourceNode: {},
      active: true,
      settings: {},
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    } as any;
  }

  /**
   * 清理过期的健康数据
   * @returns 清理的记录数量
   */
  public cleanupOldData(): number {
    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    let count = 0;

    // 清理过期的健康评分
    for (const [key, score] of this.healthScores.entries()) {
      if (score.timestamp < oneMonthAgo) {
        this.healthScores.delete(key);
        count++;
      }
    }

    // 清理过期的健康报告
    for (const [key, report] of this.healthReports.entries()) {
      if (report.score.timestamp < oneMonthAgo) {
        this.healthReports.delete(key);
        count++;
      }
    }

    // 清理过期的评分历史记录
    for (const [workflowId, history] of this.scoreHistory.entries()) {
      const recentRecords = history.records.filter(record => record.timestamp > oneMonthAgo);
      if (recentRecords.length < history.records.length) {
        this.scoreHistory.set(workflowId, {
          workflowId,
          records: recentRecords,
          trend: this.analyzeHealthTrend(recentRecords)
        });
        count++;
      }
    }

    return count;
  }

  /**
   * 关闭健康评分系统
   */
  public close(): void {
    this.healthScores.clear();
    this.healthReports.clear();
    this.scoreHistory.clear();
  }
}

/**
 * 创建健康评分系统实例
 * @returns 健康评分系统实例
 */
export function createHealthScoringSystem(): HealthScoringSystem {
  return new WorkflowHealthScoringSystem();
}
