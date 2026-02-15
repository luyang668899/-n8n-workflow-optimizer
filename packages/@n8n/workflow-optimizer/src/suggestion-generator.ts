import type { Workflow } from 'n8n-workflow';
import { ExecutionAnalysisResult, OptimizationSuggestion, OptimizationType, OptimizationOptions } from './types';
import { WorkflowGraphBuilder } from './workflow-graph';

export class SuggestionGenerator {
  private graphBuilder: WorkflowGraphBuilder;

  constructor() {
    this.graphBuilder = new WorkflowGraphBuilder();
  }

  /**
   * Generate optimization suggestions based on execution analyses
   */
  async generate(
    workflow: Workflow,
    analyses: ExecutionAnalysisResult[],
    options: OptimizationOptions
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Generate suggestions based on execution data
    suggestions.push(...this.generateExecutionBasedSuggestions(analyses, options));

    // Generate suggestions based on workflow structure
    const structureAnalysis = this.graphBuilder.build(workflow);
    suggestions.push(...this.generateStructureBasedSuggestions(workflow, structureAnalysis, options));

    // Generate suggestions based on parallelization opportunities
    suggestions.push(...this.generateParallelizationSuggestions(structureAnalysis, options));

    // Generate suggestions based on node types
    suggestions.push(...this.generateNodeBasedSuggestions(workflow, options));

    // Deduplicate suggestions
    return this.deduplicateSuggestions(suggestions);
  }

  /**
   * Generate optimization suggestions based on workflow structure only
   */
  async generateFromStructure(
    workflow: Workflow,
    structureAnalysis: any,
    options: OptimizationOptions
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Generate structure-based suggestions
    suggestions.push(...this.generateStructureBasedSuggestions(workflow, structureAnalysis, options));

    // Generate parallelization suggestions
    suggestions.push(...this.generateParallelizationSuggestions(structureAnalysis, options));

    // Generate node-based suggestions
    suggestions.push(...this.generateNodeBasedSuggestions(workflow, options));

    // Deduplicate suggestions
    return this.deduplicateSuggestions(suggestions);
  }

  /**
   * Generate suggestions based on execution data
   */
  private generateExecutionBasedSuggestions(
    analyses: ExecutionAnalysisResult[],
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (analyses.length === 0) return suggestions;

    // Get latest analysis
    const latestAnalysis = analyses[analyses.length - 1];
    const metrics = latestAnalysis.metrics;

    // Check for long-running nodes
    metrics.nodeExecutions.forEach((nodeMetrics, nodeName) => {
      if (nodeMetrics.executionTime > 1000) { // 1 second
        if (options.enabledOptimizations.includes(OptimizationType.CACHING)) {
          suggestions.push({
            id: `cache-${nodeName}`,
            type: OptimizationType.CACHING,
            description: `Add caching for node "${nodeName}" to reduce execution time`,
            severity: nodeMetrics.executionTime > 5000 ? 'high' : 'medium',
            estimatedImprovement: Math.min(80, Math.round((nodeMetrics.executionTime / 100))),
            implementationEffort: 'low',
            appliesTo: [nodeName],
            details: {
              nodeName,
              currentExecutionTime: nodeMetrics.executionTime,
              executionCount: nodeMetrics.executionCount
            }
          });
        }

        if (options.enabledOptimizations.includes(OptimizationType.PARALLEL_EXECUTION)) {
          if (nodeMetrics.executionCount > 1) {
            suggestions.push({
              id: `parallel-${nodeName}`,
              type: OptimizationType.PARALLEL_EXECUTION,
              description: `Execute node "${nodeName}" in parallel to improve performance`,
              severity: nodeMetrics.executionTime > 3000 ? 'medium' : 'low',
              estimatedImprovement: Math.min(60, Math.round((nodeMetrics.executionCount * 30))),
              implementationEffort: 'medium',
              appliesTo: [nodeName],
              details: {
                nodeName,
                executionCount: nodeMetrics.executionCount
              }
            });
          }
        }
      }
    });

    // Check for high error rates
    metrics.nodeExecutions.forEach((nodeMetrics, nodeName) => {
      if (nodeMetrics.errorCount > 0 && options.enabledOptimizations.includes(OptimizationType.ERROR_HANDLING)) {
        const errorRate = nodeMetrics.errorCount / nodeMetrics.executionCount;
        if (errorRate > 0.1) {
          suggestions.push({
            id: `error-handling-${nodeName}`,
            type: OptimizationType.ERROR_HANDLING,
            description: `Improve error handling for node "${nodeName}"`,
            severity: errorRate > 0.5 ? 'high' : 'medium',
            estimatedImprovement: Math.round(errorRate * 100),
            implementationEffort: 'low',
            appliesTo: [nodeName],
            details: {
              nodeName,
              errorCount: nodeMetrics.errorCount,
              executionCount: nodeMetrics.executionCount,
              errorRate
            }
          });
        }
      }
    });

    return suggestions;
  }

  /**
   * Generate suggestions based on workflow structure
   */
  private generateStructureBasedSuggestions(
    workflow: Workflow,
    structureAnalysis: any,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check workflow size
    const nodeCount = structureAnalysis.nodes.size;
    if (nodeCount > 50 && options.enabledOptimizations.includes(OptimizationType.WORKFLOW_SPLITTING)) {
      suggestions.push({
        id: 'workflow-splitting',
        type: OptimizationType.WORKFLOW_SPLITTING,
        description: 'Split this large workflow into smaller, more manageable workflows',
        severity: nodeCount > 100 ? 'high' : 'medium',
        estimatedImprovement: Math.min(40, Math.round(nodeCount / 2)),
        implementationEffort: 'high',
        appliesTo: Array.from(structureAnalysis.nodes.keys()),
        details: {
          nodeCount,
          entryPoints: structureAnalysis.entryNodes.length,
          exitPoints: structureAnalysis.exitNodes.length
        }
      });
    }

    // Check workflow depth
    const maxDepth = this.calculateMaxDepth(structureAnalysis);
    if (maxDepth > 10 && options.enabledOptimizations.includes(OptimizationType.WORKFLOW_SPLITTING)) {
      suggestions.push({
        id: 'workflow-depth-optimization',
        type: OptimizationType.WORKFLOW_SPLITTING,
        description: 'Reduce workflow depth by restructuring or splitting',
        severity: maxDepth > 20 ? 'high' : 'medium',
        estimatedImprovement: Math.min(30, Math.round(maxDepth / 3)),
        implementationEffort: 'medium',
        appliesTo: structureAnalysis.criticalPath,
        details: {
          maxDepth,
          criticalPathLength: structureAnalysis.criticalPath.length
        }
      });
    }

    // Check for cycles
    const cycles = this.graphBuilder.detectCycles(structureAnalysis);
    if (cycles.length > 0) {
      suggestions.push({
        id: 'cycle-detection',
        type: OptimizationType.CONNECTION_OPTIMIZATION,
        description: 'Remove cycles from workflow to avoid infinite loops',
        severity: 'high',
        estimatedImprovement: 100,
        implementationEffort: 'medium',
        appliesTo: cycles.flat(),
        details: {
          cycleCount: cycles.length,
          cycles
        }
      });
    }

    return suggestions;
  }

  /**
   * Generate suggestions based on parallelization opportunities
   */
  private generateParallelizationSuggestions(
    structureAnalysis: any,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (!options.enabledOptimizations.includes(OptimizationType.PARALLEL_EXECUTION)) {
      return suggestions;
    }

    // Find parallelization opportunities
    const opportunities = this.graphBuilder.findParallelizationOpportunities(structureAnalysis);

    opportunities.forEach((opportunity, index) => {
      if (opportunity.length > 1) {
        suggestions.push({
          id: `parallelization-${index}`,
          type: OptimizationType.PARALLEL_EXECUTION,
          description: `Execute nodes in parallel: ${opportunity.join(', ')}`,
          severity: 'medium',
          estimatedImprovement: Math.min(50, opportunity.length * 10),
          implementationEffort: 'medium',
          appliesTo: opportunity,
          details: {
            nodeCount: opportunity.length
          }
        });
      }
    });

    return suggestions;
  }

  /**
   * Generate suggestions based on node types
   */
  private generateNodeBasedSuggestions(
    workflow: Workflow,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    Object.values(workflow.nodes).forEach(node => {
      if (node.disabled) return;

      // Generate suggestions based on specific node types
      switch (node.type) {
        case 'n8n-nodes-base.httpRequest':
          suggestions.push(...this.generateHttpRequestSuggestions(node, options));
          break;
        case 'n8n-nodes-base.function':
        case 'n8n-nodes-base.code':
          suggestions.push(...this.generateCodeNodeSuggestions(node, options));
          break;
        case 'n8n-nodes-base.splitInBatches':
          suggestions.push(...this.generateBatchNodeSuggestions(node, options));
          break;
        case 'n8n-nodes-base.aggregate':
          suggestions.push(...this.generateAggregateNodeSuggestions(node, options));
          break;
      }
    });

    return suggestions;
  }

  /**
   * Generate suggestions for HTTP Request nodes
   */
  private generateHttpRequestSuggestions(
    node: any,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (options.enabledOptimizations.includes(OptimizationType.CACHING)) {
      suggestions.push({
        id: `cache-http-${node.name}`,
        type: OptimizationType.CACHING,
        description: `Add caching for HTTP Request node "${node.name}"`,
        severity: 'medium',
        estimatedImprovement: 60,
        implementationEffort: 'low',
        appliesTo: [node.name],
        details: {
          nodeName: node.name,
          nodeType: node.type
        }
      });
    }

    if (options.enabledOptimizations.includes(OptimizationType.BATCH_PROCESSING)) {
      suggestions.push({
        id: `batch-http-${node.name}`,
        type: OptimizationType.BATCH_PROCESSING,
        description: `Use batch processing for HTTP Request node "${node.name}"`,
        severity: 'low',
        estimatedImprovement: 40,
        implementationEffort: 'medium',
        appliesTo: [node.name],
        details: {
          nodeName: node.name,
          nodeType: node.type
        }
      });
    }

    return suggestions;
  }

  /**
   * Generate suggestions for Code and Function nodes
   */
  private generateCodeNodeSuggestions(
    node: any,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (options.enabledOptimizations.includes(OptimizationType.EXPRESSION_OPTIMIZATION)) {
      suggestions.push({
        id: `optimize-code-${node.name}`,
        type: OptimizationType.EXPRESSION_OPTIMIZATION,
        description: `Optimize code in node "${node.name}"`,
        severity: 'medium',
        estimatedImprovement: 30,
        implementationEffort: 'medium',
        appliesTo: [node.name],
        details: {
          nodeName: node.name,
          nodeType: node.type
        }
      });
    }

    return suggestions;
  }

  /**
   * Generate suggestions for Batch nodes
   */
  private generateBatchNodeSuggestions(
    node: any,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (options.enabledOptimizations.includes(OptimizationType.BATCH_PROCESSING)) {
      suggestions.push({
        id: `optimize-batch-${node.name}`,
        type: OptimizationType.BATCH_PROCESSING,
        description: `Optimize batch size for node "${node.name}"`,
        severity: 'low',
        estimatedImprovement: 20,
        implementationEffort: 'low',
        appliesTo: [node.name],
        details: {
          nodeName: node.name,
          nodeType: node.type
        }
      });
    }

    return suggestions;
  }

  /**
   * Generate suggestions for Aggregate nodes
   */
  private generateAggregateNodeSuggestions(
    node: any,
    options: OptimizationOptions
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (options.enabledOptimizations.includes(OptimizationType.CACHING)) {
      suggestions.push({
        id: `cache-aggregate-${node.name}`,
        type: OptimizationType.CACHING,
        description: `Add caching for Aggregate node "${node.name}"`,
        severity: 'low',
        estimatedImprovement: 30,
        implementationEffort: 'low',
        appliesTo: [node.name],
        details: {
          nodeName: node.name,
          nodeType: node.type
        }
      });
    }

    return suggestions;
  }

  /**
   * Calculate maximum depth of workflow graph
   */
  private calculateMaxDepth(structureAnalysis: any): number {
    let maxDepth = 0;
    structureAnalysis.nodes.forEach((node: any) => {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
      }
    });
    return maxDepth;
  }

  /**
   * Deduplicate suggestions
   */
  private deduplicateSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    const uniqueSuggestions = new Map<string, OptimizationSuggestion>();

    suggestions.forEach(suggestion => {
      if (!uniqueSuggestions.has(suggestion.id)) {
        uniqueSuggestions.set(suggestion.id, suggestion);
      }
    });

    return Array.from(uniqueSuggestions.values());
  }
}
