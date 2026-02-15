import { OptimizationVisualizationData, VisualizationNode, VisualizationEdge, OptimizationSummary, VisualizationOptions, defaultVisualizationOptions } from './types';
import { WorkflowMetrics, Bottleneck, OptimizationSuggestion } from '../types';
import { WorkflowGraphBuilder } from '../workflow-graph';
import type { Workflow } from 'n8n-workflow';

/**
 * Generator for optimization visualization data
 */
export class VisualizationGenerator {
  private graphBuilder: WorkflowGraphBuilder;

  constructor() {
    this.graphBuilder = new WorkflowGraphBuilder();
  }

  /**
   * Generate visualization data for workflow optimization
   */
  generate(
    workflow: Workflow,
    metrics: WorkflowMetrics,
    bottlenecks: Bottleneck[],
    suggestions: OptimizationSuggestion[],
    options: Partial<VisualizationOptions> = {}
  ): OptimizationVisualizationData {
    const mergedOptions = { ...defaultVisualizationOptions, ...options };

    // Generate nodes and edges
    const { nodes, edges } = this.generateGraphData(workflow, metrics, bottlenecks, suggestions, mergedOptions);

    // Generate summary
    const summary = this.generateSummary(metrics, bottlenecks, suggestions, mergedOptions);

    return {
      metrics,
      bottlenecks,
      suggestions: suggestions.slice(0, mergedOptions.maxSuggestions),
      nodes,
      edges,
      summary
    };
  }

  /**
   * Generate graph data for visualization
   */
  private generateGraphData(
    workflow: Workflow,
    metrics: WorkflowMetrics,
    bottlenecks: Bottleneck[],
    suggestions: OptimizationSuggestion[],
    options: VisualizationOptions
  ): { nodes: VisualizationNode[]; edges: VisualizationEdge[] } {
    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];

    // Build workflow graph
    const graph = this.graphBuilder.build(workflow);

    // Create node map for quick lookup
    const nodeMap = new Map<string, any>();
    Object.values(workflow.nodes).forEach(node => {
      nodeMap.set(node.name, node);
    });

    // Create bottleneck map for quick lookup
    const bottleneckMap = new Map<string, Bottleneck>();
    bottlenecks.forEach(bottleneck => {
      bottleneckMap.set(bottleneck.nodeName, bottleneck);
    });

    // Create suggestion map for quick lookup
    const suggestionMap = new Map<string, OptimizationSuggestion[]>();
    suggestions.forEach(suggestion => {
      suggestion.appliesTo.forEach(nodeName => {
        if (!suggestionMap.has(nodeName)) {
          suggestionMap.set(nodeName, []);
        }
        suggestionMap.get(nodeName)?.push(suggestion);
      });
    });

    // Generate nodes
    metrics.nodeExecutions.forEach((nodeMetrics, nodeName) => {
      const node = nodeMap.get(nodeName);
      const bottleneck = bottleneckMap.get(nodeName);
      const nodeSuggestions = suggestionMap.get(nodeName) || [];

      const visualizationNode: VisualizationNode = {
        id: nodeName,
        name: nodeName,
        type: nodeMetrics.nodeType,
        executionTime: nodeMetrics.executionTime,
        errorCount: nodeMetrics.errorCount,
        successCount: nodeMetrics.successCount,
        isBottleneck: !!bottleneck,
        bottleneckSeverity: bottleneck?.severity,
        suggestionCount: nodeSuggestions.length,
        metadata: {
          executionCount: nodeMetrics.executionCount,
          averageExecutionTime: nodeMetrics.averageExecutionTime,
          inputDataSize: nodeMetrics.inputDataSize,
          outputDataSize: nodeMetrics.outputDataSize
        }
      };

      if (options.includeNodePositions && node && 'position' in node) {
        visualizationNode.position = node.position;
      }

      nodes.push(visualizationNode);
    });

    // Generate edges
    if (graph.edges) {
      graph.edges.forEach((edge, index) => {
        const visualizationEdge: VisualizationEdge = {
          id: `edge-${index}`,
          source: edge.source,
          target: edge.target
        };
        edges.push(visualizationEdge);
      });
    }

    return { nodes, edges };
  }

  /**
   * Generate optimization summary
   */
  private generateSummary(
    metrics: WorkflowMetrics,
    bottlenecks: Bottleneck[],
    suggestions: OptimizationSuggestion[],
    options: VisualizationOptions
  ): OptimizationSummary {
    // Calculate estimated improvement
    const estimatedImprovement = this.calculateEstimatedImprovement(suggestions);

    // Find most severe bottleneck
    const mostSevereBottleneck = this.findMostSevereBottleneck(bottlenecks);

    // Calculate bottleneck distribution
    const bottleneckDistribution = this.calculateBottleneckDistribution(bottlenecks);

    // Calculate suggestion distribution
    const suggestionDistribution = this.calculateSuggestionDistribution(suggestions);

    // Get top suggestions
    const topSuggestions = this.getTopSuggestions(suggestions, 5);

    return {
      totalExecutionTime: metrics.totalExecutionTime,
      nodeCount: metrics.nodeCount,
      bottleneckCount: bottlenecks.length,
      suggestionCount: suggestions.length,
      estimatedImprovement,
      mostSevereBottleneck,
      topSuggestions,
      bottleneckDistribution,
      suggestionDistribution
    };
  }

  /**
   * Calculate estimated improvement from suggestions
   */
  private calculateEstimatedImprovement(suggestions: OptimizationSuggestion[]): number {
    if (suggestions.length === 0) return 0;

    // Calculate average estimated improvement
    const totalImprovement = suggestions.reduce((sum, suggestion) => {
      return sum + suggestion.estimatedImprovement;
    }, 0);

    // Cap at 90% improvement
    return Math.min(90, Math.round(totalImprovement / suggestions.length));
  }

  /**
   * Find most severe bottleneck
   */
  private findMostSevereBottleneck(bottlenecks: Bottleneck[]): Bottleneck | undefined {
    if (bottlenecks.length === 0) return undefined;

    const severityOrder = { high: 3, medium: 2, low: 1 };

    return bottlenecks.reduce((mostSevere, current) => {
      if (severityOrder[current.severity] > severityOrder[mostSevere.severity]) {
        return current;
      } else if (severityOrder[current.severity] === severityOrder[mostSevere.severity]) {
        // If same severity, choose the one with longer execution time
        return current.executionTime > mostSevere.executionTime ? current : mostSevere;
      }
      return mostSevere;
    });
  }

  /**
   * Calculate bottleneck distribution by severity
   */
  private calculateBottleneckDistribution(bottlenecks: Bottleneck[]): {
    low: number;
    medium: number;
    high: number;
  } {
    const distribution = { low: 0, medium: 0, high: 0 };

    bottlenecks.forEach(bottleneck => {
      distribution[bottleneck.severity]++;
    });

    return distribution;
  }

  /**
   * Calculate suggestion distribution by type
   */
  private calculateSuggestionDistribution(suggestions: OptimizationSuggestion[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    suggestions.forEach(suggestion => {
      if (!distribution[suggestion.type]) {
        distribution[suggestion.type] = 0;
      }
      distribution[suggestion.type]++;
    });

    return distribution;
  }

  /**
   * Get top suggestions by estimated improvement
   */
  private getTopSuggestions(suggestions: OptimizationSuggestion[], limit: number): OptimizationSuggestion[] {
    return [...suggestions]
      .sort((a, b) => b.estimatedImprovement - a.estimatedImprovement)
      .slice(0, limit);
  }
}
