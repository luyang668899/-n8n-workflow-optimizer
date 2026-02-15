import type { Workflow } from 'n8n-workflow';
import type {
  WorkflowDependency,
  DependencyType,
  DependencyDetails,
  WorkflowNode,
  DependencyGraph,
  DependencyAnalyzerConfig,
  DependencyAnalysisResult,
  DependencyStatistics,
  DependencySuggestion,
  BottleneckAnalysis,
  BottleneckWorkflow,
  BottleneckPropagationPath,
  WorkflowExecutionData
} from '../types';
import { DependencyType as DependencyTypeEnum } from '../types';
import { WorkflowParser } from '../parser/workflow-parser';
import { DependencyVisualizer } from '../visualization/dependency-visualizer';
import { DependencyStrengthCalculator } from './dependency-strength-calculator';

/**
 * 工作流依赖分析器
 * 负责分析工作流之间的依赖关系，构建依赖图，并提供优化建议
 */
export class DependencyAnalyzer {
  private config: DependencyAnalyzerConfig;
  private workflowParser: WorkflowParser;
  private dependencyVisualizer: DependencyVisualizer;
  private dependencyStrengthCalculator: DependencyStrengthCalculator;

  /**
   * 构造函数
   * @param config 依赖分析配置
   */
  constructor(config: Partial<DependencyAnalyzerConfig> = {}) {
    this.config = {
      analyzeTriggerDependencies: config.analyzeTriggerDependencies ?? true,
      analyzeDataDependencies: config.analyzeDataDependencies ?? true,
      analyzeResourceDependencies: config.analyzeResourceDependencies ?? true,
      analyzeTimeDependencies: config.analyzeTimeDependencies ?? true,
      dependencyStrengthThreshold: config.dependencyStrengthThreshold ?? 0.1,
      maxAnalysisDepth: config.maxAnalysisDepth ?? 10,
      generateVisualization: config.generateVisualization ?? false,
      visualizationOutputPath: config.visualizationOutputPath ?? './visualizations',
    };

    this.workflowParser = new WorkflowParser();
    this.dependencyVisualizer = new DependencyVisualizer();
    this.dependencyStrengthCalculator = new DependencyStrengthCalculator();
  }

  /**
   * 分析工作流依赖关系
   * @param workflows 工作流列表
   * @param executionData 工作流执行数据
   * @returns 依赖分析结果
   */
  async analyze(workflows: Workflow[], executionData: WorkflowExecutionData[] = []): Promise<DependencyAnalysisResult> {
    // 构建工作流节点
    const nodes = this.buildWorkflowNodes(workflows, executionData);

    // 分析依赖关系
    const dependencies = this.analyzeDependencies(workflows, executionData);

    // 构建依赖图
    const graph = this.buildDependencyGraph(nodes, dependencies);

    // 计算依赖统计
    const statistics = this.calculateStatistics(graph);

    // 分析瓶颈
    const bottleneckAnalysis = this.analyzeBottlenecks(graph, executionData);

    // 生成优化建议
    const suggestions = this.generateSuggestions(graph, bottleneckAnalysis);

    // 生成可视化
    if (this.config.generateVisualization) {
      await this.generateVisualization(graph, bottleneckAnalysis);
    }

    return {
      graph,
      statistics,
      suggestions,
      bottleneckAnalysis,
    };
  }

  /**
   * 构建工作流节点
   * @param workflows 工作流列表
   * @param executionData 执行数据
   * @returns 工作流节点列表
   */
  private buildWorkflowNodes(workflows: Workflow[], executionData: WorkflowExecutionData[]): WorkflowNode[] {
    return workflows.map(workflow => {
      const execData = executionData.find(data => data.workflowId === workflow.id) || {
        workflowId: workflow.id,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: 0,
        lastExecutionTime: Date.now(),
        executionFrequency: 0,
      };

      return {
        id: workflow.id,
        name: workflow.name,
        workflow,
        inDegree: 0,
        outDegree: 0,
        executionFrequency: execData.executionFrequency,
        averageExecutionTime: execData.averageExecutionTime,
        failureRate: execData.executionCount > 0 ? execData.failureCount / execData.executionCount : 0,
        bottleneckScore: 0,
      };
    });
  }

  /**
   * 分析依赖关系
   * @param workflows 工作流列表
   * @param executionData 执行数据
   * @returns 依赖关系列表
   */
  private analyzeDependencies(workflows: Workflow[], executionData: WorkflowExecutionData[]): WorkflowDependency[] {
    const dependencies: WorkflowDependency[] = [];

    // 分析触发依赖
    if (this.config.analyzeTriggerDependencies) {
      dependencies.push(...this.analyzeTriggerDependencies(workflows));
    }

    // 分析数据依赖
    if (this.config.analyzeDataDependencies) {
      dependencies.push(...this.analyzeDataDependencies(workflows));
    }

    // 分析资源依赖
    if (this.config.analyzeResourceDependencies) {
      dependencies.push(...this.analyzeResourceDependencies(workflows));
    }

    // 分析时间依赖
    if (this.config.analyzeTimeDependencies) {
      dependencies.push(...this.analyzeTimeDependencies(workflows, executionData));
    }

    // 过滤低于阈值的依赖
    return dependencies.filter(dep => dep.dependencyStrength >= this.config.dependencyStrengthThreshold);
  }

  /**
   * 分析触发依赖
   * @param workflows 工作流列表
   * @returns 触发依赖列表
   */
  private analyzeTriggerDependencies(workflows: Workflow[]): WorkflowDependency[] {
    const dependencies: WorkflowDependency[] = [];

    workflows.forEach(sourceWorkflow => {
      // 检查工作流中是否有触发其他工作流的节点
      const triggerNodes = this.workflowParser.findTriggerNodes(sourceWorkflow);

      triggerNodes.forEach(triggerNode => {
        const targetWorkflowIds = this.workflowParser.extractTargetWorkflows(triggerNode);

        targetWorkflowIds.forEach(targetWorkflowId => {
          const targetWorkflow = workflows.find(wf => wf.id === targetWorkflowId);
          if (targetWorkflow) {
            const dependencyStrength = this.dependencyStrengthCalculator.calculateTriggerDependencyStrength(
              sourceWorkflow,
              targetWorkflow
            );

            dependencies.push({
              sourceWorkflowId: sourceWorkflow.id,
              sourceWorkflowName: sourceWorkflow.name,
              targetWorkflowId: targetWorkflow.id,
              targetWorkflowName: targetWorkflow.name,
              dependencyType: DependencyTypeEnum.TRIGGER,
              dependencyStrength,
              details: {
                triggerMethod: this.workflowParser.getTriggerMethod(triggerNode),
                description: `Workflow ${sourceWorkflow.name} triggers ${targetWorkflow.name}`,
              },
            });
          }
        });
      });
    });

    return dependencies;
  }

  /**
   * 分析数据依赖
   * @param workflows 工作流列表
   * @returns 数据依赖列表
   */
  private analyzeDataDependencies(workflows: Workflow[]): WorkflowDependency[] {
    const dependencies: WorkflowDependency[] = [];

    workflows.forEach(sourceWorkflow => {
      // 检查工作流中是否有引用其他工作流数据的节点
      const dataReferenceNodes = this.workflowParser.findDataReferenceNodes(sourceWorkflow);

      dataReferenceNodes.forEach(referenceNode => {
        const targetWorkflowIds = this.workflowParser.extractReferencedWorkflows(referenceNode);

        targetWorkflowIds.forEach(targetWorkflowId => {
          const targetWorkflow = workflows.find(wf => wf.id === targetWorkflowId);
          if (targetWorkflow) {
            const dependencyStrength = this.dependencyStrengthCalculator.calculateDataDependencyStrength(
              sourceWorkflow,
              targetWorkflow
            );

            dependencies.push({
              sourceWorkflowId: sourceWorkflow.id,
              sourceWorkflowName: sourceWorkflow.name,
              targetWorkflowId: targetWorkflow.id,
              targetWorkflowName: targetWorkflow.name,
              dependencyType: DependencyTypeEnum.DATA,
              dependencyStrength,
              details: {
                dataReferencePath: this.workflowParser.getDataReferencePath(referenceNode),
                description: `Workflow ${sourceWorkflow.name} references data from ${targetWorkflow.name}`,
              },
            });
          }
        });
      });
    });

    return dependencies;
  }

  /**
   * 分析资源依赖
   * @param workflows 工作流列表
   * @returns 资源依赖列表
   */
  private analyzeResourceDependencies(workflows: Workflow[]): WorkflowDependency[] {
    const dependencies: WorkflowDependency[] = [];
    const resourceUsage = new Map<string, string[]>(); // 资源名称 -> 工作流 ID 列表

    // 收集所有工作流使用的资源
    workflows.forEach(workflow => {
      const resources = this.workflowParser.extractResources(workflow);
      resources.forEach(resource => {
        if (!resourceUsage.has(resource)) {
          resourceUsage.set(resource, []);
        }
        resourceUsage.get(resource)?.push(workflow.id);
      });
    });

    // 分析共享资源的工作流之间的依赖
    resourceUsage.forEach((workflowIds, resourceName) => {
      if (workflowIds.length >= 2) {
        // 为每对工作流创建资源依赖
        for (let i = 0; i < workflowIds.length; i++) {
          for (let j = i + 1; j < workflowIds.length; j++) {
            const sourceWorkflow = workflows.find(wf => wf.id === workflowIds[i]);
            const targetWorkflow = workflows.find(wf => wf.id === workflowIds[j]);

            if (sourceWorkflow && targetWorkflow) {
              const dependencyStrength = this.dependencyStrengthCalculator.calculateResourceDependencyStrength(
                sourceWorkflow,
                targetWorkflow,
                resourceName
              );

              dependencies.push({
                sourceWorkflowId: sourceWorkflow.id,
                sourceWorkflowName: sourceWorkflow.name,
                targetWorkflowId: targetWorkflow.id,
                targetWorkflowName: targetWorkflow.name,
                dependencyType: DependencyTypeEnum.RESOURCE,
                dependencyStrength,
                details: {
                  resourceName,
                  description: `Workflows ${sourceWorkflow.name} and ${targetWorkflow.name} share resource ${resourceName}`,
                },
              });
            }
          }
        }
      }
    });

    return dependencies;
  }

  /**
   * 分析时间依赖
   * @param workflows 工作流列表
   * @param executionData 执行数据
   * @returns 时间依赖列表
   */
  private analyzeTimeDependencies(workflows: Workflow[], executionData: WorkflowExecutionData[]): WorkflowDependency[] {
    const dependencies: WorkflowDependency[] = [];

    // 分析工作流执行时间的相关性
    for (let i = 0; i < workflows.length; i++) {
      for (let j = 0; j < workflows.length; j++) {
        if (i === j) continue;

        const sourceWorkflow = workflows[i];
        const targetWorkflow = workflows[j];

        const sourceExecData = executionData.find(data => data.workflowId === sourceWorkflow.id);
        const targetExecData = executionData.find(data => data.workflowId === targetWorkflow.id);

        if (sourceExecData && targetExecData) {
          const timeWindow = this.calculateTimeWindow(sourceExecData, targetExecData);
          if (timeWindow < 60) { // 60分钟内的执行视为时间依赖
            const dependencyStrength = this.dependencyStrengthCalculator.calculateTimeDependencyStrength(
              sourceExecData,
              targetExecData
            );

            dependencies.push({
              sourceWorkflowId: sourceWorkflow.id,
              sourceWorkflowName: sourceWorkflow.name,
              targetWorkflowId: targetWorkflow.id,
              targetWorkflowName: targetWorkflow.name,
              dependencyType: DependencyTypeEnum.TIME,
              dependencyStrength,
              details: {
                timeWindow,
                description: `Workflows ${sourceWorkflow.name} and ${targetWorkflow.name} execute within ${timeWindow} minutes of each other`,
              },
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * 计算时间窗口
   * @param sourceExecData 源工作流执行数据
   * @param targetExecData 目标工作流执行数据
   * @returns 时间窗口（分钟）
   */
  private calculateTimeWindow(sourceExecData: WorkflowExecutionData, targetExecData: WorkflowExecutionData): number {
    const timeDiff = Math.abs(sourceExecData.lastExecutionTime - targetExecData.lastExecutionTime);
    return Math.round(timeDiff / (1000 * 60)); // 转换为分钟
  }

  /**
   * 构建依赖图
   * @param nodes 工作流节点
   * @param dependencies 依赖关系
   * @returns 依赖图
   */
  private buildDependencyGraph(nodes: WorkflowNode[], dependencies: WorkflowDependency[]): DependencyGraph {
    // 计算入度和出度
    const nodeMap = new Map<string, WorkflowNode>();
    nodes.forEach(node => nodeMap.set(node.id, node));

    dependencies.forEach(dep => {
      const sourceNode = nodeMap.get(dep.sourceWorkflowId);
      const targetNode = nodeMap.get(dep.targetWorkflowId);

      if (sourceNode) {
        sourceNode.outDegree++;
      }
      if (targetNode) {
        targetNode.inDegree++;
      }
    });

    // 计算图的密度
    const totalPossibleEdges = nodes.length * (nodes.length - 1);
    const density = totalPossibleEdges > 0 ? dependencies.length / totalPossibleEdges : 0;

    // 计算最大依赖深度
    const maxDependencyDepth = this.calculateMaxDependencyDepth(nodes, dependencies);

    // 计算关键路径
    const criticalPath = this.calculateCriticalPath(nodes, dependencies);

    return {
      nodes,
      edges: dependencies,
      density,
      maxDependencyDepth,
      criticalPath,
    };
  }

  /**
   * 计算最大依赖深度
   * @param nodes 工作流节点
   * @param dependencies 依赖关系
   * @returns 最大依赖深度
   */
  private calculateMaxDependencyDepth(nodes: WorkflowNode[], dependencies: WorkflowDependency[]): number {
    // 构建依赖邻接表
    const adjacencyList = new Map<string, string[]>();
    nodes.forEach(node => adjacencyList.set(node.id, []));
    dependencies.forEach(dep => {
      adjacencyList.get(dep.sourceWorkflowId)?.push(dep.targetWorkflowId);
    });

    // 计算每个节点的深度
    const calculateDepth = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) {
        return 0; // 避免循环依赖
      }

      visited.add(nodeId);
      const neighbors = adjacencyList.get(nodeId) || [];

      if (neighbors.length === 0) {
        return 1;
      }

      const depths = neighbors.map(neighborId => calculateDepth(neighborId, new Set(visited)));
      return 1 + Math.max(...depths);
    };

    // 计算所有节点的最大深度
    const depths = nodes.map(node => calculateDepth(node.id, new Set()));
    return Math.max(...depths, 0);
  }

  /**
   * 计算关键路径
   * @param nodes 工作流节点
   * @param dependencies 依赖关系
   * @returns 关键路径节点 ID 列表
   */
  private calculateCriticalPath(nodes: WorkflowNode[], dependencies: WorkflowDependency[]): string[] {
    // 构建依赖邻接表
    const adjacencyList = new Map<string, string[]>();
    nodes.forEach(node => adjacencyList.set(node.id, []));
    dependencies.forEach(dep => {
      adjacencyList.get(dep.sourceWorkflowId)?.push(dep.targetWorkflowId);
    });

    // 计算每个节点的执行时间（作为权重）
    const executionTimeMap = new Map<string, number>();
    nodes.forEach(node => {
      executionTimeMap.set(node.id, node.averageExecutionTime);
    });

    // 计算最长路径（关键路径）
    const longestPath = (nodeId: string, visited: Set<string>): { path: string[]; length: number } => {
      if (visited.has(nodeId)) {
        return { path: [nodeId], length: executionTimeMap.get(nodeId) || 0 };
      }

      visited.add(nodeId);
      const neighbors = adjacencyList.get(nodeId) || [];

      if (neighbors.length === 0) {
        return { path: [nodeId], length: executionTimeMap.get(nodeId) || 0 };
      }

      let maxPath: string[] = [nodeId];
      let maxLength = executionTimeMap.get(nodeId) || 0;

      neighbors.forEach(neighborId => {
        const { path, length } = longestPath(neighborId, new Set(visited));
        const totalLength = (executionTimeMap.get(nodeId) || 0) + length;

        if (totalLength > maxLength) {
          maxLength = totalLength;
          maxPath = [nodeId, ...path];
        }
      });

      return { path: maxPath, length: maxLength };
    };

    // 计算所有节点的最长路径
    let criticalPath: string[] = [];
    let maxLength = 0;

    nodes.forEach(node => {
      const { path, length } = longestPath(node.id, new Set());
      if (length > maxLength) {
        maxLength = length;
        criticalPath = path;
      }
    });

    return criticalPath;
  }

  /**
   * 计算依赖统计
   * @param graph 依赖图
   * @returns 依赖统计
   */
  private calculateStatistics(graph: DependencyGraph): DependencyStatistics {
    const dependenciesByType: Record<string, number> = {};
    Object.values(DependencyTypeEnum).forEach(type => {
      dependenciesByType[type] = 0;
    });

    graph.edges.forEach(edge => {
      dependenciesByType[edge.dependencyType]++;
    });

    const dependencyStrengths = graph.edges.map(edge => edge.dependencyStrength);
    const averageDependencyStrength = dependencyStrengths.length > 0
      ? dependencyStrengths.reduce((sum, strength) => sum + strength, 0) / dependencyStrengths.length
      : 0;

    const maxDependencyStrength = dependencyStrengths.length > 0
      ? Math.max(...dependencyStrengths)
      : 0;

    // 计算依赖环数量
    const dependencyCycles = this.detectDependencyCycles(graph);

    // 计算孤立工作流数量
    const isolatedWorkflows = graph.nodes.filter(node => node.inDegree === 0 && node.outDegree === 0).length;

    return {
      totalWorkflows: graph.nodes.length,
      totalDependencies: graph.edges.length,
      dependenciesByType: dependenciesByType as Record<DependencyType, number>,
      averageDependencyStrength,
      maxDependencyStrength,
      dependencyCycles,
      isolatedWorkflows,
    };
  }

  /**
   * 检测依赖环数量
   * @param graph 依赖图
   * @returns 依赖环数量
   */
  private detectDependencyCycles(graph: DependencyGraph): number {
    // 构建依赖邻接表
    const adjacencyList = new Map<string, string[]>();
    graph.nodes.forEach(node => adjacencyList.set(node.id, []));
    graph.edges.forEach(dep => {
      adjacencyList.get(dep.sourceWorkflowId)?.push(dep.targetWorkflowId);
    });

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    let cycleCount = 0;

    const detectCycle = (nodeId: string): boolean => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const neighbors = adjacencyList.get(nodeId) || [];
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId) && detectCycle(neighborId)) {
            return true;
          } else if (recursionStack.has(neighborId)) {
            cycleCount++;
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        detectCycle(node.id);
      }
    });

    return cycleCount;
  }

  /**
   * 分析瓶颈
   * @param graph 依赖图
   * @param executionData 执行数据
   * @returns 瓶颈分析
   */
  private analyzeBottlenecks(graph: DependencyGraph, executionData: WorkflowExecutionData[]): BottleneckAnalysis {
    const bottleneckWorkflows: BottleneckWorkflow[] = [];

    // 计算每个工作流的瓶颈分数
    graph.nodes.forEach(node => {
      // 瓶颈分数 = 入度 * 0.3 + 平均执行时间 * 0.3 + 失败率 * 0.4
      const executionDataForNode = executionData.find(data => data.workflowId === node.id);
      const executionTimeScore = node.averageExecutionTime / 1000; // 转换为秒
      const failureRateScore = node.failureRate;

      const bottleneckScore = (node.inDegree * 0.3) + (executionTimeScore * 0.3) + (failureRateScore * 0.4);
      node.bottleneckScore = bottleneckScore;

      // 只考虑瓶颈分数大于阈值的工作流
      if (bottleneckScore > 0.5) {
        bottleneckWorkflows.push({
          workflowId: node.id,
          workflowName: node.name,
          bottleneckScore,
          dependentWorkflowsCount: node.inDegree,
          primaryBottleneckReason: this.getPrimaryBottleneckReason(node),
          suggestedSolution: this.getSuggestedSolution(node),
        });
      }
    });

    // 排序瓶颈工作流
    bottleneckWorkflows.sort((a, b) => b.bottleneckScore - a.bottleneckScore);

    // 分析瓶颈传播路径
    const bottleneckPropagationPaths = this.analyzeBottleneckPropagation(graph, bottleneckWorkflows);

    // 计算总体瓶颈分数
    const overallBottleneckScore = bottleneckWorkflows.length > 0
      ? bottleneckWorkflows.reduce((sum, wf) => sum + wf.bottleneckScore, 0) / bottleneckWorkflows.length
      : 0;

    return {
      bottleneckWorkflows,
      bottleneckPropagationPaths,
      overallBottleneckScore,
    };
  }

  /**
   * 获取主要瓶颈原因
   * @param node 工作流节点
   * @returns 主要瓶颈原因
   */
  private getPrimaryBottleneckReason(node: WorkflowNode): string {
    if (node.inDegree > 5) {
      return 'High dependency burden';
    } else if (node.averageExecutionTime > 10000) {
      return 'Slow execution time';
    } else if (node.failureRate > 0.3) {
      return 'High failure rate';
    } else {
      return 'Combination of factors';
    }
  }

  /**
   * 获取建议解决方案
   * @param node 工作流节点
   * @returns 建议解决方案
   */
  private getSuggestedSolution(node: WorkflowNode): string {
    if (node.inDegree > 5) {
      return 'Reduce dependency burden by splitting the workflow or optimizing dependencies';
    } else if (node.averageExecutionTime > 10000) {
      return 'Optimize workflow execution by improving node performance or adding caching';
    } else if (node.failureRate > 0.3) {
      return 'Improve error handling and add retry mechanisms';
    } else {
      return 'Review overall workflow design and optimize bottleneck factors';
    }
  }

  /**
   * 分析瓶颈传播路径
   * @param graph 依赖图
   * @param bottleneckWorkflows 瓶颈工作流
   * @returns 瓶颈传播路径
   */
  private analyzeBottleneckPropagation(graph: DependencyGraph, bottleneckWorkflows: BottleneckWorkflow[]): BottleneckPropagationPath[] {
    const paths: BottleneckPropagationPath[] = [];

    // 构建依赖邻接表
    const adjacencyList = new Map<string, string[]>();
    graph.nodes.forEach(node => adjacencyList.set(node.id, []));
    graph.edges.forEach(dep => {
      adjacencyList.get(dep.sourceWorkflowId)?.push(dep.targetWorkflowId);
    });

    // 分析每个瓶颈工作流的传播路径
    bottleneckWorkflows.forEach((bottleneckWorkflow, index) => {
      const visited = new Set<string>();
      const path: string[] = [bottleneckWorkflow.workflowId];
      const cumulativeScore = bottleneckWorkflow.bottleneckScore;

      const explorePath = (currentNodeId: string, currentPath: string[], currentScore: number) => {
        const neighbors = adjacencyList.get(currentNodeId) || [];

        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            const neighborNode = graph.nodes.find(node => node.id === neighborId);
            if (neighborNode) {
              const newPath = [...currentPath, neighborId];
              const newScore = currentScore + neighborNode.bottleneckScore;

              paths.push({
                pathId: `path_${index}_${paths.length}`,
                nodes: newPath,
                pathLength: newPath.length,
                cumulativeBottleneckScore: newScore,
                impactRange: newPath.length,
              });

              explorePath(neighborId, newPath, newScore);
            }
          }
        }
      };

      explorePath(bottleneckWorkflow.workflowId, path, cumulativeScore);
    });

    // 排序路径
    paths.sort((a, b) => b.cumulativeBottleneckScore - a.cumulativeBottleneckScore);

    // 只返回前5条路径
    return paths.slice(0, 5);
  }

  /**
   * 生成优化建议
   * @param graph 依赖图
   * @param bottleneckAnalysis 瓶颈分析
   * @returns 优化建议
   */
  private generateSuggestions(graph: DependencyGraph, bottleneckAnalysis: BottleneckAnalysis): DependencySuggestion[] {
    const suggestions: DependencySuggestion[] = [];

    // 生成减少依赖的建议
    if (graph.density > 0.5) {
      suggestions.push({
        id: `suggestion_${Date.now()}_1`,
        type: 'reduce_dependency',
        description: 'Reduce overall dependency density',
        potentialPerformanceGain: 25,
        implementationComplexity: 'medium',
        affectedWorkflows: graph.nodes.map(node => node.id),
        details: `The dependency graph has a high density of ${graph.density.toFixed(2)}. Consider splitting large workflows and reducing unnecessary dependencies.`,
      });
    }

    // 生成移除依赖环的建议
    if (bottleneckAnalysis.overallBottleneckScore > 1) {
      suggestions.push({
        id: `suggestion_${Date.now()}_2`,
        type: 'remove_cycle',
        description: 'Remove dependency cycles',
        potentialPerformanceGain: 20,
        implementationComplexity: 'high',
        affectedWorkflows: graph.nodes.map(node => node.id),
        details: 'Dependency cycles can cause performance issues and unpredictable behavior. Review the dependency graph and remove cycles by refactoring workflows.',
      });
    }

    // 生成优化执行的建议
    bottleneckAnalysis.bottleneckWorkflows.slice(0, 3).forEach((bottleneckWorkflow, index) => {
      suggestions.push({
        id: `suggestion_${Date.now()}_${3 + index}`,
        type: 'optimize_execution',
        description: `Optimize bottleneck workflow: ${bottleneckWorkflow.workflowName}`,
        potentialPerformanceGain: Math.round(30 - index * 5),
        implementationComplexity: bottleneckWorkflow.bottleneckScore > 2 ? 'high' : 'medium',
        affectedWorkflows: [bottleneckWorkflow.workflowId],
        details: `Workflow ${bottleneckWorkflow.workflowName} is a bottleneck with a score of ${bottleneckWorkflow.bottleneckScore.toFixed(2)}. ${bottleneckWorkflow.suggestedSolution}`,
      });
    });

    // 生成资源共享的建议
    const resourceDependencies = graph.edges.filter(edge => edge.dependencyType === DependencyTypeEnum.RESOURCE);
    if (resourceDependencies.length > 3) {
      suggestions.push({
        id: `suggestion_${Date.now()}_${6}`,
        type: 'resource_sharing',
        description: 'Optimize resource sharing',
        potentialPerformanceGain: 15,
        implementationComplexity: 'low',
        affectedWorkflows: Array.from(new Set(resourceDependencies.flatMap(dep => [dep.sourceWorkflowId, dep.targetWorkflowId]))),
        details: 'Multiple workflows are sharing resources. Consider optimizing resource usage by implementing caching, batching, or resource pooling.',
      });
    }

    // 排序建议
    suggestions.sort((a, b) => b.potentialPerformanceGain - a.potentialPerformanceGain);

    return suggestions;
  }

  /**
   * 生成可视化
   * @param graph 依赖图
   * @param bottleneckAnalysis 瓶颈分析
   */
  private async generateVisualization(graph: DependencyGraph, bottleneckAnalysis: BottleneckAnalysis): Promise<void> {
    await this.dependencyVisualizer.generate(graph, bottleneckAnalysis, this.config.visualizationOutputPath);
  }

  /**
   * 导出依赖分析结果
   * @param result 依赖分析结果
   * @param format 导出格式
   * @returns 导出结果
   */
  exportResult(result: DependencyAnalysisResult, format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    } else {
      // 生成 CSV 格式
      let csv = 'Type,Source Workflow,Target Workflow,Dependency Type,Strength,Details\n';
      result.graph.edges.forEach(edge => {
        csv += `Dependency,${edge.sourceWorkflowName},${edge.targetWorkflowName},${edge.dependencyType},${edge.dependencyStrength},${edge.details.description || ''}\n`;
      });
      return csv;
    }
  }
}

/**
 * 创建依赖分析器实例的工厂函数
 * @param config 依赖分析配置
 * @returns 依赖分析器实例
 */
export function createDependencyAnalyzer(config?: Partial<DependencyAnalyzerConfig>): DependencyAnalyzer {
  return new DependencyAnalyzer(config);
}
