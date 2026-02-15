import type { Workflow, INodeExecutionData } from 'n8n-workflow';
import type { WorkflowStructure, WorkflowNode, WorkflowConnection, WorkflowParserOptions, HistoricalExecutionData } from '../types';
import type { WorkflowPerformanceMetrics, NodePerformanceMetrics, Bottleneck } from '@n8n/workflow-monitor';
import { defaultWorkflowParserOptions } from '../types';

/**
 * Workflow parser for converting n8n workflow definitions to LLM-friendly structure
 */
export class WorkflowParser {
  private options: WorkflowParserOptions;

  /**
   * Constructor
   */
  constructor(options: Partial<WorkflowParserOptions> = {}) {
    this.options = {
      ...defaultWorkflowParserOptions,
      ...options
    };
  }

  /**
   * Parse n8n workflow to structured representation
   */
  parseWorkflow(
    workflow: Workflow,
    metrics?: WorkflowPerformanceMetrics,
    bottlenecks?: Bottleneck[],
    historicalData?: HistoricalExecutionData[]
  ): WorkflowStructure {
    const nodes = this.parseNodes(workflow, metrics);
    const connections = this.parseConnections(workflow);

    return {
      id: workflow.id || `workflow-${Date.now()}`,
      name: workflow.name || 'Unnamed Workflow',
      description: workflow.description || '',
      nodes,
      connections,
      tags: workflow.tags || [],
      settings: this.parseWorkflowSettings(workflow)
    };
  }

  /**
   * Parse workflow nodes
   */
  private parseNodes(
    workflow: Workflow,
    metrics?: WorkflowPerformanceMetrics
  ): WorkflowNode[] {
    return workflow.nodes.map(node => {
      const nodeMetrics = metrics?.nodeMetrics.get(node.name);

      return {
        id: node.id,
        name: node.name,
        type: node.type,
        position: node.position || { x: 0, y: 0 },
        parameters: this.simplifyParameters(node.parameters || {}),
        credentials: this.parseCredentials(node.credentials),
        settings: this.parseNodeSettings(node),
        metrics: this.options.includeMetrics ? nodeMetrics : undefined
      };
    });
  }

  /**
   * Parse workflow connections
   */
  private parseConnections(workflow: Workflow): WorkflowConnection[] {
    const connections: WorkflowConnection[] = [];

    if (workflow.connections) {
      Object.entries(workflow.connections).forEach(([sourceNodeId, nodeConnections]) => {
        Object.entries(nodeConnections).forEach(([sourceOutput, targets]) => {
          targets.forEach((target: any) => {
            connections.push({
              source: sourceNodeId,
              sourceOutput,
              target: target.node,
              targetInput: target.type
            });
          });
        });
      });
    }

    return connections;
  }

  /**
   * Parse workflow settings
   */
  private parseWorkflowSettings(workflow: Workflow): Record<string, any> {
    return {
      active: workflow.active || false,
      description: workflow.description || '',
      tags: workflow.tags || [],
      settings: workflow.settings || {},
      staticData: workflow.staticData || {},
      versionId: workflow.versionId || '',
      lastModified: workflow.lastModified || 0
    };
  }

  /**
   * Parse node credentials
   */
  private parseCredentials(credentials: any): Record<string, any> | undefined {
    if (!credentials) return undefined;

    // Don't expose actual credential values, just credential types
    return Object.entries(credentials).reduce((acc, [key, value]) => {
      acc[key] = {
        type: typeof value === 'object' && value !== null ? value.__type : typeof value
      };
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Parse node settings
   */
  private parseNodeSettings(node: any): Record<string, any> {
    return {
      disabled: node.disabled || false,
      note: node.note || '',
      parameters: node.parameters ? Object.keys(node.parameters) : [],
      typeVersion: node.typeVersion || 1,
      position: node.position || { x: 0, y: 0 }
    };
  }

  /**
   * Simplify complex parameters to reduce token count
   */
  private simplifyParameters(parameters: Record<string, any>, depth: number = 0): Record<string, any> {
    if (depth >= this.options.maxParameterDepth) {
      return { __simplified: true, type: typeof parameters };
    }

    if (!parameters || typeof parameters !== 'object') {
      return parameters;
    }

    if (Array.isArray(parameters)) {
      return parameters.map(item => {
        if (typeof item === 'object' && item !== null) {
          return this.simplifyParameters(item, depth + 1);
        }
        return item;
      });
    }

    return Object.entries(parameters).reduce((acc, [key, value]) => {
      if (typeof value === 'object' && value !== null) {
        acc[key] = this.simplifyParameters(value, depth + 1);
      } else if (typeof value === 'string' && value.length > 100) {
        // Truncate long strings
        acc[key] = {
          __truncated: true,
          length: value.length,
          preview: value.substring(0, 100) + '...'
        };
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Parse workflow performance metrics
   */
  parseMetrics(metrics: WorkflowPerformanceMetrics): Record<string, any> {
    return {
      totalDuration: metrics.totalDuration || 0,
      status: metrics.status,
      memoryUsage: metrics.memoryUsage,
      cpuUsage: metrics.cpuUsage,
      nodeMetrics: Array.from(metrics.nodeMetrics.entries()).reduce((acc, [nodeName, nodeMetrics]) => {
        acc[nodeName] = {
          duration: nodeMetrics.duration || 0,
          status: nodeMetrics.status,
          memoryUsage: nodeMetrics.memoryUsage,
          cpuUsage: nodeMetrics.cpuUsage,
          inputDataSize: nodeMetrics.inputDataSize,
          outputDataSize: nodeMetrics.outputDataSize,
          error: nodeMetrics.error ? {
            message: nodeMetrics.error.message,
            hasStack: !!nodeMetrics.error.stack
          } : undefined
        };
        return acc;
      }, {} as Record<string, any>),
      bottlenecks: metrics.bottlenecks.map(bottleneck => ({
        nodeName: bottleneck.nodeName,
        type: bottleneck.type,
        severity: bottleneck.severity,
        description: bottleneck.description,
        metrics: bottleneck.metrics
      }))
    };
  }

  /**
   * Parse bottlenecks for LLM consumption
   */
  parseBottlenecks(bottlenecks: Bottleneck[]): Record<string, any>[] {
    return bottlenecks.map(bottleneck => ({
      nodeName: bottleneck.nodeName,
      type: bottleneck.type,
      severity: bottleneck.severity,
      description: bottleneck.description,
      metrics: bottleneck.metrics,
      timestamp: bottleneck.timestamp
    }));
  }

  /**
   * Parse historical execution data
   */
  parseHistoricalData(historicalData: HistoricalExecutionData[]): Record<string, any>[] {
    return historicalData.map(data => ({
      executionId: data.executionId,
      timestamp: data.timestamp,
      duration: data.duration,
      success: data.success,
      error: data.error,
      nodeMetrics: Object.entries(data.nodeMetrics).reduce((acc, [nodeName, metrics]) => {
        acc[nodeName] = {
          duration: metrics.duration || 0,
          status: metrics.status,
          memoryUsage: metrics.memoryUsage ? {
            before: metrics.memoryUsage.before,
            after: metrics.memoryUsage.after,
            peak: metrics.memoryUsage.peak
          } : undefined,
          cpuUsage: metrics.cpuUsage
        };
        return acc;
      }, {} as Record<string, any>)
    }));
  }

  /**
   * Generate workflow summary for LLM prompt
   */
  generateWorkflowSummary(workflow: WorkflowStructure): string {
    const nodeCount = workflow.nodes.length;
    const connectionCount = workflow.connections.length;
    const nodeTypes = [...new Set(workflow.nodes.map(node => node.type))];
    const hasCredentials = workflow.nodes.some(node => node.credentials);

    return `Workflow "${workflow.name}" (ID: ${workflow.id}) has ${nodeCount} nodes and ${connectionCount} connections. ` +
           `Node types include: ${nodeTypes.join(', ')}. ` +
           `It ${hasCredentials ? 'uses' : 'does not use'} credentials. ` +
           `Description: ${workflow.description || 'No description provided'}.`;
  }

  /**
   * Update parser options
   */
  updateOptions(options: Partial<WorkflowParserOptions>): void {
    this.options = {
      ...this.options,
      ...options
    };
  }

  /**
   * Get current parser options
   */
  getOptions(): WorkflowParserOptions {
    return { ...this.options };
  }

  /**
   * Validate parsed workflow structure
   */
  validateStructure(structure: WorkflowStructure): boolean {
    if (!structure.id || !structure.name) {
      return false;
    }

    if (!Array.isArray(structure.nodes) || !Array.isArray(structure.connections)) {
      return false;
    }

    // Validate nodes
    for (const node of structure.nodes) {
      if (!node.id || !node.name || !node.type) {
        return false;
      }
    }

    // Validate connections
    for (const connection of structure.connections) {
      if (!connection.source || !connection.target || !connection.sourceOutput || !connection.targetInput) {
        return false;
      }
    }

    return true;
  }
}
