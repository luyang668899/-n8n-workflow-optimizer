import { v4 as uuidv4 } from 'uuid';
import type {
  OptimizationPlan,
  OptimizationOperation,
} from '../types';

/**
 * 计划管理器
 * 负责管理优化计划的创建、更新和执行
 */
export class PlanManager {
  private plans: Map<string, OptimizationPlan> = new Map();

  /**
   * 创建优化计划
   * @param name 计划名称
   * @param workflowIds 工作流ID列表
   * @param operations 优化操作列表
   * @param schedule 执行计划
   * @returns 优化计划
   */
  async createPlan(
    name: string,
    workflowIds: string[],
    operations: OptimizationOperation[],
    schedule?: {
      cronExpression: string;
      enabled: boolean;
    }
  ): Promise<OptimizationPlan> {
    const plan: OptimizationPlan = {
      id: uuidv4(),
      name,
      workflowIds,
      operations,
      schedule,
      status: 'draft',
      createdAt: Date.now(),
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  /**
   * 获取优化计划
   * @param planId 计划ID
   * @returns 优化计划
   */
  async getPlan(planId: string): Promise<OptimizationPlan | undefined> {
    return this.plans.get(planId);
  }

  /**
   * 获取所有优化计划
   * @returns 优化计划列表
   */
  async getPlans(): Promise<OptimizationPlan[]> {
    return Array.from(this.plans.values());
  }

  /**
   * 更新优化计划
   * @param plan 优化计划
   * @returns 更新后的优化计划
   */
  async updatePlan(plan: OptimizationPlan): Promise<OptimizationPlan> {
    this.plans.set(plan.id, plan);
    return plan;
  }

  /**
   * 删除优化计划
   * @param planId 计划ID
   * @returns 是否删除成功
   */
  async deletePlan(planId: string): Promise<boolean> {
    return this.plans.delete(planId);
  }

  /**
   * 激活优化计划
   * @param planId 计划ID
   * @returns 激活后的优化计划
   */
  async activatePlan(planId: string): Promise<OptimizationPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    plan.status = 'scheduled';
    return this.updatePlan(plan);
  }

  /**
   * 停用优化计划
   * @param planId 计划ID
   * @returns 停用后的优化计划
   */
  async deactivatePlan(planId: string): Promise<OptimizationPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    plan.status = 'draft';
    if (plan.schedule) {
      plan.schedule.enabled = false;
    }
    return this.updatePlan(plan);
  }

  /**
   * 添加操作到优化计划
   * @param planId 计划ID
   * @param operation 优化操作
   * @returns 更新后的优化计划
   */
  async addOperationToPlan(planId: string, operation: OptimizationOperation): Promise<OptimizationPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    plan.operations.push(operation);
    return this.updatePlan(plan);
  }

  /**
   * 从优化计划中移除操作
   * @param planId 计划ID
   * @param operationId 操作ID
   * @returns 更新后的优化计划
   */
  async removeOperationFromPlan(planId: string, operationId: string): Promise<OptimizationPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    plan.operations = plan.operations.filter(op => op.id !== operationId);
    return this.updatePlan(plan);
  }

  /**
   * 更新优化计划的执行计划
   * @param planId 计划ID
   * @param schedule 执行计划
   * @returns 更新后的优化计划
   */
  async updateSchedule(planId: string, schedule: {
    cronExpression: string;
    enabled: boolean;
  }): Promise<OptimizationPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    plan.schedule = schedule;
    return this.updatePlan(plan);
  }

  /**
   * 关闭计划管理器
   */
  async close(): Promise<void> {
    // 清理所有计划
    this.plans.clear();
  }
}
