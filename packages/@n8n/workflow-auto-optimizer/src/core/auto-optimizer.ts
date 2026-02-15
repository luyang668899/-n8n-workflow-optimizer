import { v4 as uuidv4 } from 'uuid';
import { CronJob } from 'cron';
import type { Workflow } from 'n8n-workflow';
import type {
  OptimizationOperation,
  OptimizationPlan,
  AutoOptimizerConfig,
  OptimizationContext,
  OptimizationSuggestion,
  SecurityCheckResult,
  OptimizationExecutionResult,
  OptimizationType,
  OptimizationStatus,
  RiskLevel,
} from '../types';
import { OptimizationType as OptimizationTypeEnum } from '../types';
import { OptimizationStatus as OptimizationStatusEnum } from '../types';
import { RiskLevel as RiskLevelEnum } from '../types';
import { SecurityChecker } from './security-checker';
import { OperationExecutor } from './operation-executor';
import { RollbackManager } from './rollback-manager';
import { ValidationManager } from './validation-manager';
import { PlanManager } from './plan-manager';

/**
 * 自动优化执行器
 * 负责根据AI优化建议自动执行安全的工作流优化操作
 */
export class AutoOptimizer {
  private config: AutoOptimizerConfig;
  private securityChecker: SecurityChecker;
  private operationExecutor: OperationExecutor;
  private rollbackManager: RollbackManager;
  private validationManager: ValidationManager;
  private planManager: PlanManager;
  private runningJobs: Map<string, CronJob> = new Map();

  /**
   * 构造函数
   * @param config 自动优化执行器配置
   */
  constructor(config: Partial<AutoOptimizerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxParallelOperations: config.maxParallelOperations ?? 5,
      operationTimeout: config.operationTimeout ?? 30000,
      riskControl: config.riskControl ?? this.getDefaultRiskControlConfig(),
      rollback: config.rollback ?? this.getDefaultRollbackConfig(),
      validation: config.validation ?? this.getDefaultValidationConfig(),
    };

    this.securityChecker = new SecurityChecker(this.config.riskControl);
    this.operationExecutor = new OperationExecutor(this.config);
    this.rollbackManager = new RollbackManager(this.config.rollback);
    this.validationManager = new ValidationManager(this.config.validation);
    this.planManager = new PlanManager();
  }

  /**
   * 执行优化建议
   * @param suggestions 优化建议列表
   * @param workflow 工作流实例
   * @returns 执行结果
   */
  async executeSuggestions(
    suggestions: OptimizationSuggestion[],
    workflow?: Workflow
  ): Promise<OptimizationExecutionResult> {
    const startTime = Date.now();
    const executedOperations: OptimizationOperation[] = [];
    const successfulOperations: OptimizationOperation[] = [];
    const failedOperations: OptimizationOperation[] = [];

    for (const suggestion of suggestions) {
      // 安全检查
      const securityCheckResult = await this.securityChecker.check(suggestion);
      if (!securityCheckResult.passed) {
        const operation = this.createOperationFromSuggestion(suggestion);
        operation.status = OptimizationStatusEnum.FAILED;
        operation.result = {
          success: false,
          message: `安全检查失败: ${securityCheckResult.recommendedAction}`,
        };
        executedOperations.push(operation);
        failedOperations.push(operation);
        continue;
      }

      // 执行优化操作
      try {
        const operation = this.createOperationFromSuggestion(suggestion);
        operation.status = OptimizationStatusEnum.IN_PROGRESS;
        executedOperations.push(operation);

        const context: OptimizationContext = {
          workflow,
          environment: {},
          logs: [],
          startTime: Date.now(),
          timeout: this.config.operationTimeout,
        };

        const result = await this.operationExecutor.execute(operation, context);

        if (result.success) {
          operation.status = OptimizationStatusEnum.SUCCESS;
          operation.result = result;
          operation.executedAt = Date.now();
          successfulOperations.push(operation);

          // 验证优化效果
          if (this.config.validation.enabled) {
            const validationResult = await this.validationManager.validate(
              workflow!, // 假设workflow存在
              operation
            );

            if (!validationResult.passed) {
              // 回滚操作
              if (this.config.rollback.enabled && operation.rollbackData) {
                await this.rollbackManager.rollback(operation, context);
                operation.status = OptimizationStatusEnum.ROLLED_BACK;
                operation.result = {
                  success: false,
                  message: `优化效果验证失败，已回滚操作: ${validationResult.message}`,
                };
                successfulOperations.pop();
                failedOperations.push(operation);
              }
            }
          }
        } else {
          operation.status = OptimizationStatusEnum.FAILED;
          operation.result = result;
          failedOperations.push(operation);
        }
      } catch (error) {
        const operation = this.createOperationFromSuggestion(suggestion);
        operation.status = OptimizationStatusEnum.FAILED;
        operation.result = {
          success: false,
          message: `执行失败: ${(error as Error).message}`,
        };
        executedOperations.push(operation);
        failedOperations.push(operation);
      }
    }

    // 计算总体性能提升
    const performanceGain = this.calculateOverallPerformanceGain(successfulOperations);

    return {
      success: failedOperations.length === 0,
      message: failedOperations.length === 0
        ? `成功执行 ${successfulOperations.length} 个优化操作`
        : `执行 ${executedOperations.length} 个操作，成功 ${successfulOperations.length} 个，失败 ${failedOperations.length} 个`,
      executedOperations,
      successfulOperations,
      failedOperations,
      performanceGain,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * 创建优化计划
   * @param name 计划名称
   * @param workflowIds 工作流ID列表
   * @param suggestions 优化建议列表
   * @param schedule 执行计划
   * @returns 优化计划
   */
  async createPlan(
    name: string,
    workflowIds: string[],
    suggestions: OptimizationSuggestion[],
    schedule?: {
      cronExpression: string;
      enabled: boolean;
    }
  ): Promise<OptimizationPlan> {
    const operations = suggestions.map(suggestion => this.createOperationFromSuggestion(suggestion));
    const plan = await this.planManager.createPlan(name, workflowIds, operations, schedule);

    // 如果启用了调度，创建定时任务
    if (schedule?.enabled) {
      this.schedulePlan(plan);
    }

    return plan;
  }

  /**
   * 执行优化计划
   * @param planId 计划ID
   * @param workflow 工作流实例
   * @returns 执行结果
   */
  async executePlan(planId: string, workflow?: Workflow): Promise<OptimizationExecutionResult> {
    const plan = await this.planManager.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    plan.status = 'executing';
    await this.planManager.updatePlan(plan);

    try {
      const suggestions = plan.operations.map(operation => ({
        id: operation.id,
        type: operation.type,
        description: operation.description,
        details: '',
        expectedPerformanceGain: operation.expectedPerformanceGain,
        riskLevel: operation.riskLevel,
        workflowId: operation.workflowId,
        nodeId: operation.nodeId,
        parameters: operation.parameters,
        priority: 'high' as const,
        createdAt: Date.now(),
      }));

      const result = await this.executeSuggestions(suggestions, workflow);

      plan.status = result.success ? 'completed' : 'failed';
      plan.lastExecutedAt = Date.now();
      plan.executionResult = {
        success: result.success,
        message: result.message,
        executedOperations: result.executedOperations.length,
        successfulOperations: result.successfulOperations.length,
      };

      await this.planManager.updatePlan(plan);

      return result;
    } catch (error) {
      plan.status = 'failed';
      plan.lastExecutedAt = Date.now();
      plan.executionResult = {
        success: false,
        message: `执行失败: ${(error as Error).message}`,
        executedOperations: 0,
        successfulOperations: 0,
      };

      await this.planManager.updatePlan(plan);

      throw error;
    }
  }

  /**
   * 调度优化计划
   * @param plan 优化计划
   */
  private schedulePlan(plan: OptimizationPlan): void {
    if (!plan.schedule?.enabled || !plan.schedule.cronExpression) {
      return;
    }

    const job = new CronJob(
      plan.schedule.cronExpression,
      async () => {
        try {
          await this.executePlan(plan.id);
        } catch (error) {
          console.error(`Error executing scheduled plan ${plan.id}:`, error);
        }
      },
      null,
      true
    );

    this.runningJobs.set(plan.id, job);
  }

  /**
   * 取消调度优化计划
   * @param planId 计划ID
   */
  unschedulePlan(planId: string): void {
    const job = this.runningJobs.get(planId);
    if (job) {
      job.stop();
      this.runningJobs.delete(planId);
    }
  }

  /**
   * 从优化建议创建优化操作
   * @param suggestion 优化建议
   * @returns 优化操作
   */
  private createOperationFromSuggestion(suggestion: OptimizationSuggestion): OptimizationOperation {
    return {
      id: uuidv4(),
      type: suggestion.type,
      description: suggestion.description,
      workflowId: suggestion.workflowId,
      nodeId: suggestion.nodeId,
      parameters: suggestion.parameters,
      expectedPerformanceGain: suggestion.expectedPerformanceGain,
      riskLevel: suggestion.riskLevel,
      status: OptimizationStatusEnum.PENDING,
      createdAt: Date.now(),
    };
  }

  /**
   * 计算总体性能提升
   * @param operations 成功的操作列表
   * @returns 总体性能提升
   */
  private calculateOverallPerformanceGain(operations: OptimizationOperation[]): number {
    if (operations.length === 0) {
      return 0;
    }

    const totalGain = operations.reduce((sum, operation) => {
      return sum + (operation.result?.actualPerformanceGain || operation.expectedPerformanceGain);
    }, 0);

    return totalGain / operations.length;
  }

  /**
   * 获取默认风险控制配置
   * @returns 默认风险控制配置
   */
  private getDefaultRiskControlConfig(): AutoOptimizerConfig['riskControl'] {
    return {
      allowHighRisk: false,
      requireConfirmation: false,
      maxRiskLevel: RiskLevelEnum.MEDIUM,
    };
  }

  /**
   * 获取默认回滚配置
   * @returns 默认回滚配置
   */
  private getDefaultRollbackConfig(): AutoOptimizerConfig['rollback'] {
    return {
      enabled: true,
      timeout: 15000,
    };
  }

  /**
   * 获取默认验证配置
   * @returns 默认验证配置
   */
  private getDefaultValidationConfig(): AutoOptimizerConfig['validation'] {
    return {
      enabled: true,
      iterations: 3,
      performanceGainThreshold: 5,
    };
  }

  /**
   * 获取配置
   * @returns 自动优化执行器配置
   */
  getConfig(): AutoOptimizerConfig {
    return this.config;
  }

  /**
   * 更新配置
   * @param config 配置
   */
  updateConfig(config: Partial<AutoOptimizerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 关闭自动优化执行器
   */
  async close(): Promise<void> {
    // 停止所有运行的定时任务
    for (const [planId, job] of this.runningJobs.entries()) {
      job.stop();
    }
    this.runningJobs.clear();

    // 关闭各个管理器
    await this.planManager.close();
  }
}

/**
 * 创建自动优化执行器实例的工厂函数
 * @param config 配置
 * @returns 自动优化执行器实例
 */
export function createAutoOptimizer(config?: Partial<AutoOptimizerConfig>): AutoOptimizer {
  return new AutoOptimizer(config);
}
