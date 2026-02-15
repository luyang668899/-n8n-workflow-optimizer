import type { Workflow } from 'n8n-workflow';
import type { WorkflowExecutionData } from '../types';

/**
 * 依赖强度计算器
 * 负责计算不同类型依赖的强度值
 */
export class DependencyStrengthCalculator {
  /**
   * 计算触发依赖强度
   * @param sourceWorkflow 源工作流
   * @param targetWorkflow 目标工作流
   * @returns 依赖强度（0-1）
   */
  calculateTriggerDependencyStrength(sourceWorkflow: Workflow, targetWorkflow: Workflow): number {
    // 基础强度
    let strength = 0.7;

    // 根据工作流复杂度调整强度
    const sourceComplexity = this.calculateWorkflowComplexity(sourceWorkflow);
    const targetComplexity = this.calculateWorkflowComplexity(targetWorkflow);

    // 如果目标工作流复杂度高，依赖强度增加
    if (targetComplexity > 5) {
      strength += 0.1;
    }

    // 如果源工作流复杂度高，依赖强度也会增加
    if (sourceComplexity > 5) {
      strength += 0.1;
    }

    // 确保强度在 0-1 范围内
    return Math.min(Math.max(strength, 0), 1);
  }

  /**
   * 计算数据依赖强度
   * @param sourceWorkflow 源工作流
   * @param targetWorkflow 目标工作流
   * @returns 依赖强度（0-1）
   */
  calculateDataDependencyStrength(sourceWorkflow: Workflow, targetWorkflow: Workflow): number {
    // 基础强度
    let strength = 0.8;

    // 根据工作流复杂度调整强度
    const sourceComplexity = this.calculateWorkflowComplexity(sourceWorkflow);
    const targetComplexity = this.calculateWorkflowComplexity(targetWorkflow);

    // 如果源工作流高度依赖目标工作流的数据，强度增加
    if (sourceComplexity > 3) {
      strength += 0.1;
    }

    // 如果目标工作流数据量较大，强度增加
    if (targetComplexity > 3) {
      strength += 0.1;
    }

    // 确保强度在 0-1 范围内
    return Math.min(Math.max(strength, 0), 1);
  }

  /**
   * 计算资源依赖强度
   * @param sourceWorkflow 源工作流
   * @param targetWorkflow 目标工作流
   * @param resourceName 资源名称
   * @returns 依赖强度（0-1）
   */
  calculateResourceDependencyStrength(sourceWorkflow: Workflow, targetWorkflow: Workflow, resourceName: string): number {
    // 基础强度
    let strength = 0.5;

    // 根据资源类型调整强度
    const resourceType = this.getResourceType(resourceName);
    switch (resourceType) {
      case 'database':
        strength += 0.2;
        break;
      case 'api':
        strength += 0.15;
        break;
      case 'file':
        strength += 0.1;
        break;
    }

    // 根据工作流复杂度调整强度
    const sourceComplexity = this.calculateWorkflowComplexity(sourceWorkflow);
    const targetComplexity = this.calculateWorkflowComplexity(targetWorkflow);

    // 如果两个工作流都很复杂，强度增加
    if (sourceComplexity > 3 && targetComplexity > 3) {
      strength += 0.1;
    }

    // 确保强度在 0-1 范围内
    return Math.min(Math.max(strength, 0), 1);
  }

  /**
   * 计算时间依赖强度
   * @param sourceExecData 源工作流执行数据
   * @param targetExecData 目标工作流执行数据
   * @returns 依赖强度（0-1）
   */
  calculateTimeDependencyStrength(sourceExecData: WorkflowExecutionData, targetExecData: WorkflowExecutionData): number {
    // 计算时间差（分钟）
    const timeDiff = Math.abs(sourceExecData.lastExecutionTime - targetExecData.lastExecutionTime);
    const timeDiffMinutes = timeDiff / (1000 * 60);

    // 时间差越小，依赖强度越大
    let strength = Math.max(0, 1 - (timeDiffMinutes / 60));

    // 根据执行频率调整强度
    const avgFrequency = (sourceExecData.executionFrequency + targetExecData.executionFrequency) / 2;
    if (avgFrequency > 10) { // 高频执行
      strength += 0.2;
    } else if (avgFrequency > 1) { // 中频执行
      strength += 0.1;
    }

    // 确保强度在 0-1 范围内
    return Math.min(Math.max(strength, 0), 1);
  }

  /**
   * 计算工作流复杂度
   * @param workflow 工作流
   * @returns 复杂度分数（0-10）
   */
  private calculateWorkflowComplexity(workflow: Workflow): number {
    // 基于节点数量计算复杂度
    const nodeCount = workflow.nodes.length;

    // 基于连接数量计算复杂度
    const connectionCount = workflow.connections.length;

    // 基于触发器类型调整复杂度
    const triggerComplexity = this.calculateTriggerComplexity(workflow);

    // 综合计算复杂度
    const complexity = (nodeCount * 0.5) + (connectionCount * 0.3) + (triggerComplexity * 0.2);

    // 限制复杂度范围
    return Math.min(Math.max(complexity, 0), 10);
  }

  /**
   * 计算触发器复杂度
   * @param workflow 工作流
   * @returns 触发器复杂度（0-5）
   */
  private calculateTriggerComplexity(workflow: Workflow): number {
    // 找到触发器节点
    const triggerNodes = workflow.nodes.filter(node => node.type.includes('trigger'));

    if (triggerNodes.length === 0) {
      return 0;
    }

    // 根据触发器类型计算复杂度
    const triggerNode = triggerNodes[0];
    const triggerType = triggerNode.type;

    switch (triggerType) {
      case 'n8n-nodes-base.schedule':
        return 1; // 简单的定时触发器
      case 'n8n-nodes-base.webhook':
        return 2; // 中等复杂度的 webhook 触发器
      case 'n8n-nodes-base.emailReadImap':
        return 3; // 较复杂的邮件触发器
      case 'n8n-nodes-base.push':
        return 2; // 中等复杂度的推送触发器
      default:
        return 1; // 默认复杂度
    }
  }

  /**
   * 获取资源类型
   * @param resourceName 资源名称
   * @returns 资源类型
   */
  private getResourceType(resourceName: string): string {
    // 基于资源名称判断资源类型
    const lowerResourceName = resourceName.toLowerCase();

    if (lowerResourceName.includes('db') || lowerResourceName.includes('database') || lowerResourceName.includes('sql')) {
      return 'database';
    } else if (lowerResourceName.includes('api') || lowerResourceName.includes('http') || lowerResourceName.includes('rest')) {
      return 'api';
    } else if (lowerResourceName.includes('file') || lowerResourceName.includes('storage') || lowerResourceName.includes('s3')) {
      return 'file';
    } else {
      return 'other';
    }
  }

  /**
   * 计算综合依赖强度
   * @param dependencies 依赖列表
   * @returns 综合依赖强度（0-1）
   */
  calculateCompositeDependencyStrength(dependencies: Array<{ type: string; strength: number }>): number {
    if (dependencies.length === 0) {
      return 0;
    }

    // 计算加权平均强度
    const weights: Record<string, number> = {
      trigger: 0.4,
      data: 0.4,
      resource: 0.1,
      time: 0.1,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    dependencies.forEach(dep => {
      const weight = weights[dep.type] || 0.25;
      weightedSum += dep.strength * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
}
