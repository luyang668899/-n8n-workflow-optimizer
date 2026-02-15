import { WorkflowParser } from './parser/workflow-parser';
import { LLMService } from './services/llm-service';
import type { AIOptimizerConfig, OptimizationSuggestion, WorkflowStructure, SuggestionRequest, SuggestionFeedback, LLMResponse } from './types';
import { defaultAIOptimizerConfig } from './types';
import type { Workflow, INodeExecutionData } from 'n8n-workflow';
import type { WorkflowPerformanceMetrics, Bottleneck } from '@n8n/workflow-monitor';

/**
 * Main AI workflow optimizer class
 */
export class WorkflowAIOptimizer {
  private parser: WorkflowParser;
  private llmService: LLMService;
  private config: AIOptimizerConfig;
  private suggestionCache: Map<string, { suggestions: OptimizationSuggestion[]; timestamp: number }> = new Map();

  /**
   * Constructor
   */
  constructor(config: Partial<AIOptimizerConfig> = {}) {
    // Merge user config with defaults
    this.config = {
      ...defaultAIOptimizerConfig,
      ...config
    };

    // Initialize components
    this.parser = new WorkflowParser();
    this.llmService = new LLMService(this.config);
  }

  /**
   * Generate optimization suggestions
   */
  async generateSuggestions(
    workflow: Workflow,
    metrics?: WorkflowPerformanceMetrics,
    bottlenecks?: Bottleneck[],
    userQuery?: string
  ): Promise<OptimizationSuggestion[]> {
    // Generate cache key
    const cacheKey = this.generateCacheKey(workflow, metrics, userQuery);

    // Check cache
    if (this.config.enableCaching) {
      const cached = this.getCachedSuggestions(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Parse workflow to structured representation
    const workflowStructure = this.parser.parseWorkflow(workflow, metrics, bottlenecks);

    // Generate suggestions from LLM
    const response = await this.llmService.generateSuggestions(
      workflowStructure,
      metrics,
      bottlenecks,
      userQuery
    );

    // Process suggestions
    const suggestions = this.processSuggestions(response.suggestions);

    // Cache suggestions
    if (this.config.enableCaching) {
      this.cacheSuggestions(cacheKey, suggestions);
    }

    return suggestions;
  }

  /**
   * Generate optimization suggestions from structured workflow
   */
  async generateSuggestionsFromStructure(
    request: SuggestionRequest
  ): Promise<OptimizationSuggestion[]> {
    // Generate cache key
    const cacheKey = this.generateCacheKeyFromRequest(request);

    // Check cache
    if (this.config.enableCaching) {
      const cached = this.getCachedSuggestions(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Generate suggestions from LLM
    const response = await this.llmService.generateSuggestions(
      request.workflow,
      request.metrics,
      request.bottlenecks,
      request.userQuery
    );

    // Process suggestions
    const suggestions = this.processSuggestions(response.suggestions);

    // Cache suggestions
    if (this.config.enableCaching) {
      this.cacheSuggestions(cacheKey, suggestions);
    }

    return suggestions;
  }

  /**
   * Get natural language response to user query
   */
  async getNaturalLanguageResponse(
    userQuery: string,
    workflow?: Workflow,
    metrics?: WorkflowPerformanceMetrics
  ): Promise<string> {
    if (workflow) {
      const workflowStructure = this.parser.parseWorkflow(workflow, metrics);
      return this.llmService.getNaturalLanguageResponse(userQuery, workflowStructure, metrics);
    } else {
      return this.llmService.getNaturalLanguageResponse(userQuery);
    }
  }

  /**
   * Process and prioritize suggestions
   */
  private processSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    // Prioritize suggestions based on multiple factors
    return suggestions
      .map(suggestion => ({
        ...suggestion,
        // Recalculate priority based on potential improvement and complexity
        priority: this.calculatePriority(suggestion)
      }))
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
  }

  /**
   * Calculate suggestion priority
   */
  private calculatePriority(suggestion: OptimizationSuggestion): number {
    // Weight factors for priority calculation
    const improvementWeight = 0.6;
    const complexityWeight = 0.3;
    const severityWeight = 0.1;

    // Normalize complexity (lower complexity is better)
    const normalizedComplexity = 100 - suggestion.complexity;

    // Map severity to numeric value
    const severityValue = {
      low: 33,
      medium: 66,
      high: 100
    }[suggestion.severity];

    // Calculate weighted priority
    return Math.round(
      (suggestion.potentialImprovement * improvementWeight) +
      (normalizedComplexity * complexityWeight) +
      (severityValue * severityWeight)
    );
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    workflow: Workflow,
    metrics?: WorkflowPerformanceMetrics,
    userQuery?: string
  ): string {
    const workflowHash = `${workflow.id || workflow.name || 'unknown'}-${workflow.nodes.length}-${workflow.connections ? Object.keys(workflow.connections).length : 0}`;
    const metricsHash = metrics ? `metrics-${metrics.totalDuration || 0}` : 'no-metrics';
    const queryHash = userQuery ? `query-${userQuery.length}` : 'no-query';
    return `${workflowHash}-${metricsHash}-${queryHash}`;
  }

  /**
   * Generate cache key from suggestion request
   */
  private generateCacheKeyFromRequest(request: SuggestionRequest): string {
    const workflowHash = `${request.workflow.id}-${request.workflow.nodes.length}-${request.workflow.connections.length}`;
    const metricsHash = request.metrics ? `metrics-${request.metrics.totalDuration || 0}` : 'no-metrics';
    const queryHash = request.userQuery ? `query-${request.userQuery.length}` : 'no-query';
    return `${workflowHash}-${metricsHash}-${queryHash}`;
  }

  /**
   * Get cached suggestions
   */
  private getCachedSuggestions(key: string): OptimizationSuggestion[] | null {
    const cached = this.suggestionCache.get(key);
    if (!cached) return null;

    // Check if cache is expired
    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheExpiration) {
      this.suggestionCache.delete(key);
      return null;
    }

    return cached.suggestions;
  }

  /**
   * Cache suggestions
   */
  private cacheSuggestions(key: string, suggestions: OptimizationSuggestion[]): void {
    this.suggestionCache.set(key, {
      suggestions,
      timestamp: Date.now()
    });

    // Clean up expired cache entries
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.suggestionCache.entries()) {
      if (now - value.timestamp > this.config.cacheExpiration) {
        this.suggestionCache.delete(key);
      }
    }
  }

  /**
   * Submit user feedback on suggestion
   */
  async submitFeedback(feedback: SuggestionFeedback): Promise<void> {
    // Store feedback for learning purposes
    // In a production system, this would be stored in a database
    console.log('Received feedback:', feedback);

    // If learning is enabled, use feedback to improve future suggestions
    if (this.config.enableLearning) {
      // Implement learning logic here
      // This could include:
      // 1. Updating suggestion quality scores
      // 2. Adjusting priority calculation
      // 3. Fine-tuning prompt templates
    }
  }

  /**
   * Get workflow parser
   */
  getParser(): WorkflowParser {
    return this.parser;
  }

  /**
   * Get LLM service
   */
  getLLMService(): LLMService {
    return this.llmService;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIOptimizerConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    this.llmService.updateConfig(config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AIOptimizerConfig {
    return { ...this.config };
  }

  /**
   * Clear suggestion cache
   */
  clearCache(): void {
    this.suggestionCache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.suggestionCache.size;
  }

  /**
   * Test AI optimizer functionality
   */
  async test(): Promise<{ success: boolean; message: string }> {
    try {
      // Test LLM connection
      const llmConnected = await this.llmService.testConnection();
      if (!llmConnected) {
        return {
          success: false,
          message: 'LLM service connection failed'
        };
      }

      return {
        success: true,
        message: 'AI optimizer test passed'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Create workflow AI optimizer instance
 */
export function createWorkflowAIOptimizer(config: Partial<AIOptimizerConfig> = {}): WorkflowAIOptimizer {
  return new WorkflowAIOptimizer(config);
}

// Export types and utilities
export * from './types';
export * from './parser/workflow-parser';
export * from './services/llm-service';
