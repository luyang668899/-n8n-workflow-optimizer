import type { Workflow, IRun } from 'n8n-workflow';
import { WorkflowAnalyzer } from './analyzer';
import { SuggestionGenerator } from './suggestion-generator';
import { OptimizationResult, OptimizationOptions, DEFAULT_OPTIMIZATION_OPTIONS } from './types';

export class WorkflowOptimizer {
  private analyzer: WorkflowAnalyzer;
  private suggestionGenerator: SuggestionGenerator;

  constructor() {
    this.analyzer = new WorkflowAnalyzer();
    this.suggestionGenerator = new SuggestionGenerator();
  }

  /**
   * Optimize workflow based on execution data
   */
  async optimize(
    workflow: Workflow,
    runs: IRun[],
    options: OptimizationOptions = DEFAULT_OPTIMIZATION_OPTIONS
  ): Promise<OptimizationResult> {
    // Analyze workflow executions
    const analyses = await Promise.all(
      runs.map(run => this.analyzer.analyzeExecution(run, workflow))
    );

    // Generate optimization suggestions
    const suggestions = await this.suggestionGenerator.generate(
      workflow,
      analyses,
      options
    );

    // Calculate estimated improvement
    const estimatedImprovement = this.calculateEstimatedImprovement(suggestions);

    // Get bottlenecks from latest analysis
    const latestAnalysis = analyses[analyses.length - 1];
    const bottlenecks = latestAnalysis?.metrics.bottlenecks || [];

    return {
      workflowId: workflow.id,
      workflowName: workflow.name || 'Unnamed Workflow',
      originalMetrics: latestAnalysis?.metrics || {
        totalExecutionTime: 0,
        nodeExecutions: new Map(),
        connectionCount: 0,
        nodeCount: 0,
        averageNodeExecutionTime: 0,
        longestRunningNode: '',
        bottlenecks: []
      },
      suggestedOptimizations: suggestions,
      estimatedImprovement,
      totalSuggestions: suggestions.length,
      bottlenecks,
      generatedAt: new Date()
    };
  }

  /**
   * Optimize workflow based on structure only
   */
  async optimizeStructure(
    workflow: Workflow,
    options: OptimizationOptions = DEFAULT_OPTIMIZATION_OPTIONS
  ): Promise<OptimizationResult> {
    // Analyze workflow structure
    const structureAnalysis = this.analyzer.analyzeStructure(workflow);

    // Generate structure-based suggestions
    const suggestions = await this.suggestionGenerator.generateFromStructure(
      workflow,
      structureAnalysis,
      options
    );

    // Calculate estimated improvement
    const estimatedImprovement = this.calculateEstimatedImprovement(suggestions);

    return {
      workflowId: workflow.id,
      workflowName: workflow.name || 'Unnamed Workflow',
      originalMetrics: {
        totalExecutionTime: 0,
        nodeExecutions: new Map(),
        connectionCount: structureAnalysis.connectionCount,
        nodeCount: structureAnalysis.nodeCount,
        averageNodeExecutionTime: 0,
        longestRunningNode: '',
        bottlenecks: []
      },
      suggestedOptimizations: suggestions,
      estimatedImprovement,
      totalSuggestions: suggestions.length,
      bottlenecks: [],
      generatedAt: new Date()
    };
  }

  /**
   * Calculate estimated improvement from suggestions
   */
  private calculateEstimatedImprovement(suggestions: any[]): number {
    if (suggestions.length === 0) return 0;

    // Calculate weighted average improvement
    let totalImprovement = 0;
    let totalWeight = 0;

    suggestions.forEach(suggestion => {
      const weight = this.getSuggestionWeight(suggestion);
      totalImprovement += suggestion.estimatedImprovement * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.min(95, Math.round(totalImprovement / totalWeight)) : 0;
  }

  /**
   * Get weight for suggestion based on severity and effort
   */
  private getSuggestionWeight(suggestion: any): number {
    const severityWeights = { high: 3, medium: 2, low: 1 };
    const effortWeights = { low: 3, medium: 2, high: 1 };

    return (
      (severityWeights[suggestion.severity] || 1) *
      (effortWeights[suggestion.implementationEffort] || 1)
    );
  }

  /**
   * Apply optimization suggestions to workflow
   */
  async applyOptimizations(
    workflow: Workflow,
    suggestions: any[],
    options: { applyOnly: string[] } = { applyOnly: [] }
  ): Promise<Workflow> {
    // Create a copy of the workflow
    const optimizedWorkflow = this.cloneWorkflow(workflow);

    // Apply selected suggestions
    const suggestionsToApply = options.applyOnly.length > 0
      ? suggestions.filter(s => options.applyOnly.includes(s.id))
      : suggestions;

    for (const suggestion of suggestionsToApply) {
      await this.applySuggestion(optimizedWorkflow, suggestion);
    }

    return optimizedWorkflow;
  }

  /**
   * Apply a single optimization suggestion
   */
  private async applySuggestion(workflow: Workflow, suggestion: any): Promise<void> {
    // Implementation depends on suggestion type
    switch (suggestion.type) {
      case 'parallelExecution':
        await this.applyParallelExecution(workflow, suggestion);
        break;
      case 'caching':
        await this.applyCaching(workflow, suggestion);
        break;
      case 'batchProcessing':
        await this.applyBatchProcessing(workflow, suggestion);
        break;
      case 'nodeReplacement':
        await this.applyNodeReplacement(workflow, suggestion);
        break;
      case 'workflowSplitting':
        await this.applyWorkflowSplitting(workflow, suggestion);
        break;
      case 'expressionOptimization':
        await this.applyExpressionOptimization(workflow, suggestion);
        break;
      case 'connectionOptimization':
        await this.applyConnectionOptimization(workflow, suggestion);
        break;
      case 'resourceAllocation':
        await this.applyResourceAllocation(workflow, suggestion);
        break;
      case 'errorHandling':
        await this.applyErrorHandling(workflow, suggestion);
        break;
      case 'loggingOptimization':
        await this.applyLoggingOptimization(workflow, suggestion);
        break;
    }
  }



  /**
   * Clone workflow
   */
  private cloneWorkflow(workflow: Workflow): Workflow {
    // Create a deep copy of the workflow
    const workflowData = JSON.parse(JSON.stringify(workflow));
    return workflowData as Workflow;
  }

  /**
   * Apply parallel execution optimization
   */
  private async applyParallelExecution(workflow: Workflow, suggestion: any): Promise<void> {
    // For each node in the suggestion
    suggestion.appliesTo.forEach((nodeName: string) => {
      const node = workflow.nodes[nodeName];
      if (node) {
        // Add parallel execution configuration
        if (!node.parameters) {
          node.parameters = {};
        }
        node.parameters.parallelExecution = {
          enabled: true,
          maxConcurrency: 5
        };
      }
    });
  }

  /**
   * Apply caching optimization
   */
  private async applyCaching(workflow: Workflow, suggestion: any): Promise<void> {
    // For each node in the suggestion
    suggestion.appliesTo.forEach((nodeName: string) => {
      const node = workflow.nodes[nodeName];
      if (node) {
        // Add caching configuration
        if (!node.parameters) {
          node.parameters = {};
        }
        node.parameters.caching = {
          enabled: true,
          ttl: 3600,
          key: 'auto'
        };
      }
    });
  }

  /**
   * Apply batch processing optimization
   */
  private async applyBatchProcessing(workflow: Workflow, suggestion: any): Promise<void> {
    // For each node in the suggestion
    suggestion.appliesTo.forEach((nodeName: string) => {
      const node = workflow.nodes[nodeName];
      if (node) {
        // Add batch processing configuration
        if (!node.parameters) {
          node.parameters = {};
        }
        node.parameters.batchProcessing = {
          enabled: true,
          batchSize: 10
        };
      }
    });
  }

  /**
   * Apply node replacement optimization
   */
  private async applyNodeReplacement(workflow: Workflow, suggestion: any): Promise<void> {
    // Implementation for node replacement optimization
    // This would involve replacing nodes with more efficient alternatives
    if (suggestion.details?.replacementNodeType) {
      suggestion.appliesTo.forEach((nodeName: string) => {
        const node = workflow.nodes[nodeName];
        if (node) {
          // Replace node type with suggested alternative
          node.type = suggestion.details.replacementNodeType;
        }
      });
    }
  }

  /**
   * Apply workflow splitting optimization
   */
  private async applyWorkflowSplitting(workflow: Workflow, suggestion: any): Promise<void> {
    // Implementation for workflow splitting optimization
    // Note: This is a complex operation that would typically create new workflows
    // For now, we'll just add a marker for manual splitting
    workflow.metadata = workflow.metadata || {};
    workflow.metadata.needsSplitting = true;
    workflow.metadata.suggestedSplitPoints = suggestion.details?.splitPoints || [];
  }

  /**
   * Apply expression optimization
   */
  private async applyExpressionOptimization(workflow: Workflow, suggestion: any): Promise<void> {
    // For each node in the suggestion
    suggestion.appliesTo.forEach((nodeName: string) => {
      const node = workflow.nodes[nodeName];
      if (node && node.parameters) {
        // Add expression optimization flag
        node.parameters.optimizeExpressions = true;
      }
    });
  }

  /**
   * Apply connection optimization
   */
  private async applyConnectionOptimization(workflow: Workflow, suggestion: any): Promise<void> {
    // Implementation for connection optimization
    // This would involve optimizing data transfer between nodes
    workflow.metadata = workflow.metadata || {};
    workflow.metadata.optimizedConnections = true;
  }

  /**
   * Apply resource allocation optimization
   */
  private async applyResourceAllocation(workflow: Workflow, suggestion: any): Promise<void> {
    // For each node in the suggestion
    suggestion.appliesTo.forEach((nodeName: string) => {
      const node = workflow.nodes[nodeName];
      if (node) {
        // Add resource allocation configuration
        if (!node.parameters) {
          node.parameters = {};
        }
        node.parameters.resourceAllocation = {
          memoryLimit: suggestion.details?.memoryLimit || '512MB',
          timeout: suggestion.details?.timeout || 30000
        };
      }
    });
  }

  /**
   * Apply error handling optimization
   */
  private async applyErrorHandling(workflow: Workflow, suggestion: any): Promise<void> {
    // For each node in the suggestion
    suggestion.appliesTo.forEach((nodeName: string) => {
      const node = workflow.nodes[nodeName];
      if (node) {
        // Add error handling configuration
        if (!node.parameters) {
          node.parameters = {};
        }
        node.parameters.errorHandling = {
          enabled: true,
          retryCount: 3,
          retryDelay: 1000
        };
      }
    });
  }

  /**
   * Apply logging optimization
   */
  private async applyLoggingOptimization(workflow: Workflow, suggestion: any): Promise<void> {
    // For each node in the suggestion
    suggestion.appliesTo.forEach((nodeName: string) => {
      const node = workflow.nodes[nodeName];
      if (node) {
        // Add logging optimization configuration
        if (!node.parameters) {
          node.parameters = {};
        }
        node.parameters.logging = {
          enabled: true,
          level: 'info',
          optimize: true
        };
      }
    });
  }

  /**
   * Validate optimization suggestions
   */
  validateSuggestions(suggestions: any[], workflow: Workflow): any[] {
    return suggestions.filter(suggestion => {
      // Validate that suggestion applies to existing nodes
      return suggestion.appliesTo.every((nodeName: string) => {
        return workflow.getNode(nodeName) !== null;
      });
    });
  }

  /**
   * Prioritize optimization suggestions
   */
  prioritizeSuggestions(suggestions: any[]): any[] {
    return suggestions.sort((a, b) => {
      // Sort by severity, then by estimated improvement, then by implementation effort
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const effortOrder = { low: 3, medium: 2, high: 1 };

      if (severityOrder[b.severity] !== severityOrder[a.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }

      if (b.estimatedImprovement !== a.estimatedImprovement) {
        return b.estimatedImprovement - a.estimatedImprovement;
      }

      return effortOrder[a.implementationEffort] - effortOrder[b.implementationEffort];
    });
  }
}
