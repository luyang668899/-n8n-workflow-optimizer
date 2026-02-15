import type {
  OptimizationSuggestion,
  SecurityCheckResult,
  RiskLevel,
} from '../types';
import { RiskLevel as RiskLevelEnum } from '../types';

/**
 * 安全检查器
 * 负责检查优化操作的安全性
 */
export class SecurityChecker {
  private config: {
    allowHighRisk: boolean;
    requireConfirmation: boolean;
    maxRiskLevel: RiskLevel;
  };

  /**
   * 构造函数
   * @param config 风险控制配置
   */
  constructor(config: {
    allowHighRisk: boolean;
    requireConfirmation: boolean;
    maxRiskLevel: RiskLevel;
  }) {
    this.config = config;
  }

  /**
   * 检查优化建议的安全性
   * @param suggestion 优化建议
   * @returns 安全检查结果
   */
  async check(suggestion: OptimizationSuggestion): Promise<SecurityCheckResult> {
    const checks = [];

    // 风险级别检查
    const riskLevelCheck = this.checkRiskLevel(suggestion);
    checks.push(riskLevelCheck);

    // 操作类型检查
    const operationTypeCheck = this.checkOperationType(suggestion);
    checks.push(operationTypeCheck);

    // 目标节点检查
    const targetNodeCheck = this.checkTargetNode(suggestion);
    checks.push(targetNodeCheck);

    // 操作参数检查
    const parametersCheck = this.checkParameters(suggestion);
    checks.push(parametersCheck);

    // 计算总体风险级别
    const overallRiskLevel = this.calculateOverallRiskLevel(checks);

    // 确定是否通过
    const passed = checks.every(check => check.passed) &&
      this.isRiskLevelAllowed(overallRiskLevel);

    // 生成建议操作
    const recommendedAction = this.generateRecommendedAction(passed, checks, overallRiskLevel);

    return {
      passed,
      checks,
      overallRiskLevel,
      recommendedAction,
    };
  }

  /**
   * 检查风险级别
   * @param suggestion 优化建议
   * @returns 风险级别检查结果
   */
  private checkRiskLevel(suggestion: OptimizationSuggestion): {
    name: string;
    passed: boolean;
    message: string;
    riskLevel: RiskLevel;
  } {
    const riskLevel = suggestion.riskLevel;
    const allowed = this.isRiskLevelAllowed(riskLevel);

    let message = '';
    if (!allowed) {
      if (riskLevel === RiskLevelEnum.HIGH && !this.config.allowHighRisk) {
        message = '高风险操作不被允许';
      } else {
        message = `风险级别 ${riskLevel} 超过了允许的最大风险级别 ${this.config.maxRiskLevel}`;
      }
    } else {
      message = `风险级别 ${riskLevel} 检查通过`;
    }

    return {
      name: '风险级别检查',
      passed: allowed,
      message,
      riskLevel,
    };
  }

  /**
   * 检查操作类型
   * @param suggestion 优化建议
   * @returns 操作类型检查结果
   */
  private checkOperationType(suggestion: OptimizationSuggestion): {
    name: string;
    passed: boolean;
    message: string;
    riskLevel: RiskLevel;
  } {
    // 所有操作类型都允许，这里可以添加具体的操作类型检查
    return {
      name: '操作类型检查',
      passed: true,
      message: `操作类型 ${suggestion.type} 检查通过`,
      riskLevel: RiskLevelEnum.LOW,
    };
  }

  /**
   * 检查目标节点
   * @param suggestion 优化建议
   * @returns 目标节点检查结果
   */
  private checkTargetNode(suggestion: OptimizationSuggestion): {
    name: string;
    passed: boolean;
    message: string;
    riskLevel: RiskLevel;
  } {
    // 如果没有指定节点ID，检查通过
    if (!suggestion.nodeId) {
      return {
        name: '目标节点检查',
        passed: true,
        message: '未指定目标节点，检查通过',
        riskLevel: RiskLevelEnum.LOW,
      };
    }

    // 这里可以添加具体的目标节点检查逻辑
    return {
      name: '目标节点检查',
      passed: true,
      message: `目标节点 ${suggestion.nodeId} 检查通过`,
      riskLevel: RiskLevelEnum.LOW,
    };
  }

  /**
   * 检查操作参数
   * @param suggestion 优化建议
   * @returns 操作参数检查结果
   */
  private checkParameters(suggestion: OptimizationSuggestion): {
    name: string;
    passed: boolean;
    message: string;
    riskLevel: RiskLevel;
  } {
    // 检查参数是否存在
    if (!suggestion.parameters || Object.keys(suggestion.parameters).length === 0) {
      return {
        name: '操作参数检查',
        passed: false,
        message: '操作参数不能为空',
        riskLevel: RiskLevelEnum.MEDIUM,
      };
    }

    // 这里可以添加具体的参数检查逻辑
    return {
      name: '操作参数检查',
      passed: true,
      message: '操作参数检查通过',
      riskLevel: RiskLevelEnum.LOW,
    };
  }

  /**
   * 计算总体风险级别
   * @param checks 检查结果列表
   * @returns 总体风险级别
   */
  private calculateOverallRiskLevel(checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    riskLevel: RiskLevel;
  }>): RiskLevel {
    // 找出最高的风险级别
    const riskLevels = checks.map(check => check.riskLevel);
    const riskLevelOrder = { [RiskLevelEnum.LOW]: 0, [RiskLevelEnum.MEDIUM]: 1, [RiskLevelEnum.HIGH]: 2 };

    let maxRiskLevel = RiskLevelEnum.LOW;
    let maxRiskValue = 0;

    for (const riskLevel of riskLevels) {
      const riskValue = riskLevelOrder[riskLevel];
      if (riskValue > maxRiskValue) {
        maxRiskValue = riskValue;
        maxRiskLevel = riskLevel;
      }
    }

    return maxRiskLevel;
  }

  /**
   * 检查风险级别是否被允许
   * @param riskLevel 风险级别
   * @returns 是否被允许
   */
  private isRiskLevelAllowed(riskLevel: RiskLevel): boolean {
    if (riskLevel === RiskLevelEnum.HIGH && !this.config.allowHighRisk) {
      return false;
    }

    const riskLevelOrder = { [RiskLevelEnum.LOW]: 0, [RiskLevelEnum.MEDIUM]: 1, [RiskLevelEnum.HIGH]: 2 };
    return riskLevelOrder[riskLevel] <= riskLevelOrder[this.config.maxRiskLevel];
  }

  /**
   * 生成建议操作
   * @param passed 是否通过
   * @param checks 检查结果列表
   * @param overallRiskLevel 总体风险级别
   * @returns 建议操作
   */
  private generateRecommendedAction(
    passed: boolean,
    checks: Array<{
      name: string;
      passed: boolean;
      message: string;
      riskLevel: RiskLevel;
    }>,
    overallRiskLevel: RiskLevel
  ): string {
    if (passed) {
      if (this.config.requireConfirmation) {
        return '操作安全检查通过，需要用户确认后执行';
      }
      return '操作安全检查通过，可以自动执行';
    }

    // 找出失败的检查
    const failedChecks = checks.filter(check => !check.passed);
    if (failedChecks.length > 0) {
      return `安全检查失败: ${failedChecks.map(check => check.message).join('; ')}`;
    }

    return `风险级别 ${overallRiskLevel} 超过了允许的最大风险级别 ${this.config.maxRiskLevel}`;
  }

  /**
   * 更新配置
   * @param config 风险控制配置
   */
  updateConfig(config: {
    allowHighRisk: boolean;
    requireConfirmation: boolean;
    maxRiskLevel: RiskLevel;
  }): void {
    this.config = config;
  }
}
