import { Workflow } from 'n8n-workflow';
import { PerformanceCollector } from '../collectors/performance-collector';
import { PerformanceEvent, MonitorConfig } from '../types';
import type { INodeExecutionData, IExecuteFunctions } from 'n8n-workflow';

/**
 * n8n execution hooks for performance monitoring
 */
export class ExecutionHooks {
  private collector: PerformanceCollector;
  private config: MonitorConfig;
  private eventCallback?: (event: PerformanceEvent) => void;
  private activeExecutions: Set<string>;

  constructor(collector: PerformanceCollector, config: MonitorConfig) {
    this.collector = collector;
    this.config = config;
    this.activeExecutions = new Set();
  }

  /**
   * Set event callback for real-time streaming
   */
  setEventCallback(callback: (event: PerformanceEvent) => void): void {
    this.eventCallback = callback;
  }

  /**
   * Hook called when workflow execution starts
   */
  async onWorkflowStart(workflow: Workflow, executionId: string): Promise<void> {
    if (!this.config.enabled) return;

    this.activeExecutions.add(executionId);
    const metrics = this.collector.startWorkflowMonitoring(
      workflow.id || '',
      workflow.name || 'Unnamed Workflow',
      executionId
    );

    // Emit event for real-time streaming
    if (this.config.realTimeStreaming && this.eventCallback) {
      this.eventCallback({
        type: 'workflowStart',
        timestamp: Date.now(),
        workflowId: workflow.id || '',
        executionId,
        data: metrics
      });
    }
  }

  /**
   * Hook called when workflow execution ends
   */
  async onWorkflowEnd(workflow: Workflow, executionId: string, error?: Error): Promise<void> {
    if (!this.config.enabled || !this.activeExecutions.has(executionId)) return;

    const metrics = await this.collector.endWorkflowMonitoring(executionId, error);
    this.activeExecutions.delete(executionId);

    // Emit event for real-time streaming
    if (this.config.realTimeStreaming && this.eventCallback && metrics) {
      this.eventCallback({
        type: 'workflowEnd',
        timestamp: Date.now(),
        workflowId: workflow.id || '',
        executionId,
        data: metrics
      });

      // Emit bottleneck events if any
      metrics.bottlenecks.forEach(bottleneck => {
        this.eventCallback!({
          type: 'bottleneck',
          timestamp: Date.now(),
          workflowId: workflow.id || '',
          executionId,
          data: bottleneck
        });
      });
    }

    // Clean up metrics
    this.collector.cleanupMetrics(executionId);
  }

  /**
   * Hook called when node execution starts
   */
  async onNodeStart(
    workflowId: string,
    executionId: string,
    nodeName: string,
    nodeType: string
  ): Promise<void> {
    if (!this.config.enabled || !this.activeExecutions.has(executionId)) return;

    const metrics = this.collector.startNodeMonitoring(executionId, nodeName, nodeType);

    // Emit event for real-time streaming
    if (this.config.realTimeStreaming && this.eventCallback) {
      this.eventCallback({
        type: 'nodeStart',
        timestamp: Date.now(),
        workflowId,
        executionId,
        data: metrics
      });
    }
  }

  /**
   * Hook called when node execution ends
   */
  async onNodeEnd(
    workflowId: string,
    executionId: string,
    nodeName: string,
    nodeType: string,
    inputData?: INodeExecutionData[],
    outputData?: INodeExecutionData[],
    error?: Error
  ): Promise<void> {
    if (!this.config.enabled || !this.activeExecutions.has(executionId)) return;

    const metrics = await this.collector.endNodeMonitoring(
      executionId,
      nodeName,
      inputData,
      outputData,
      error
    );

    // Emit event for real-time streaming
    if (this.config.realTimeStreaming && this.eventCallback && metrics) {
      this.eventCallback({
        type: 'nodeEnd',
        timestamp: Date.now(),
        workflowId,
        executionId,
        data: metrics
      });

      // Emit error event if any
      if (error) {
        this.eventCallback({
          type: 'error',
          timestamp: Date.now(),
          workflowId,
          executionId,
          data: {
            nodeName,
            error: {
              message: error.message,
              stack: error.stack
            }
          }
        });
      }
    }
  }

  /**
   * Hook called during node execution for sampling
   */
  async onNodeExecutionSampling(
    workflowId: string,
    executionId: string,
    nodeName: string,
    progress: number
  ): Promise<void> {
    if (!this.config.enabled || !this.activeExecutions.has(executionId)) return;

    // Only sample if configured
    if (!this.collector.shouldSample()) return;

    // Emit metrics event for real-time streaming
    if (this.config.realTimeStreaming && this.eventCallback) {
      const workflowMetrics = this.collector.getWorkflowMetrics(executionId);
      const nodeMetrics = workflowMetrics?.nodeMetrics.get(nodeName);

      if (nodeMetrics) {
        this.eventCallback({
          type: 'metrics',
          timestamp: Date.now(),
          workflowId,
          executionId,
          data: {
            nodeName,
            progress,
            elapsedTime: Date.now() - nodeMetrics.startTime,
            metrics: nodeMetrics
          }
        });
      }
    }
  }

  /**
   * Install hooks into n8n workflow execution
   */
  installHooks(): void {
    if (!this.config.enabled) return;

    // Hook into Workflow.execute method
    const originalExecute = Workflow.prototype.execute;
    // Store original method for later restoration
    if (!(global as any).__n8n_original_workflow_execute) {
      (global as any).__n8n_original_workflow_execute = originalExecute;
    }

    Workflow.prototype.execute = async function (...args: any[]) {
      const workflow = this;
      const executionId = args[0]?.executionId || `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Call onWorkflowStart hook
      const hooks = (global as any).__n8n_workflow_monitor_hooks;
      if (hooks) {
        await hooks.onWorkflowStart(workflow, executionId);
      }

      try {
        const result = await originalExecute.apply(this, args);

        // Call onWorkflowEnd hook
        if (hooks) {
          await hooks.onWorkflowEnd(workflow, executionId);
        }

        return result;
      } catch (error) {
        // Call onWorkflowEnd hook with error
        if (hooks) {
          await hooks.onWorkflowEnd(workflow, executionId, error as Error);
        }

        throw error;
      }
    };

    // Store hooks reference globally for access from node execution
    (global as any).__n8n_workflow_monitor_hooks = this;
  }

  /**
   * Uninstall hooks from n8n workflow execution
   */
  uninstallHooks(): void {
    // Restore original execute method
    if ((global as any).__n8n_original_workflow_execute) {
      Workflow.prototype.execute = (global as any).__n8n_original_workflow_execute;
      delete (global as any).__n8n_original_workflow_execute;
    }

    // Remove global reference
    delete (global as any).__n8n_workflow_monitor_hooks;
    this.activeExecutions.clear();
  }
}

/**
 * Helper function to get current execution hooks instance
 */
export function getExecutionHooks(): ExecutionHooks | undefined {
  return (global as any).__n8n_workflow_monitor_hooks;
}
