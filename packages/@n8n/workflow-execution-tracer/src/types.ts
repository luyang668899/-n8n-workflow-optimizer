import type { Workflow, INodeExecutionData } from 'n8n-workflow';

/**
 * 节点执行轨迹数据
 */
export interface NodeTrace {
  /** 节点ID */
  nodeId: string;
  /** 节点名称 */
  nodeName: string;
  /** 节点类型 */
  nodeType: string;
  /** 开始执行时间戳（毫秒） */
  startTime: number;
  /** 结束执行时间戳（毫秒） */
  endTime: number;
  /** 执行状态 */
  status: 'success' | 'error' | 'pending';
  /** 执行时间（毫秒） */
  duration: number;
  /** 输入数据量 */
  inputDataSize: number;
  /** 输出数据量 */
  outputDataSize: number;
  /** 错误信息（如果有） */
  errorMessage?: string;
  /** 子节点轨迹（如果有） */
  subTraces?: NodeTrace[];
}

/**
 * 工作流执行轨迹
 */
export interface WorkflowTrace {
  /** 工作流ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 开始执行时间戳（毫秒） */
  startTime: number;
  /** 结束执行时间戳（毫秒） */
  endTime: number;
  /** 执行状态 */
  status: 'success' | 'error' | 'pending';
  /** 总执行时间（毫秒） */
  totalDuration: number;
  /** 节点执行轨迹列表 */
  nodeTraces: NodeTrace[];
  /** 数据流动路径 */
  dataFlows: DataFlow[];
}

/**
 * 数据流动信息
 */
export interface DataFlow {
  /** 源节点ID */
  sourceNodeId: string;
  /** 目标节点ID */
  targetNodeId: string;
  /** 数据量 */
  dataSize: number;
  /** 数据传输时间（毫秒） */
  transferTime: number;
  /** 数据类型 */
  dataType: string;
}

/**
 * 执行轨迹配置选项
 */
export interface TraceConfig {
  /** 是否收集详细数据 */
  detailed: boolean;
  /** 是否收集数据流动信息 */
  collectDataFlow: boolean;
  /** 是否收集子节点轨迹 */
  collectSubTraces: boolean;
  /** 最大轨迹深度 */
  maxDepth: number;
}

/**
 * 轨迹可视化配置选项
 */
export interface TraceVisualizationConfig {
  /** 容器元素选择器或DOM元素 */
  container: string | HTMLElement;
  /** 图表宽度 */
  width?: number;
  /** 图表高度 */
  height?: number;
  /** 是否显示时间轴 */
  showTimeline: boolean;
  /** 是否显示数据流动 */
  showDataFlow: boolean;
  /** 是否启用缩放功能 */
  enableZoom: boolean;
  /** 是否启用悬停详情 */
  enableTooltip: boolean;
  /** 颜色方案 */
  colorScheme?: {
    success: string;
    error: string;
    pending: string;
    dataFlow: string;
  };
}

/**
 * 轨迹分析结果
 */
export interface TraceAnalysis {
  /** 执行瓶颈节点 */
  bottleneckNodes: string[];
  /** 最长执行路径 */
  criticalPath: string[];
  /** 数据流动热点 */
  dataFlowHotspots: DataFlow[];
  /** 建议优化点 */
  optimizationSuggestions: string[];
}

/**
 * 轨迹执行器接口
 */
export interface TraceExecutor {
  /** 执行工作流并收集轨迹数据 */
  executeWorkflow(workflow: Workflow, inputData: INodeExecutionData[]): Promise<WorkflowTrace>;
  /** 获取当前执行状态 */
  getExecutionStatus(): 'idle' | 'running' | 'completed' | 'error';
  /** 取消执行 */
  cancelExecution(): void;
}

/**
 * 轨迹可视化接口
 */
export interface TraceVisualizer {
  /** 渲染轨迹可视化 */
  render(trace: WorkflowTrace): void;
  /** 更新轨迹数据 */
  update(trace: WorkflowTrace): void;
  /** 销毁可视化实例 */
  destroy(): void;
  /** 缩放操作 */
  zoom(factor: number, center?: { x: number; y: number }): void;
  /** 平移操作 */
  pan(deltaX: number, deltaY: number): void;
  /** 过滤节点 */
  filterNodes(nodeIds: string[]): void;
  /** 重置视图 */
  resetView(): void;
}