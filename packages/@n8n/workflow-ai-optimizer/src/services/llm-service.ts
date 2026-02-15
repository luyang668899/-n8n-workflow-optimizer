import OpenAI from 'openai';
import axios from 'axios';
import type { AIOptimizerConfig, OptimizationSuggestion, WorkflowStructure, LLMResponse } from '../types';
import type { WorkflowPerformanceMetrics, Bottleneck } from '@n8n/workflow-monitor';

/**
 * LLM service for generating optimization suggestions
 */
export class LLMService {
  private config: AIOptimizerConfig;
  private openaiClient: OpenAI | null = null;

  /**
   * Constructor
   */
  constructor(config: AIOptimizerConfig) {
    this.config = config;
    this.initClient();
  }

  /**
   * Initialize LLM client
   */
  private initClient(): void {
    if (this.config.provider === 'openai' && this.config.apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: this.config.apiKey
      });
    }
  }

  /**
   * Generate optimization suggestions
   */
  async generateSuggestions(
    workflow: WorkflowStructure,
    metrics?: WorkflowPerformanceMetrics,
    bottlenecks?: Bottleneck[],
    userQuery?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(workflow, metrics, bottlenecks, userQuery);
      const response = await this.callLLM(prompt);
      const suggestions = this.parseLLMResponse(response);

      return {
        suggestions,
        confidence: 0.9, // Placeholder for actual confidence score
        metadata: {
          model: this.config.model,
          tokensUsed: 0, // Placeholder for actual token count
          processingTime: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return {
        suggestions: [],
        confidence: 0,
        metadata: {
          model: this.config.model,
          tokensUsed: 0,
          processingTime: Date.now() - startTime
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof Error ? error.name : 'UNKNOWN'
        }
      };
    }
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(
    workflow: WorkflowStructure,
    metrics?: WorkflowPerformanceMetrics,
    bottlenecks?: Bottleneck[],
    userQuery?: string
  ): string {
    const workflowSummary = this.getWorkflowSummary(workflow);
    const metricsSummary = this.getMetricsSummary(metrics);
    const bottlenecksSummary = this.getBottlenecksSummary(bottlenecks);
    const userQueryText = userQuery ? `\nUser query: ${userQuery}` : '';

    return `# n8n Workflow Optimization Assistant

You are an expert workflow optimization specialist for n8n. Your task is to analyze the provided workflow structure, performance metrics, and bottlenecks to generate specific, actionable optimization suggestions.

## Workflow Information
${workflowSummary}

## Performance Metrics
${metricsSummary}

## Bottlenecks Detected
${bottlenecksSummary}

${userQueryText}

## Instructions
1. **Analyze thoroughly**: Examine the workflow structure, node configurations, connections, and performance metrics.
2. **Identify bottlenecks**: Focus on nodes with high execution time, memory usage, or CPU usage.
3. **Generate specific suggestions**: Provide concrete, actionable optimization recommendations.
4. **Prioritize suggestions**: Rank suggestions by potential impact and implementation complexity.
5. **Explain reasoning**: For each suggestion, explain why it will improve performance.
6. **Be realistic**: Suggestions should be feasible and safe to implement.
7. **Consider best practices**: Include suggestions for workflow design best practices.

## Output Format
Return a JSON array of optimization suggestions with the following structure:

[
  {
    "id": "unique-id",
    "title": "Suggestion title",
    "description": "Detailed explanation of the suggestion",
    "type": "performance" | "reliability" | "scalability" | "cost" | "bestPractice",
    "severity": "low" | "medium" | "high",
    "priority": 0-100,
    "potentialImprovement": 0-100,
    "complexity": 0-100,
    "affectedNodes": ["node1", "node2"],
    "suggestedChanges": [
      {
        "nodeId": "node-name",
        "property": "parameter.name",
        "oldValue": "current value",
        "newValue": "suggested value",
        "description": "Explanation of the change"
      }
    ],
    "expectedImpact": {
      "executionTime": -10, // Expected percentage improvement
      "memoryUsage": -5,    // Expected percentage improvement
      "cpuUsage": -8,       // Expected percentage improvement
      "dataSize": -15       // Expected percentage improvement
    },
    "evidence": [
      {
        "type": "metrics" | "pattern" | "rule" | "history",
        "data": "Supporting evidence"
      }
    ],
    "createdAt": ${Date.now()}
  }
]

## Example Suggestion
[
  {
    "id": "suggestion-1",
    "title": "Optimize HTTP Request Node Timeout",
    "description": "The HTTP Request node has a timeout set to 30 seconds, which is causing long execution times when requests hang.",
    "type": "performance",
    "severity": "medium",
    "priority": 85,
    "potentialImprovement": 60,
    "complexity": 10,
    "affectedNodes": ["HTTP Request"],
    "suggestedChanges": [
      {
        "nodeId": "HTTP Request",
        "property": "options.timeout",
        "oldValue": 30000,
        "newValue": 5000,
        "description": "Reduce timeout from 30s to 5s"
      }
    ],
    "expectedImpact": {
      "executionTime": -60,
      "memoryUsage": 0,
      "cpuUsage": 0,
      "dataSize": 0
    },
    "evidence": [
      {
        "type": "metrics",
        "data": "Node execution time: 28.5s (95% of workflow time)"
      }
    ],
    "createdAt": ${Date.now()}
  }
]
`;
  }

  /**
   * Get workflow summary for prompt
   */
  private getWorkflowSummary(workflow: WorkflowStructure): string {
    const nodeCount = workflow.nodes.length;
    const connectionCount = workflow.connections.length;
    const nodeTypes = [...new Set(workflow.nodes.map(node => node.type))];

    return `Name: ${workflow.name}
ID: ${workflow.id}
Description: ${workflow.description || 'No description'}
Nodes: ${nodeCount}
Connections: ${connectionCount}
Node types: ${nodeTypes.join(', ')}
Tags: ${workflow.tags.join(', ') || 'None'}`;
  }

  /**
   * Get metrics summary for prompt
   */
  private getMetricsSummary(metrics?: WorkflowPerformanceMetrics): string {
    if (!metrics) return 'No performance metrics available';

    const totalDuration = metrics.totalDuration || 0;
    const nodeMetrics = Array.from(metrics.nodeMetrics.entries())
      .map(([name, data]) => {
        return `${name}: ${data.duration || 0}ms (${data.status})`;
      })
      .join('\n');

    return `Total duration: ${totalDuration}ms
Status: ${metrics.status}
Node metrics:
${nodeMetrics}
Bottlenecks: ${metrics.bottlenecks.length}`;
  }

  /**
   * Get bottlenecks summary for prompt
   */
  private getBottlenecksSummary(bottlenecks?: Bottleneck[]): string {
    if (!bottlenecks || bottlenecks.length === 0) return 'No bottlenecks detected';

    return bottlenecks
      .map(b => `${b.nodeName} (${b.type}, ${b.severity}): ${b.description}`)
      .join('\n');
  }

  /**
   * Call LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    if (this.config.provider === 'openai' && this.openaiClient) {
      return this.callOpenAI(prompt);
    } else if (this.config.provider === 'custom' && this.config.apiEndpoint) {
      return this.callCustomAPI(prompt);
    } else {
      throw new Error('No valid LLM provider configured');
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await this.openaiClient.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert n8n workflow optimization assistant. Provide concise, actionable optimization suggestions in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: {
        type: 'json_object'
      }
    });

    return completion.choices[0].message.content || '';
  }

  /**
   * Call custom LLM API
   */
  private async callCustomAPI(prompt: string): Promise<string> {
    if (!this.config.apiEndpoint) {
      throw new Error('Custom API endpoint not configured');
    }

    const response = await axios.post(this.config.apiEndpoint, {
      model: this.config.model,
      prompt,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    });

    return response.data.choices[0].text || '';
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string): OptimizationSuggestion[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const suggestions = JSON.parse(jsonMatch[0]);

      // Validate and enhance suggestions
      return suggestions.map((suggestion: any) => ({
        ...suggestion,
        id: suggestion.id || `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: suggestion.createdAt || Date.now(),
        priority: Math.max(0, Math.min(100, suggestion.priority || 50)),
        potentialImprovement: Math.max(0, Math.min(100, suggestion.potentialImprovement || 0)),
        complexity: Math.max(0, Math.min(100, suggestion.complexity || 50)),
        affectedNodes: suggestion.affectedNodes || [],
        suggestedChanges: suggestion.suggestedChanges || [],
        expectedImpact: suggestion.expectedImpact || {},
        evidence: suggestion.evidence || []
      }));
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      return [];
    }
  }

  /**
   * Get natural language response to user query
   */
  async getNaturalLanguageResponse(
    userQuery: string,
    workflow?: WorkflowStructure,
    metrics?: WorkflowPerformanceMetrics
  ): Promise<string> {
    const prompt = this.buildNaturalLanguagePrompt(userQuery, workflow, metrics);
    const response = await this.callLLM(prompt);
    return response;
  }

  /**
   * Build natural language prompt
   */
  private buildNaturalLanguagePrompt(
    userQuery: string,
    workflow?: WorkflowStructure,
    metrics?: WorkflowPerformanceMetrics
  ): string {
    const workflowSummary = workflow ? this.getWorkflowSummary(workflow) : 'No workflow information provided';
    const metricsSummary = metrics ? this.getMetricsSummary(metrics) : 'No performance metrics provided';

    return `# n8n Workflow Optimization Assistant

You are an expert workflow optimization specialist for n8n. Please answer the user's question about workflow optimization based on the provided information.

## Workflow Information
${workflowSummary}

## Performance Metrics
${metricsSummary}

## User Question
${userQuery}

## Instructions
1. **Be helpful**: Provide a clear, informative answer to the user's question.
2. **Be specific**: Reference workflow details and metrics when relevant.
3. **Be concise**: Keep your answer focused and to the point.
4. **Be accurate**: Only provide information you're confident about.
5. **Include examples**: When appropriate, provide examples of optimization techniques.

Please provide a direct answer to the user's question without any additional formatting.`;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIOptimizerConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    this.initClient();
  }

  /**
   * Get current configuration
   */
  getConfig(): AIOptimizerConfig {
    return { ...this.config };
  }

  /**
   * Test LLM connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const testPrompt = 'Test connection';
      const response = await this.callLLM(testPrompt);
      return response.length > 0;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}
