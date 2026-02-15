import type { Workflow, INodeExecutionData, INode, WorkflowExecuteMode } from 'n8n-workflow';
import type { WorkflowTrace, NodeTrace, DataFlow, TraceConfig } from '../types';
import { EventEmitter } from 'events';

/**
 * 工作流执行轨迹收集器
 * 负责在工作流执行过程中收集详细的轨迹数据，包括节点执行时间、数据流动等信息
 */
export class TraceCollector extends EventEmitter {
  private traceConfig: TraceConfig;
  private currentTrace: WorkflowTrace | null = null;
  private nodeTraces: Map<string, NodeTrace> = new Map();
  private dataFlows: DataFlow[] = [];
  private executionStartTime: number = 0;
  private executionEndTime: number = 0;

  /**
   * 构造函数
   * @param config 轨迹收集配置选项
   */
  constructor(config: Partial<TraceConfig> = {}) {
    super();

    this.traceConfig = {
      detailed: config.detailed ?? true,
      collectDataFlow: config.collectDataFlow ?? true,
      collectSubTraces: config.collectSubTraces ?? true,
      maxDepth: config.maxDepth ?? 10,
    };
  }

  /**
   * 开始收集工作流执行轨迹
   * @param workflow 工作流实例
   */
  startCollection(workflow: Workflow): void {
    this.executionStartTime = Date.now();
    this.currentTrace = {
      workflowId: workflow.id || 'unknown',
      workflowName: workflow.name || 'Unnamed Workflow',
      startTime: this.executionStartTime,
      endTime: 0,
      status: 'pending',
      totalDuration: 0,
      nodeTraces: [],
      dataFlows: [],
    };

    this.nodeTraces.clear();
    this.dataFlows = [];

    this.emit('trace-started', this.currentTrace);
  }

  /**
   * 开始收集节点执行轨迹
   * @param node 节点实例
   * @param inputData 输入数据
   */
  startNodeTrace(node: INode, inputData: INodeExecutionData[]): void {
    const nodeId = node.id;
    const startTime = Date.now();

    const nodeTrace: NodeTrace = {
      nodeId,
      nodeName: node.name || node.type,
      nodeType: node.type,
      startTime,
      endTime: 0,
      status: 'pending',
      duration: 0,
      inputDataSize: this.calculateDataSize(inputData),
      outputDataSize: 0,
    };

    this.nodeTraces.set(nodeId, nodeTrace);

    this.emit('node-trace-started', nodeTrace);
  }

  /**
   * 结束收集节点执行轨迹
   * @param nodeId 节点ID
   * @param outputData 输出数据
   * @param error 错误信息（如果有）
   */
  endNodeTrace(nodeId: string, outputData: INodeExecutionData[], error?: Error): void {
    const nodeTrace = this.nodeTraces.get(nodeId);
    if (!nodeTrace) return;

    const endTime = Date.now();
    nodeTrace.endTime = endTime;
    nodeTrace.duration = endTime - nodeTrace.startTime;
    nodeTrace.status = error ? 'error' : 'success';
    nodeTrace.outputDataSize = this.calculateDataSize(outputData);

    if (error) {
      nodeTrace.errorMessage = error.message;
    }

    this.emit('node-trace-ended', nodeTrace);
  }

  /**
   * 记录数据流动信息
   * @param sourceNodeId 源节点ID
   * @param targetNodeId 目标节点ID
   * @param data 传输的数据
   */
  recordDataFlow(sourceNodeId: string, targetNodeId: string, data: INodeExecutionData[]): void {
    if (!this.traceConfig.collectDataFlow) return;

    const dataFlow: DataFlow = {
      sourceNodeId,
      targetNodeId,
      dataSize: this.calculateDataSize(data),
      transferTime: Date.now(),
      dataType: this.determineDataType(data),
    };

    this.dataFlows.push(dataFlow);

    this.emit('data-flow-recorded', dataFlow);
  }

  /**
   * 结束收集工作流执行轨迹
   * @param error 错误信息（如果有）
   * @returns 工作流执行轨迹数据
   */
  endCollection(error?: Error): WorkflowTrace {
    this.executionEndTime = Date.now();

    if (!this.currentTrace) {
      throw new Error('Trace collection not started');
    }

    this.currentTrace.endTime = this.executionEndTime;
    this.currentTrace.totalDuration = this.executionEndTime - this.executionStartTime;
    this.currentTrace.status = error ? 'error' : 'success';
    this.currentTrace.nodeTraces = Array.from(this.nodeTraces.values());
    this.currentTrace.dataFlows = this.dataFlows;

    this.emit('trace-ended', this.currentTrace);

    return this.currentTrace;
  }

  /**
   * 获取当前执行轨迹数据
   * @returns 当前执行轨迹数据（如果正在收集）
   */
  getCurrentTrace(): WorkflowTrace | null {
    return this.currentTrace;
  }

  /**
   * 计算数据大小
   * @param data 数据对象
   * @returns 数据大小（估算值，单位：字节）
   */
  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * 确定数据类型
   * @param data 数据对象
   * @returns 数据类型描述
   */
  private determineDataType(data: any[]): string {
    if (!data || data.length === 0) {
      return 'empty';
    }

    const firstItem = data[0];
    if (firstItem.json) {
      return 'json';
    } else if (firstItem.binary) {
      return 'binary';
    } else if (firstItem.pairedItem) {
      return 'paired';
    } else {
      return 'unknown';
    }
  }

  /**
   * 分析轨迹数据，识别瓶颈和优化机会
   * @param trace 工作流执行轨迹数据
   * @returns 轨迹分析结果
   */
  analyzeTrace(trace: WorkflowTrace): {
    bottleneckNodes: string[];
    criticalPath: string[];
    dataFlowHotspots: DataFlow[];
  } {
    // 识别执行时间最长的节点（瓶颈节点）
    const bottleneckNodes = trace.nodeTraces
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3)
      .map(node => node.nodeId);

    // 识别数据流动量最大的路径（热点）
    const dataFlowHotspots = [...trace.dataFlows]
      .sort((a, b) => b.dataSize - a.dataSize)
      .slice(0, 3);

    // 简单的关键路径分析（基于执行时间）
    const criticalPath = trace.nodeTraces
      .sort((a, b) => b.duration - a.duration)
      .map(node => node.nodeId);

    return {
      bottleneckNodes,
      criticalPath,
      dataFlowHotspots,
    };
  }

  /**
   * 重置收集器状态
   */
  reset(): void {
    this.currentTrace = null;
    this.nodeTraces.clear();
    this.dataFlows = [];
    this.executionStartTime = 0;
    this.executionEndTime = 0;
  }

  /**
   * 销毁收集器实例
   */
  destroy(): void {
    this.reset();
    this.removeAllListeners();
  }
}

/**
 * 创建轨迹收集器实例的工厂函数
 * @param config 轨迹收集配置选项
 * @returns 轨迹收集器实例
 */
export function createTraceCollector(config?: Partial<TraceConfig>): TraceCollector {
  return new TraceCollector(config);
}