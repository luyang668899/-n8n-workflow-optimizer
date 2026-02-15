import type { Workflow, IRun, ITaskData } from 'n8n-workflow';
import { WorkflowMetrics, NodeExecutionMetrics, ExecutionAnalysisResult, Bottleneck } from './types';
import { BottleneckDetector } from './bottleneck-detector';
import { WorkflowGraphBuilder } from './workflow-graph';

export class WorkflowAnalyzer {
  private bottleneckDetector: BottleneckDetector;
  private graphBuilder: WorkflowGraphBuilder;

  constructor() {
    this.bottleneckDetector = new BottleneckDetector();
    this.graphBuilder = new WorkflowGraphBuilder();
  }

  /**
   * Analyze workflow execution data
   */
  async analyzeExecution(run: IRun, workflow: Workflow): Promise<ExecutionAnalysisResult> {
    const metrics = this.calculateMetrics(run, workflow);
    const bottlenecks = this.bottleneckDetector.detect(metrics);

    // Update bottlenecks in metrics
    metrics.bottlenecks = bottlenecks;

    return {
      runId: run.id || 'unknown',
      workflowId: workflow.id,
      workflowName: workflow.name || 'Unnamed Workflow',
      metrics,
      executionTime: metrics.totalExecutionTime,
      success: !run.data?.resultData?.error,
      error: run.data?.resultData?.error?.message,
      nodeExecutionData: this.extractNodeExecutionData(run),
      generatedAt: new Date()
    };
  }

  /**
   * Calculate workflow metrics from execution data
   */
  private calculateMetrics(run: IRun, workflow: Workflow): WorkflowMetrics {
    const nodeExecutions = new Map<string, NodeExecutionMetrics>();
    let totalExecutionTime = 0;
    let longestRunningNode = '';
    let maxExecutionTime = 0;

    // Extract node execution data
    const runData = run.data?.resultData?.runData || {};

    Object.entries(runData).forEach(([nodeName, executions]) => {
      const node = workflow.getNode(nodeName);
      if (!node) return;

      let executionTime = 0;
      let executionCount = 0;
      let errorCount = 0;
      let successCount = 0;
      let inputDataSize = 0;
      let outputDataSize = 0;

      executions.forEach((execution: ITaskData) => {
        const execTime = execution.executionTime || 0;
        executionTime += execTime;
        executionCount++;

        if (execution.error) {
          errorCount++;
        } else {
          successCount++;
        }

        // Calculate data sizes
        if (execution.data?.main) {
          inputDataSize += this.calculateDataSize(execution.data.main);
        }

        if (execution.data?.main) {
          outputDataSize += this.calculateDataSize(execution.data.main);
        }
      });

      const averageExecutionTime = executionCount > 0 ? executionTime / executionCount : 0;

      const metrics: NodeExecutionMetrics = {
        nodeName,
        nodeType: node.type,
        executionTime,
        executionCount,
        errorCount,
        successCount,
        averageExecutionTime,
        inputDataSize,
        outputDataSize,
        isBottleneck: false
      };

      nodeExecutions.set(nodeName, metrics);
      totalExecutionTime += executionTime;

      if (executionTime > maxExecutionTime) {
        maxExecutionTime = executionTime;
        longestRunningNode = nodeName;
      }
    });

    const nodeCount = workflow.nodes ? Object.keys(workflow.nodes).length : 0;
    const connectionCount = this.calculateConnectionCount(workflow);
    const averageNodeExecutionTime = nodeCount > 0 ? totalExecutionTime / nodeCount : 0;

    return {
      totalExecutionTime,
      nodeExecutions,
      connectionCount,
      nodeCount,
      averageNodeExecutionTime,
      longestRunningNode,
      bottlenecks: []
    };
  }

  /**
   * Extract node execution data
   */
  private extractNodeExecutionData(run: IRun): Map<string, ITaskData[]> {
    const nodeExecutionData = new Map<string, ITaskData[]>();
    const runData = run.data?.resultData?.runData || {};

    Object.entries(runData).forEach(([nodeName, executions]) => {
      nodeExecutionData.set(nodeName, executions as ITaskData[]);
    });

    return nodeExecutionData;
  }

  /**
   * Calculate connection count
   */
  private calculateConnectionCount(workflow: Workflow): number {
    let count = 0;
    const connections = workflow.connectionsBySourceNode;

    Object.values(connections).forEach(sourceConnections => {
      Object.values(sourceConnections).forEach(typeConnections => {
        Object.values(typeConnections).forEach(indexConnections => {
          count += indexConnections.length;
        });
      });
    });

    return count;
  }

  /**
   * Calculate data size
   */
  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * Analyze workflow structure
   */
  analyzeStructure(workflow: Workflow): any {
    const graph = this.graphBuilder.build(workflow);

    return {
      graph,
      nodeCount: graph.nodes.size,
      connectionCount: this.calculateConnectionCount(workflow),
      depth: this.calculateWorkflowDepth(graph),
      criticalPath: graph.criticalPath,
      entryPoints: graph.entryNodes,
      exitPoints: graph.exitNodes
    };
  }

  /**
   * Calculate workflow depth
   */
  private calculateWorkflowDepth(graph: any): number {
    let maxDepth = 0;
    graph.nodes.forEach((node: any) => {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
      }
    });
    return maxDepth;
  }
}
