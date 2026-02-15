import type { Workflow } from 'n8n-workflow';
import { v4 as uuidv4 } from 'uuid';
import * as si from 'systeminformation';
import {
  WorkflowScheduler,
  ScheduleResult,
  ScheduleInfo,
  ResourceUsage,
  WorkflowFeatures,
  ScheduleOptions,
  ResourceRequirements
} from './types';

/**
 * 智能工作流调度器
 * 基于工作流复杂度和资源占用的动态调度算法
 */
export class SmartWorkflowScheduler implements WorkflowScheduler {
  private schedules: Map<string, ScheduleInfo> = new Map();
  private resourceHistory: ResourceUsage[] = [];
  private workflowFeaturesCache: Map<string, WorkflowFeatures> = new Map();
  private maxSchedules: number = 100;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 初始化清理定时器，每5分钟清理一次过期的调度计划
    this.cleanupInterval = setInterval(() => {
      this.cleanupSchedules();
    }, 5 * 60 * 1000);
  }

  /**
   * 调度工作流
   * @param workflow 工作流实例
   * @param options 调度选项
   * @returns 调度结果
   */
  async schedule(workflow: Workflow, options: ScheduleOptions = {}): Promise<ScheduleResult> {
    try {
      // 获取工作流特征
      const features = await this.getWorkflowFeatures(workflow);

      // 获取当前资源使用情况
      const resourceUsage = await this.getResourceUsage();

      // 计算资源需求
      const resourceRequirements = options.resourceRequirements || this.calculateResourceRequirements(features);

      // 检查资源是否可用
      if (!this.isResourceAvailable(resourceUsage, resourceRequirements)) {
        // 计算最佳调度时间
        const scheduledTime = await this.calculateOptimalScheduleTime(resourceRequirements);

        // 创建调度计划
        const schedule = this.createSchedule(workflow, features, options, resourceRequirements, scheduledTime);

        return {
          success: true,
          message: '资源暂时不足，工作流已调度到稍后执行',
          schedule
        };
      }

      // 立即执行
      const scheduledTime = options.immediate ? Date.now() : Date.now() + 1000; // 1秒后执行
      const schedule = this.createSchedule(workflow, features, options, resourceRequirements, scheduledTime);

      return {
        success: true,
        message: '工作流已成功调度',
        schedule
      };
    } catch (error) {
      return {
        success: false,
        message: '调度失败',
        error: (error as Error).message
      };
    }
  }

  /**
   * 重新调度工作流
   * @param workflowId 工作流ID
   * @param options 调度选项
   * @returns 调度结果
   */
  async reschedule(workflowId: string, options: ScheduleOptions = {}): Promise<ScheduleResult> {
    try {
      // 取消现有调度
      await this.cancelSchedule(workflowId);

      // TODO: 从存储中获取工作流实例
      // 这里需要实现从存储中获取工作流的逻辑
      const workflow = this.mockGetWorkflow(workflowId);

      if (!workflow) {
        return {
          success: false,
          message: '工作流不存在',
          error: `Workflow ${workflowId} not found`
        };
      }

      // 重新调度
      return this.schedule(workflow, options);
    } catch (error) {
      return {
        success: false,
        message: '重新调度失败',
        error: (error as Error).message
      };
    }
  }

  /**
   * 获取工作流的调度计划
   * @param workflowId 工作流ID
   * @returns 调度计划信息
   */
  async getSchedule(workflowId: string): Promise<ScheduleInfo | null> {
    for (const schedule of this.schedules.values()) {
      if (schedule.workflowId === workflowId &&
          (schedule.status === 'pending' || schedule.status === 'scheduled' || schedule.status === 'running')) {
        return schedule;
      }
    }
    return null;
  }

  /**
   * 获取当前资源使用情况
   * @returns 资源使用情况
   */
  async getResourceUsage(): Promise<ResourceUsage> {
    try {
      // 获取系统信息
      const cpuData = await si.currentLoad();
      const memData = await si.mem();
      const netData = await si.networkStats();
      const diskData = await si.fsSize();

      // 计算网络带宽
      const networkSpeed = netData.reduce((sum, iface) => {
        return sum + iface.rx_sec + iface.tx_sec;
      }, 0) / (1024 * 1024) * 8; // 转换为 Mbps

      // 计算存储使用情况
      const totalStorage = diskData.reduce((sum, disk) => sum + disk.size, 0);
      const usedStorage = diskData.reduce((sum, disk) => sum + disk.used, 0);

      const usage: ResourceUsage = {
        cpu: {
          usage: cpuData.currentLoad || 0,
          cores: cpuData.cpus?.length || 1
        },
        memory: {
          used: memData.used / (1024 * 1024), // 转换为 MB
          total: memData.total / (1024 * 1024), // 转换为 MB
          usage: (memData.used / memData.total) * 100
        },
        network: {
          upload: networkSpeed / 2, // 假设上传和下载各占一半
          download: networkSpeed / 2
        },
        storage: {
          used: usedStorage / (1024 * 1024), // 转换为 MB
          total: totalStorage / (1024 * 1024), // 转换为 MB
          usage: (usedStorage / totalStorage) * 100
        }
      };

      // 保存到历史记录
      this.resourceHistory.push(usage);
      if (this.resourceHistory.length > 100) {
        this.resourceHistory.shift();
      }

      return usage;
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
   * 获取工作流特征
   * @param workflow 工作流实例
   * @returns 工作流特征
   */
  async getWorkflowFeatures(workflow: Workflow): Promise<WorkflowFeatures> {
    const workflowId = workflow.id;

    // 检查缓存
    if (this.workflowFeaturesCache.has(workflowId)) {
      return this.workflowFeaturesCache.get(workflowId)!;
    }

    // 计算工作流特征
    const nodeCount = Object.keys(workflow.nodes || {}).length;
    const connectionCount = this.calculateConnectionCount(workflow);
    const depth = this.calculateWorkflowDepth(workflow);
    const estimatedDuration = this.estimateWorkflowDuration(workflow);
    const complexityScore = this.calculateComplexityScore(nodeCount, connectionCount, depth);
    const resourceRequirements = this.calculateResourceRequirements({
      workflowId,
      workflowName: workflow.name || '',
      nodeCount,
      connectionCount,
      depth,
      estimatedDuration,
      complexityScore,
      resourceRequirements: { cpu: 0, memory: 0 },
      historicalData: undefined
    });

    const features: WorkflowFeatures = {
      workflowId,
      workflowName: workflow.name || '',
      nodeCount,
      connectionCount,
      depth,
      estimatedDuration,
      complexityScore,
      resourceRequirements,
      historicalData: undefined // TODO: 从存储中获取历史数据
    };

    // 缓存结果
    this.workflowFeaturesCache.set(workflowId, features);

    return features;
  }

  /**
   * 取消调度
   * @param workflowId 工作流ID
   * @returns 是否取消成功
   */
  async cancelSchedule(workflowId: string): Promise<boolean> {
    let cancelled = false;

    for (const [id, schedule] of this.schedules.entries()) {
      if (schedule.workflowId === workflowId &&
          (schedule.status === 'pending' || schedule.status === 'scheduled')) {
        this.schedules.delete(id);
        cancelled = true;
      }
    }

    return cancelled;
  }

  /**
   * 获取所有调度计划
   * @returns 调度计划列表
   */
  async getAllSchedules(): Promise<ScheduleInfo[]> {
    return Array.from(this.schedules.values());
  }

  /**
   * 清理过期的调度计划
   * @returns 清理的计划数量
   */
  async cleanupSchedules(): Promise<number> {
    let count = 0;
    const now = Date.now();

    for (const [id, schedule] of this.schedules.entries()) {
      // 清理已完成或失败且超过1小时的计划
      if ((schedule.status === 'completed' || schedule.status === 'failed') &&
          now - schedule.updatedAt > 3600000) {
        this.schedules.delete(id);
        count++;
      }
      // 清理过期的计划
      else if (schedule.status === 'scheduled' && schedule.scheduledTime < now - 3600000) {
        this.schedules.delete(id);
        count++;
      }
    }

    // 限制缓存大小
    while (this.workflowFeaturesCache.size > 50) {
      const firstKey = this.workflowFeaturesCache.keys().next().value;
      this.workflowFeaturesCache.delete(firstKey);
    }

    return count;
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
   * 计算工作流深度
   * @param workflow 工作流实例
   * @returns 工作流深度
   */
  private calculateWorkflowDepth(workflow: Workflow): number {
    const visited = new Set<string>();
    const maxDepth: { value: number } = { value: 0 };

    // 找到所有起始节点（没有入连接的节点）
    const startNodes = this.findStartNodes(workflow);

    // 计算每个起始节点的深度
    startNodes.forEach(nodeName => {
      this.dfsWorkflowDepth(workflow, nodeName, 1, visited, maxDepth);
    });

    return maxDepth.value;
  }

  /**
   * 查找工作流的起始节点
   * @param workflow 工作流实例
   * @returns 起始节点名称列表
   */
  private findStartNodes(workflow: Workflow): string[] {
    const allNodes = new Set(Object.keys(workflow.nodes || {}));
    const nodesWithIncoming = new Set<string>();

    // 找出所有有入连接的节点
    const connections = workflow.connectionsBySourceNode;
    if (connections) {
      Object.values(connections).forEach(sourceConnections => {
        Object.values(sourceConnections).forEach(typeConnections => {
          Object.values(typeConnections).forEach(indexConnections => {
            indexConnections.forEach(connection => {
              if (connection.node) {
                nodesWithIncoming.add(connection.node);
              }
            });
          });
        });
      });
    }

    // 起始节点是没有入连接的节点
    return Array.from(allNodes).filter(node => !nodesWithIncoming.has(node));
  }

  /**
   * 深度优先搜索计算工作流深度
   * @param workflow 工作流实例
   * @param nodeName 当前节点名称
   * @param currentDepth 当前深度
   * @param visited 已访问节点
   * @param maxDepth 最大深度
   */
  private dfsWorkflowDepth(
    workflow: Workflow,
    nodeName: string,
    currentDepth: number,
    visited: Set<string>,
    maxDepth: { value: number }
  ): void {
    if (visited.has(nodeName)) {
      return;
    }

    visited.add(nodeName);

    // 更新最大深度
    if (currentDepth > maxDepth.value) {
      maxDepth.value = currentDepth;
    }

    // 遍历当前节点的所有出连接
    const connections = workflow.connectionsBySourceNode;
    if (connections && connections[nodeName]) {
      Object.values(connections[nodeName]).forEach(typeConnections => {
        Object.values(typeConnections).forEach(indexConnections => {
          indexConnections.forEach(connection => {
            if (connection.node) {
              this.dfsWorkflowDepth(workflow, connection.node, currentDepth + 1, visited, maxDepth);
            }
          });
        });
      });
    }
  }

  /**
   * 估算工作流执行时长
   * @param workflow 工作流实例
   * @returns 估算执行时长（毫秒）
   */
  private estimateWorkflowDuration(workflow: Workflow): number {
    const nodeCount = Object.keys(workflow.nodes || {}).length;

    // 基于节点数量的简单估算
    // 假设每个节点平均执行时间为500ms
    // 加上节点间的协调时间
    return nodeCount * 500 + (nodeCount - 1) * 100;
  }

  /**
   * 计算工作流复杂度评分
   * @param nodeCount 节点数量
   * @param connectionCount 连接数量
   * @param depth 工作流深度
   * @returns 复杂度评分（0-100）
   */
  private calculateComplexityScore(nodeCount: number, connectionCount: number, depth: number): number {
    // 基于节点数量、连接数量和深度的复杂度计算
    const nodeScore = Math.min(nodeCount / 50 * 100, 100);
    const connectionScore = Math.min(connectionCount / 100 * 100, 100);
    const depthScore = Math.min(depth / 10 * 100, 100);

    // 加权平均
    return (nodeScore * 0.4 + connectionScore * 0.4 + depthScore * 0.2);
  }

  /**
   * 计算工作流资源需求
   * @param features 工作流特征
   * @returns 资源需求
   */
  private calculateResourceRequirements(features: WorkflowFeatures): ResourceRequirements {
    // 基于工作流特征计算资源需求
    const baseCpu = 5; // 基础CPU需求（百分比）
    const baseMemory = 50; // 基础内存需求（MB）

    // 基于节点数量的资源需求
    const cpuPerNode = 1;
    const memoryPerNode = 10;

    // 基于复杂度的资源需求调整
    const complexityMultiplier = 1 + (features.complexityScore / 100);

    return {
      cpu: Math.min(baseCpu + (features.nodeCount * cpuPerNode) * complexityMultiplier, 100),
      memory: baseMemory + (features.nodeCount * memoryPerNode) * complexityMultiplier
    };
  }

  /**
   * 检查资源是否可用
   * @param usage 当前资源使用情况
   * @param requirements 资源需求
   * @returns 资源是否可用
   */
  private isResourceAvailable(usage: ResourceUsage, requirements: ResourceRequirements): boolean {
    // 检查CPU是否可用
    const cpuAvailable = usage.cpu.usage + requirements.cpu < 90; // 预留10%的CPU

    // 检查内存是否可用
    const memoryAvailable = usage.memory.used + requirements.memory < usage.memory.total * 0.9; // 预留10%的内存

    return cpuAvailable && memoryAvailable;
  }

  /**
   * 计算最佳调度时间
   * @param requirements 资源需求
   * @returns 最佳调度时间（时间戳）
   */
  private async calculateOptimalScheduleTime(requirements: ResourceRequirements): Promise<number> {
    const now = Date.now();
    let bestTime = now + 60000; // 默认1分钟后
    let bestScore = Infinity;

    // 分析最近的资源使用历史
    if (this.resourceHistory.length > 0) {
      // 预测未来5分钟的资源使用情况
      for (let i = 0; i < 30; i++) {
        const checkTime = now + (i * 10000); // 每10秒检查一次
        const predictedUsage = this.predictResourceUsage(checkTime);

        // 计算资源可用性评分
        const cpuScore = predictedUsage.cpu.usage + requirements.cpu;
        const memoryScore = predictedUsage.memory.used + requirements.memory;
        const totalScore = cpuScore + memoryScore;

        // 检查是否满足资源需求
        if (predictedUsage.cpu.usage + requirements.cpu < 90 &&
            predictedUsage.memory.used + requirements.memory < predictedUsage.memory.total * 0.9) {
          if (totalScore < bestScore) {
            bestScore = totalScore;
            bestTime = checkTime;
          }
        }
      }
    }

    return bestTime;
  }

  /**
   * 预测资源使用情况
   * @param timestamp 预测时间戳
   * @returns 预测的资源使用情况
   */
  private predictResourceUsage(timestamp: number): ResourceUsage {
    if (this.resourceHistory.length === 0) {
      // 返回默认值
      return {
        cpu: { usage: 10, cores: 1 },
        memory: { used: 100, total: 1024, usage: 10 }
      };
    }

    // 简单的线性预测
    // 这里可以实现更复杂的预测算法，如移动平均、ARIMA等
    const recentHistory = this.resourceHistory.slice(-10); // 使用最近10个数据点

    const avgCpuUsage = recentHistory.reduce((sum, usage) => sum + usage.cpu.usage, 0) / recentHistory.length;
    const avgMemoryUsed = recentHistory.reduce((sum, usage) => sum + usage.memory.used, 0) / recentHistory.length;
    const totalMemory = recentHistory[0].memory.total;

    return {
      cpu: {
        usage: avgCpuUsage,
        cores: recentHistory[0].cpu.cores
      },
      memory: {
        used: avgMemoryUsed,
        total: totalMemory,
        usage: (avgMemoryUsed / totalMemory) * 100
      }
    };
  }

  /**
   * 创建调度计划
   * @param workflow 工作流实例
   * @param features 工作流特征
   * @param options 调度选项
   * @param requirements 资源需求
   * @param scheduledTime 计划执行时间
   * @returns 调度计划
   */
  private createSchedule(
    workflow: Workflow,
    features: WorkflowFeatures,
    options: ScheduleOptions,
    requirements: ResourceRequirements,
    scheduledTime: number
  ): ScheduleInfo {
    const schedule: ScheduleInfo = {
      id: uuidv4(),
      workflowId: workflow.id,
      workflowName: workflow.name || '',
      scheduledTime,
      estimatedDuration: options.estimatedDuration || features.estimatedDuration,
      priority: options.priority || 5, // 默认优先级5
      resourceRequirements: requirements,
      status: 'scheduled',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 添加到调度列表
    this.schedules.set(schedule.id, schedule);

    // 限制调度计划数量
    if (this.schedules.size > this.maxSchedules) {
      this.cleanupSchedules();
    }

    return schedule;
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
   * 关闭调度器
   */
  public close(): void {
    clearInterval(this.cleanupInterval);
    this.schedules.clear();
    this.resourceHistory.clear();
    this.workflowFeaturesCache.clear();
  }
}

/**
 * 创建智能工作流调度器实例
 * @returns 工作流调度器实例
 */
export function createWorkflowScheduler(): WorkflowScheduler {
  return new SmartWorkflowScheduler();
}
