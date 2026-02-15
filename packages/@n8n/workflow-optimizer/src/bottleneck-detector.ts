import { WorkflowMetrics, NodeExecutionMetrics, Bottleneck, OptimizationSuggestion, OptimizationType } from './types';

export class BottleneckDetector {
  /**
   * Detect bottlenecks in workflow execution
   */
  detect(metrics: WorkflowMetrics): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const averageExecutionTime = metrics.averageNodeExecutionTime;

    metrics.nodeExecutions.forEach((nodeMetrics, nodeName) => {
      const bottleneck = this.analyzeNode(nodeMetrics, averageExecutionTime, metrics);
      if (bottleneck) {
        bottlenecks.push(bottleneck);
      }
    });

    // Sort bottlenecks by severity
    return bottlenecks.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Analyze a single node for bottlenecks
   */
  private analyzeNode(
    nodeMetrics: NodeExecutionMetrics,
    averageExecutionTime: number,
    metrics: WorkflowMetrics
  ): Bottleneck | null {
    const bottlenecks: Bottleneck[] = [];

    // Check execution time
    if (nodeMetrics.executionTime > averageExecutionTime * 2) {
      const severity = this.calculateSeverity(nodeMetrics.executionTime, averageExecutionTime);
      const suggestions = this.generateSuggestions(nodeMetrics, severity);

      return {
        nodeName: nodeMetrics.nodeName,
        nodeType: nodeMetrics.nodeType,
        severity,
        reason: `Execution time (${nodeMetrics.executionTime}ms) is significantly higher than average (${averageExecutionTime}ms)`,
        executionTime: nodeMetrics.executionTime,
        averageTime: averageExecutionTime,
        suggestions
      };
    }

    // Check error rate
    if (nodeMetrics.errorCount > 0) {
      const errorRate = nodeMetrics.errorCount / nodeMetrics.executionCount;
      if (errorRate > 0.1) {
        const severity = errorRate > 0.5 ? 'high' : 'medium';
        const suggestions = this.generateErrorHandlingSuggestions(nodeMetrics);

        return {
          nodeName: nodeMetrics.nodeName,
          nodeType: nodeMetrics.nodeType,
          severity,
          reason: `High error rate (${(errorRate * 100).toFixed(1)}%)`,
          executionTime: nodeMetrics.executionTime,
          averageTime: averageExecutionTime,
          suggestions
        };
      }
    }

    // Check data size
    if (nodeMetrics.inputDataSize > 1024 * 1024) { // 1MB
      const severity = nodeMetrics.inputDataSize > 10 * 1024 * 1024 ? 'high' : 'medium';
      const suggestions = this.generateDataSizeSuggestions(nodeMetrics);

      return {
        nodeName: nodeMetrics.nodeName,
        nodeType: nodeMetrics.nodeType,
        severity,
        reason: `Large input data size (${(nodeMetrics.inputDataSize / (1024 * 1024)).toFixed(2)}MB)`,
        executionTime: nodeMetrics.executionTime,
        averageTime: averageExecutionTime,
        suggestions
      };
    }

    return null;
  }

  /**
   * Calculate bottleneck severity
   */
  private calculateSeverity(executionTime: number, averageTime: number): 'low' | 'medium' | 'high' {
    const ratio = executionTime / averageTime;

    if (ratio > 5) {
      return 'high';
    } else if (ratio > 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Generate optimization suggestions for bottleneck
   */
  private generateSuggestions(
    nodeMetrics: NodeExecutionMetrics,
    severity: 'low' | 'medium' | 'high'
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Parallel execution suggestion
    if (this.canBeParallelized(nodeMetrics)) {
      suggestions.push({
        id: `parallel-${nodeMetrics.nodeName}`,
        type: OptimizationType.PARALLEL_EXECUTION,
        description: 'Execute this node in parallel if possible',
        severity,
        estimatedImprovement: severity === 'high' ? 60 : severity === 'medium' ? 40 : 20,
        implementationEffort: 'medium',
        appliesTo: [nodeMetrics.nodeName],
        details: {
          nodeName: nodeMetrics.nodeName,
          currentExecutionTime: nodeMetrics.executionTime
        }
      });
    }

    // Caching suggestion
    if (this.canBeCached(nodeMetrics)) {
      suggestions.push({
        id: `cache-${nodeMetrics.nodeName}`,
        type: OptimizationType.CACHING,
        description: 'Implement caching for this node',
        severity,
        estimatedImprovement: severity === 'high' ? 80 : severity === 'medium' ? 60 : 40,
        implementationEffort: 'low',
        appliesTo: [nodeMetrics.nodeName],
        details: {
          nodeName: nodeMetrics.nodeName,
          executionCount: nodeMetrics.executionCount
        }
      });
    }

    // Batch processing suggestion
    if (this.canUseBatchProcessing(nodeMetrics)) {
      suggestions.push({
        id: `batch-${nodeMetrics.nodeName}`,
        type: OptimizationType.BATCH_PROCESSING,
        description: 'Use batch processing for this node',
        severity,
        estimatedImprovement: severity === 'high' ? 50 : severity === 'medium' ? 30 : 15,
        implementationEffort: 'medium',
        appliesTo: [nodeMetrics.nodeName],
        details: {
          nodeName: nodeMetrics.nodeName,
          executionCount: nodeMetrics.executionCount
        }
      });
    }

    return suggestions;
  }

  /**
   * Generate error handling suggestions
   */
  private generateErrorHandlingSuggestions(
    nodeMetrics: NodeExecutionMetrics
  ): OptimizationSuggestion[] {
    return [
      {
        id: `error-handling-${nodeMetrics.nodeName}`,
        type: OptimizationType.ERROR_HANDLING,
        description: 'Improve error handling for this node',
        severity: 'medium',
        estimatedImprovement: 30,
        implementationEffort: 'low',
        appliesTo: [nodeMetrics.nodeName],
        details: {
          nodeName: nodeMetrics.nodeName,
          errorCount: nodeMetrics.errorCount,
          executionCount: nodeMetrics.executionCount
        }
      }
    ];
  }

  /**
   * Generate data size optimization suggestions
   */
  private generateDataSizeSuggestions(
    nodeMetrics: NodeExecutionMetrics
  ): OptimizationSuggestion[] {
    return [
      {
        id: `data-size-${nodeMetrics.nodeName}`,
        type: OptimizationType.CONNECTION_OPTIMIZATION,
        description: 'Optimize data transfer for this node',
        severity: 'medium',
        estimatedImprovement: 40,
        implementationEffort: 'medium',
        appliesTo: [nodeMetrics.nodeName],
        details: {
          nodeName: nodeMetrics.nodeName,
          inputDataSize: nodeMetrics.inputDataSize,
          outputDataSize: nodeMetrics.outputDataSize
        }
      }
    ];
  }

  /**
   * Check if node can be parallelized
   */
  private canBeParallelized(nodeMetrics: NodeExecutionMetrics): boolean {
    // Check if node type is suitable for parallel execution
    const parallelizableTypes = [
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.function',
      'n8n-nodes-base.code',
      'n8n-nodes-base.splitInBatches',
      'n8n-nodes-base.aggregate'
    ];

    return parallelizableTypes.includes(nodeMetrics.nodeType) ||
           nodeMetrics.executionCount > 1;
  }

  /**
   * Check if node can be cached
   */
  private canBeCached(nodeMetrics: NodeExecutionMetrics): boolean {
    // Check if node type is suitable for caching
    const cacheableTypes = [
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.function',
      'n8n-nodes-base.code',
      'n8n-nodes-base.googleSheets',
      'n8n-nodes-base.mysql',
      'n8n-nodes-base.postgres'
    ];

    return cacheableTypes.includes(nodeMetrics.nodeType) ||
           nodeMetrics.executionCount > 3;
  }

  /**
   * Check if node can use batch processing
   */
  private canUseBatchProcessing(nodeMetrics: NodeExecutionMetrics): boolean {
    // Check if node type is suitable for batch processing
    const batchableTypes = [
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.googleSheets',
      'n8n-nodes-base.mysql',
      'n8n-nodes-base.postgres',
      'n8n-nodes-base.mongodb',
      'n8n-nodes-base.salesforce'
    ];

    return batchableTypes.includes(nodeMetrics.nodeType) ||
           nodeMetrics.executionCount > 5;
  }
}
