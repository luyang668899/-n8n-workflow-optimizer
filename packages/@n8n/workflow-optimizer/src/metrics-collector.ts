import type { Workflow, IRun } from 'n8n-workflow';
import { ExecutionAnalyzer } from './execution-analyzer';
import { WorkflowGraphBuilder } from './workflow-graph';

export class MetricsCollector {
  private executionAnalyzer: ExecutionAnalyzer;
  private graphBuilder: WorkflowGraphBuilder;

  constructor() {
    this.executionAnalyzer = new ExecutionAnalyzer();
    this.graphBuilder = new WorkflowGraphBuilder();
  }

  /**
   * Collect metrics from workflow
   */
  async collectMetrics(workflow: Workflow, runs: IRun[]): Promise<any> {
    const metrics = {
      workflow: this.collectWorkflowMetrics(workflow),
      executions: await this.collectExecutionMetrics(runs),
      structure: this.collectStructureMetrics(workflow),
      performance: this.collectPerformanceMetrics(runs)
    };

    return metrics;
  }

  /**
   * Collect workflow-level metrics
   */
  private collectWorkflowMetrics(workflow: Workflow): any {
    const nodeCount = Object.keys(workflow.nodes).length;
    const enabledNodeCount = Object.values(workflow.nodes).filter(node => !node.disabled).length;
    const disabledNodeCount = nodeCount - enabledNodeCount;

    let connectionCount = 0;
    Object.values(workflow.connectionsBySourceNode).forEach(sourceConnections => {
      Object.values(sourceConnections).forEach(typeConnections => {
        Object.values(typeConnections).forEach(indexConnections => {
          connectionCount += indexConnections.length;
        });
      });
    });

    return {
      id: workflow.id,
      name: workflow.name,
      nodeCount,
      enabledNodeCount,
      disabledNodeCount,
      connectionCount,
      hasDescription: !!workflow.description,
      isActive: workflow.active
    };
  }

  /**
   * Collect execution metrics
   */
  private async collectExecutionMetrics(runs: IRun[]): Promise<any> {
    if (runs.length === 0) {
      return {
        runCount: 0,
        successRate: 0,
        averageExecutionTime: 0,
        totalExecutions: 0
      };
    }

    const analyses = runs.map(run => this.executionAnalyzer.analyzeRun(run));
    const successCount = analyses.filter(a => a.success).length;
    const totalExecutionTime = analyses.reduce((sum, a) => sum + a.executionTime, 0);

    return {
      runCount: runs.length,
      successRate: (successCount / runs.length) * 100,
      averageExecutionTime: totalExecutionTime / runs.length,
      totalExecutions: runs.length,
      lastExecution: runs[runs.length - 1].startedAt,
      errorCount: analyses.filter(a => a.error).length
    };
  }

  /**
   * Collect structure metrics
   */
  private collectStructureMetrics(workflow: Workflow): any {
    const graph = this.graphBuilder.build(workflow);
    const cycles = this.graphBuilder.detectCycles(graph);
    const parallelizationOpportunities = this.graphBuilder.findParallelizationOpportunities(graph);

    // Calculate workflow depth
    let maxDepth = 0;
    graph.nodes.forEach(node => {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
      }
    });

    return {
      depth: maxDepth,
      entryPoints: graph.entryNodes.length,
      exitPoints: graph.exitNodes.length,
      criticalPathLength: graph.criticalPath.length,
      hasCycles: cycles.length > 0,
      cycleCount: cycles.length,
      parallelizationOpportunities: parallelizationOpportunities.length,
      averageBranchingFactor: this.calculateAverageBranchingFactor(graph)
    };
  }

  /**
   * Collect performance metrics
   */
  private collectPerformanceMetrics(runs: IRun[]): any {
    if (runs.length === 0) {
      return {
        averageExecutionTime: 0,
        medianExecutionTime: 0,
        executionTimeTrend: 'stable',
        errorRateTrend: 'stable'
      };
    }

    const analyses = runs.map(run => this.executionAnalyzer.analyzeRun(run));
    const executionTimes = analyses.map(a => a.executionTime);
    const errorRates = analyses.map(a => a.error ? 1 : 0);

    // Calculate median execution time
    const sortedExecutionTimes = [...executionTimes].sort((a, b) => a - b);
    const medianExecutionTime = sortedExecutionTimes.length % 2 !== 0
      ? sortedExecutionTimes[Math.floor(sortedExecutionTimes.length / 2)]
      : (sortedExecutionTimes[sortedExecutionTimes.length / 2 - 1] + sortedExecutionTimes[sortedExecutionTimes.length / 2]) / 2;

    // Calculate trends
    const executionTimeTrend = this.calculateTrend(executionTimes);
    const errorRateTrend = this.calculateTrend(errorRates);

    return {
      averageExecutionTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      medianExecutionTime,
      executionTimeTrend,
      errorRateTrend,
      fastestExecution: Math.min(...executionTimes),
      slowestExecution: Math.max(...executionTimes),
      executionTimeVariance: this.calculateVariance(executionTimes)
    };
  }

  /**
   * Calculate average branching factor
   */
  private calculateAverageBranchingFactor(graph: any): number {
    let totalBranches = 0;
    let nodeCount = 0;

    graph.nodes.forEach((node: any) => {
      totalBranches += node.children.length;
      nodeCount++;
    });

    return nodeCount > 0 ? totalBranches / nodeCount : 0;
  }

  /**
   * Calculate trend from values
   */
  private calculateTrend(values: number[]): 'improving' | 'worsening' | 'stable' {
    if (values.length < 2) return 'stable';

    const changes = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(values[i] - values[i - 1]);
    }

    const averageChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const threshold = 0.05 * Math.abs(values[0]);

    if (averageChange < -threshold) return 'improving';
    if (averageChange > threshold) return 'worsening';
    return 'stable';
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    return squaredDifferences.reduce((sum, squared) => sum + squared, 0) / values.length;
  }

  /**
   * Collect node-specific metrics
   */
  collectNodeMetrics(workflow: Workflow, runs: IRun[]): Map<string, any> {
    const nodeMetrics = new Map<string, any>();

    // Collect basic node info
    Object.values(workflow.nodes).forEach(node => {
      nodeMetrics.set(node.name, {
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion,
        isDisabled: node.disabled,
        hasParameters: Object.keys(node.parameters || {}).length > 0,
        position: node.position
      });
    });

    // Enhance with execution data if available
    if (runs.length > 0) {
      const lastRun = runs[runs.length - 1];
      const runData = lastRun.data?.resultData?.runData || {};

      Object.entries(runData).forEach(([nodeName, executions]) => {
        const currentMetrics = nodeMetrics.get(nodeName) || {};
        const executionTimes = executions.map((e: any) => e.executionTime || 0);
        const errorCount = executions.filter((e: any) => e.error).length;

        nodeMetrics.set(nodeName, {
          ...currentMetrics,
          executionCount: executions.length,
          errorCount,
          successCount: executions.length - errorCount,
          averageExecutionTime: executionTimes.reduce((sum: number, time: number) => sum + time, 0) / executionTimes.length,
          totalExecutionTime: executionTimes.reduce((sum: number, time: number) => sum + time, 0)
        });
      });
    }

    return nodeMetrics;
  }

  /**
   * Generate metrics report
   */
  async generateReport(workflow: Workflow, runs: IRun[]): Promise<any> {
    const metrics = await this.collectMetrics(workflow, runs);
    const nodeMetrics = this.collectNodeMetrics(workflow, runs);

    return {
      generatedAt: new Date(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      summary: {
        nodeCount: metrics.workflow.nodeCount,
        connectionCount: metrics.workflow.connectionCount,
        runCount: metrics.executions.runCount,
        successRate: metrics.executions.successRate,
        averageExecutionTime: metrics.executions.averageExecutionTime,
        isActive: metrics.workflow.isActive
      },
      detailedMetrics: metrics,
      nodeMetrics: Object.fromEntries(nodeMetrics),
      recommendations: this.generateRecommendations(metrics)
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(metrics: any): any[] {
    const recommendations = [];

    // Workflow size recommendation
    if (metrics.workflow.nodeCount > 50) {
      recommendations.push({
        type: 'workflowSize',
        message: 'Consider splitting this large workflow into smaller, more manageable workflows',
        severity: metrics.workflow.nodeCount > 100 ? 'high' : 'medium',
        metrics: {
          nodeCount: metrics.workflow.nodeCount
        }
      });
    }

    // Execution time recommendation
    if (metrics.executions.averageExecutionTime > 60000) { // 1 minute
      recommendations.push({
        type: 'executionTime',
        message: 'Workflow execution time is high. Consider optimizing bottlenecks.',
        severity: metrics.executions.averageExecutionTime > 300000 ? 'high' : 'medium',
        metrics: {
          averageExecutionTime: metrics.executions.averageExecutionTime
        }
      });
    }

    // Success rate recommendation
    if (metrics.executions.successRate < 90) {
      recommendations.push({
        type: 'successRate',
        message: 'Success rate is low. Investigate and fix frequent errors.',
        severity: metrics.executions.successRate < 50 ? 'high' : 'medium',
        metrics: {
          successRate: metrics.executions.successRate,
          errorCount: metrics.executions.errorCount
        }
      });
    }

    // Structure recommendations
    if (metrics.structure.hasCycles) {
      recommendations.push({
        type: 'cycles',
        message: 'Workflow contains cycles which may cause infinite loops.',
        severity: 'high',
        metrics: {
          cycleCount: metrics.structure.cycleCount
        }
      });
    }

    // Parallelization opportunities
    if (metrics.structure.parallelizationOpportunities > 0) {
      recommendations.push({
        type: 'parallelization',
        message: `There are ${metrics.structure.parallelizationOpportunities} opportunities for parallel execution.`,
        severity: 'low',
        metrics: {
          parallelizationOpportunities: metrics.structure.parallelizationOpportunities
        }
      });
    }

    return recommendations;
  }
}
