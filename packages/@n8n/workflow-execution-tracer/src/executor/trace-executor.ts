import type { Workflow, INodeExecutionData, WorkflowExecuteMode } from 'n8n-workflow';
import type { WorkflowTrace, TraceConfig, TraceExecutor } from '../types';
import { TraceCollector } from '../collectors/trace-collector';

/**
 * 轨迹执行器
 * 负责执行工作流并收集详细的执行轨迹数据
 */
export class TraceExecutorImpl implements TraceExecutor {
  private traceCollector: TraceCollector;
  private executionStatus: 'idle' | 'running' | 'completed' | 'error' = 'idle';
  private abortController: AbortController | null = null;

  /**
   * 构造函数
   * @param config 轨迹配置选项
   */
  constructor(config: Partial<TraceConfig> = {}) {
    this.traceCollector = new TraceCollector(config);
  }

  /**
   * 执行工作流并收集轨迹数据
   * @param workflow 工作流实例
   * @param inputData 输入数据
   * @returns 工作流执行轨迹数据
   */
  async executeWorkflow(workflow: Workflow, inputData: INodeExecutionData[]): Promise<WorkflowTrace> {
    if (this.executionStatus === 'running') {
      throw new Error('An execution is already in progress');
    }

    this.executionStatus = 'running';
    this.abortController = new AbortController();

    try {
      // 开始收集轨迹数据
      this.traceCollector.startCollection(workflow);

      // 执行工作流并收集轨迹数据
      const result = await this.executeWithTracing(workflow, inputData);

      // 结束收集轨迹数据
      const trace = this.traceCollector.endCollection();
      this.executionStatus = 'completed';

      return trace;
    } catch (error) {
      // 结束收集轨迹数据（带错误信息）
      this.traceCollector.endCollection(error instanceof Error ? error : undefined);
      this.executionStatus = 'error';
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * 执行工作流并收集轨迹数据
   * @param workflow 工作流实例
   * @param inputData 输入数据
   * @returns 执行结果
   */
  private async executeWithTracing(workflow: Workflow, inputData: INodeExecutionData[]): Promise<INodeExecutionData[]> {
    // 获取工作流中的所有节点
    const nodes = workflow.getNodes();

    // 模拟执行工作流，收集每个节点的轨迹数据
    // 注意：这里是一个简化的执行过程，实际执行应该使用n8n的工作流执行引擎
    let currentData = inputData;

    for (const node of nodes) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Execution aborted');
      }

      // 开始收集节点轨迹
      this.traceCollector.startNodeTrace(node, currentData);

      try {
        // 模拟节点执行（实际应该调用节点的execute方法）
        const startTime = Date.now();

        // 这里应该是实际的节点执行逻辑
        // 为了演示，我们模拟一个延迟
        await this.simulateNodeExecution(node);

        // 模拟输出数据
        const outputData = this.simulateOutputData(currentData, node);

        // 记录数据流动
        if (currentData.length > 0) {
          this.traceCollector.recordDataFlow(
            nodes[nodes.indexOf(node) - 1]?.id || 'input',
            node.id,
            currentData
          );
        }

        // 结束收集节点轨迹
        this.traceCollector.endNodeTrace(node.id, outputData);

        // 更新当前数据
        currentData = outputData;
      } catch (error) {
        // 结束收集节点轨迹（带错误信息）
        this.traceCollector.endNodeTrace(node.id, [], error instanceof Error ? error : undefined);
        throw error;
      }
    }

    return currentData;
  }

  /**
   * 模拟节点执行
   * @param node 节点实例
   */
  private async simulateNodeExecution(node: any): Promise<void> {
    // 根据节点类型模拟不同的执行时间
    const executionTimes: Record<string, number> = {
      'n8n-nodes-base.start': 10,
      'n8n-nodes-base.httpRequest': 500,
      'n8n-nodes-base.set': 50,
      'n8n-nodes-base.if': 20,
      'n8n-nodes-base.code': 200,
      'n8n-nodes-base.splitInBatches': 100,
      'n8n-nodes-base.aggregate': 300,
      'n8n-nodes-base.itemLists': 150,
      'n8n-nodes-base.function': 100,
    };

    const executionTime = executionTimes[node.type] || 100;
    await new Promise(resolve => setTimeout(resolve, executionTime));
  }

  /**
   * 模拟输出数据
   * @param inputData 输入数据
   * @param node 节点实例
   * @returns 模拟的输出数据
   */
  private simulateOutputData(inputData: INodeExecutionData[], node: any): INodeExecutionData[] {
    // 模拟输出数据，基于输入数据
    return inputData.map((item, index) => ({
      json: {
        ...item.json,
        [node.id]: {
          processed: true,
          timestamp: Date.now(),
          nodeType: node.type,
          index,
        },
      },
      pairedItem: item.pairedItem,
    }));
  }

  /**
   * 获取当前执行状态
   * @returns 执行状态
   */
  getExecutionStatus(): 'idle' | 'running' | 'completed' | 'error' {
    return this.executionStatus;
  }

  /**
   * 取消执行
   */
  cancelExecution(): void {
    if (this.executionStatus === 'running' && this.abortController) {
      this.abortController.abort();
      this.executionStatus = 'error';
    }
  }

  /**
   * 重置执行器状态
   */
  reset(): void {
    this.executionStatus = 'idle';
    this.abortController = null;
    this.traceCollector.reset();
  }

  /**
   * 销毁执行器实例
   */
  destroy(): void {
    this.reset();
    this.traceCollector.destroy();
  }
}

/**
 * 创建轨迹执行器实例的工厂函数
 * @param config 轨迹配置选项
 * @returns 轨迹执行器实例
 */
export function createTraceExecutor(config?: Partial<TraceConfig>): TraceExecutor {
  return new TraceExecutorImpl(config);
}