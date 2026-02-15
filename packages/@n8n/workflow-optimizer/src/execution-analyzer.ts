import type { IRun, ITaskData } from 'n8n-workflow';
import { ExecutionAnalysisResult, WorkflowMetrics, NodeExecutionMetrics } from './types';

export class ExecutionAnalyzer {
  /**
   * Analyze a single execution run
   */
  analyzeRun(run: IRun): ExecutionAnalysisResult {
    const metrics = this.calculateMetrics(run);

    return {
      runId: run.id || 'unknown',
      workflowId: run.workflowId || 'unknown',
      workflowName: run.workflowName || 'Unnamed Workflow',
      metrics,
      executionTime: metrics.totalExecutionTime,
      success: !run.data?.resultData?.error,
      error: run.data?.resultData?.error?.message,
      nodeExecutionData: this.extractNodeExecutionData(run),
      generatedAt: new Date()
    };
  }

  /**
   * Calculate metrics from execution run
   */
  private calculateMetrics(run: IRun): WorkflowMetrics {
    const nodeExecutions = new Map<string, NodeExecutionMetrics>();
    let totalExecutionTime = 0;
    let longestRunningNode = '';
    let maxExecutionTime = 0;
    let nodeCount = 0;

    // Extract node execution data
    const runData = run.data?.resultData?.runData || {};
    nodeCount = Object.keys(runData).length;

    Object.entries(runData).forEach(([nodeName, executions]) => {
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
          outputDataSize += this.calculateDataSize(execution.data.main);
        }
      });

      const averageExecutionTime = executionCount > 0 ? executionTime / executionCount : 0;

      const metrics: NodeExecutionMetrics = {
        nodeName,
        nodeType: 'unknown', // Need to get from workflow definition
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

    const averageNodeExecutionTime = nodeCount > 0 ? totalExecutionTime / nodeCount : 0;

    return {
      totalExecutionTime,
      nodeExecutions,
      connectionCount: 0, // Need to get from workflow definition
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
   * Compare multiple executions
   */
  compareExecutions(runs: IRun[]): any {
    if (runs.length < 2) {
      throw new Error('Need at least 2 runs to compare');
    }

    const analyses = runs.map(run => this.analyzeRun(run));
    const baseline = analyses[0];
    const comparisons = analyses.slice(1).map((analysis, index) => {
      return {
        runId: analysis.runId,
        comparison: this.compareWithBaseline(analysis, baseline)
      };
    });

    return {
      baselineRunId: baseline.runId,
      comparisons,
      overallTrend: this.calculateOverallTrend(analyses)
    };
  }

  /**
   * Compare an analysis with a baseline
   */
  private compareWithBaseline(analysis: ExecutionAnalysisResult, baseline: ExecutionAnalysisResult): any {
    const executionTimeChange = ((analysis.executionTime - baseline.executionTime) / baseline.executionTime) * 100;
    const nodeCountChange = analysis.metrics.nodeCount - baseline.metrics.nodeCount;

    const nodeComparisons = new Map<string, any>();

    // Compare node executions
    baseline.metrics.nodeExecutions.forEach((baselineMetrics, nodeName) => {
      const currentMetrics = analysis.metrics.nodeExecutions.get(nodeName);
      if (currentMetrics) {
        nodeComparisons.set(nodeName, {
          executionTimeChange: ((currentMetrics.executionTime - baselineMetrics.executionTime) / baselineMetrics.executionTime) * 100,
          errorCountChange: currentMetrics.errorCount - baselineMetrics.errorCount,
          executionCountChange: currentMetrics.executionCount - baselineMetrics.executionCount
        });
      }
    });

    // Add new nodes
    analysis.metrics.nodeExecutions.forEach((currentMetrics, nodeName) => {
      if (!baseline.metrics.nodeExecutions.has(nodeName)) {
        nodeComparisons.set(nodeName, {
          executionTimeChange: 100,
          errorCountChange: currentMetrics.errorCount,
          executionCountChange: currentMetrics.executionCount,
          isNew: true
        });
      }
    });

    return {
      executionTimeChange,
      nodeCountChange,
      successRateChange: this.calculateSuccessRateChange(analysis, baseline),
      nodeComparisons
    };
  }

  /**
   * Calculate success rate change
   */
  private calculateSuccessRateChange(analysis: ExecutionAnalysisResult, baseline: ExecutionAnalysisResult): number {
    const currentSuccess = analysis.success ? 1 : 0;
    const baselineSuccess = baseline.success ? 1 : 0;
    return (currentSuccess - baselineSuccess) * 100;
  }

  /**
   * Calculate overall trend from multiple analyses
   */
  private calculateOverallTrend(analyses: ExecutionAnalysisResult[]): any {
    const executionTimes = analyses.map(a => a.executionTime);
    const successRates = analyses.map(a => a.success ? 1 : 0);

    return {
      averageExecutionTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      medianExecutionTime: this.calculateMedian(executionTimes),
      executionTimeTrend: this.calculateTrend(executionTimes),
      averageSuccessRate: (successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length) * 100,
      successRateTrend: this.calculateTrend(successRates)
    };
  }

  /**
   * Calculate median value
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
   * Detect anomalies in execution
   */
  detectAnomalies(analysis: ExecutionAnalysisResult, historicalAnalyses: ExecutionAnalysisResult[]): any[] {
    const anomalies: any[] = [];

    if (historicalAnalyses.length < 3) {
      return anomalies;
    }

    // Calculate historical averages
    const historicalExecutionTimes = historicalAnalyses.map(a => a.executionTime);
    const avgExecutionTime = historicalExecutionTimes.reduce((sum, time) => sum + time, 0) / historicalExecutionTimes.length;
    const stdDevExecutionTime = this.calculateStandardDeviation(historicalExecutionTimes, avgExecutionTime);

    // Check for execution time anomalies
    if (Math.abs(analysis.executionTime - avgExecutionTime) > 2 * stdDevExecutionTime) {
      anomalies.push({
        type: 'executionTime',
        message: `Execution time (${analysis.executionTime}ms) is significantly different from average (${avgExecutionTime.toFixed(2)}ms)`,
        severity: Math.abs(analysis.executionTime - avgExecutionTime) > 3 * stdDevExecutionTime ? 'high' : 'medium',
        value: analysis.executionTime,
        average: avgExecutionTime,
        deviation: ((analysis.executionTime - avgExecutionTime) / avgExecutionTime) * 100
      });
    }

    // Check for error rate anomalies
    const historicalErrorRates = historicalAnalyses.map(a => a.error ? 1 : 0);
    const avgErrorRate = historicalErrorRates.reduce((sum, rate) => sum + rate, 0) / historicalErrorRates.length;

    const currentErrorRate = analysis.error ? 1 : 0;
    if (currentErrorRate > avgErrorRate + 0.5) {
      anomalies.push({
        type: 'errorRate',
        message: 'Error rate is significantly higher than historical average',
        severity: 'high',
        value: currentErrorRate,
        average: avgErrorRate
      });
    }

    // Check for node execution anomalies
    anomalies.push(...this.detectNodeAnomalies(analysis, historicalAnalyses));

    return anomalies;
  }

  /**
   * Detect anomalies in node executions
   */
  private detectNodeAnomalies(analysis: ExecutionAnalysisResult, historicalAnalyses: ExecutionAnalysisResult[]): any[] {
    const anomalies: any[] = [];

    // For each node in current analysis
    analysis.metrics.nodeExecutions.forEach((currentMetrics, nodeName) => {
      // Collect historical metrics for this node
      const historicalMetrics = historicalAnalyses
        .map(a => a.metrics.nodeExecutions.get(nodeName))
        .filter((m): m is NodeExecutionMetrics => m !== undefined);

      if (historicalMetrics.length >= 3) {
        // Calculate historical averages
        const avgExecutionTime = historicalMetrics.reduce((sum, m) => sum + m.executionTime, 0) / historicalMetrics.length;
        const stdDevExecutionTime = this.calculateStandardDeviation(
          historicalMetrics.map(m => m.executionTime),
          avgExecutionTime
        );

        // Check for execution time anomalies
        if (Math.abs(currentMetrics.executionTime - avgExecutionTime) > 2 * stdDevExecutionTime) {
          anomalies.push({
            type: 'nodeExecutionTime',
            message: `Node "${nodeName}" execution time (${currentMetrics.executionTime}ms) is significantly different from average (${avgExecutionTime.toFixed(2)}ms)`,
            severity: Math.abs(currentMetrics.executionTime - avgExecutionTime) > 3 * stdDevExecutionTime ? 'high' : 'medium',
            nodeName,
            value: currentMetrics.executionTime,
            average: avgExecutionTime,
            deviation: ((currentMetrics.executionTime - avgExecutionTime) / avgExecutionTime) * 100
          });
        }

        // Check for error rate anomalies
        const avgErrorRate = historicalMetrics.reduce((sum, m) => sum + m.errorCount, 0) / historicalMetrics.length;
        if (currentMetrics.errorCount > avgErrorRate + 2) {
          anomalies.push({
            type: 'nodeErrorRate',
            message: `Node "${nodeName}" error count (${currentMetrics.errorCount}) is significantly higher than average (${avgErrorRate.toFixed(2)})`,
            severity: 'high',
            nodeName,
            value: currentMetrics.errorCount,
            average: avgErrorRate
          });
        }
      }
    });

    return anomalies;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, squared) => sum + squared, 0) / values.length;
    return Math.sqrt(variance);
  }
}
