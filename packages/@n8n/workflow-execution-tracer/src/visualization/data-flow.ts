import * as d3 from 'd3';
import type { WorkflowTrace, DataFlow, TraceVisualizationConfig } from '../types';

/**
 * 节点数据类型
 */
export interface NodeData {
  id: string;
  name: string;
  type: string;
  status: 'success' | 'error' | 'pending';
  duration: number;
  inputDataSize: number;
  outputDataSize: number;
}

/**
 * 连接数据类型
 */
export interface LinkData {
  source: string;
  target: string;
  dataSize: number;
  transferTime: number;
  dataType: string;
}

/**
 * 数据流动可视化组件
 * 展示工作流执行过程中数据在节点间的流动路径和数据量变化
 */
export class DataFlowVisualizer {
  private config: TraceVisualizationConfig;
  private container: HTMLElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width: number;
  private height: number;
  private margin = {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  };
  private innerWidth: number;
  private innerHeight: number;
  private simulation: d3.Simulation<NodeData, LinkData>;
  private nodes: d3.Selection<SVGGElement, NodeData, null, undefined>;
  private links: d3.Selection<SVGPathElement, LinkData, null, undefined>;
  private tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private trace: WorkflowTrace | null = null;

  /**
   * 构造函数
   * @param config 可视化配置选项
   */
  constructor(config: TraceVisualizationConfig) {
    this.config = {
      ...config,
      width: config.width || 800,
      height: config.height || 600,
      colorScheme: {
        success: '#4CAF50',
        error: '#F44336',
        pending: '#FFC107',
        dataFlow: '#2196F3',
        ...config.colorScheme,
      },
    };

    this.container = typeof config.container === 'string'
      ? document.querySelector(config.container) as HTMLElement
      : config.container;

    if (!this.container) {
      throw new Error('Container element not found');
    }

    this.width = this.config.width!;
    this.height = this.config.height!;
    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;

    this.initialize();
  }

  /**
   * 初始化可视化组件
   */
  private initialize(): void {
    // 清除容器内容
    this.container.innerHTML = '';

    // 创建SVG元素
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .call(this.config.enableZoom ? this.initializeZoom() : (d) => d);

    // 创建主绘图区域
    const g = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // 创建连接层
    g.append('g').attr('class', 'links');

    // 创建节点层
    g.append('g').attr('class', 'nodes');

    // 创建提示框
    if (this.config.enableTooltip) {
      this.tooltip = d3.select(this.container)
        .append('div')
        .attr('class', 'data-flow-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('pointer-events', 'none')
        .style('opacity', '0')
        .style('z-index', '10')
        .style('font-size', '12px');
    }
  }

  /**
   * 初始化缩放行为
   */
  private initializeZoom(): (selection: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void {
    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const g = this.svg.select('g');
        g.attr('transform', event.transform);
      });

    return (selection) => selection.call(this.zoom as any);
  }

  /**
   * 渲染数据流动可视化
   * @param trace 工作流执行轨迹数据
   */
  render(trace: WorkflowTrace): void {
    this.trace = trace;
    this.update(trace);
  }

  /**
   * 更新数据流动可视化
   * @param trace 工作流执行轨迹数据
   */
  update(trace: WorkflowTrace): void {
    this.trace = trace;

    if (!trace.nodeTraces || trace.nodeTraces.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.updateSimulation(trace);
    this.renderLinks(trace);
    this.renderNodes(trace);
  }

  /**
   * 更新力导向模拟
   * @param trace 工作流执行轨迹数据
   */
  private updateSimulation(trace: WorkflowTrace): void {
    // 转换节点数据
    const nodeData: NodeData[] = trace.nodeTraces.map(node => ({
      id: node.nodeId,
      name: node.nodeName,
      type: node.nodeType,
      status: node.status,
      duration: node.duration,
      inputDataSize: node.inputDataSize,
      outputDataSize: node.outputDataSize,
    }));

    // 转换连接数据
    const linkData: LinkData[] = trace.dataFlows.map(flow => ({
      source: flow.sourceNodeId,
      target: flow.targetNodeId,
      dataSize: flow.dataSize,
      transferTime: flow.transferTime,
      dataType: flow.dataType,
    }));

    // 创建力导向模拟
    this.simulation = d3.forceSimulation<NodeData, LinkData>(nodeData)
      .force('link', d3.forceLink<NodeData, LinkData>(linkData)
        .id((d) => d.id)
        .distance((d) => Math.sqrt(d.dataSize) * 5 + 50))
      .force('charge', d3.forceManyBody<NodeData>().strength(-300))
      .force('center', d3.forceCenter<NodeData>(this.innerWidth / 2, this.innerHeight / 2))
      .force('collision', d3.forceCollide<NodeData>().radius(40));

    // 更新模拟数据
    this.simulation.nodes(nodeData)
      .on('tick', () => this.tick());

    if (linkData.length > 0) {
      this.simulation.force('link')?.links(linkData);
    }
  }

  /**
   * 模拟tick事件处理函数
   */
  private tick(): void {
    // 更新连接路径
    this.links.attr('d', (d) => {
      const sourceX = (d.source as any).x || 0;
      const sourceY = (d.source as any).y || 0;
      const targetX = (d.target as any).x || 0;
      const targetY = (d.target as any).y || 0;

      return this.generateLinkPath(sourceX, sourceY, targetX, targetY);
    });

    // 更新节点位置
    this.nodes.attr('transform', (d) => {
      return `translate(${(d as any).x || 0}, ${(d as any).y || 0})`;
    });
  }

  /**
   * 生成连接路径
   * @param sourceX 源节点X坐标
   * @param sourceY 源节点Y坐标
   * @param targetX 目标节点X坐标
   * @param targetY 目标节点Y坐标
   * @returns SVG路径字符串
   */
  private generateLinkPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const dr = Math.sqrt(dx * dx + dy * dy) / 3;

    return `M ${sourceX} ${sourceY} C ${sourceX + dx / 2} ${sourceY + dy / 2 - dr}, ${sourceX + dx / 2} ${sourceY + dy / 2 - dr}, ${targetX} ${targetY}`;
  }

  /**
   * 渲染连接
   * @param trace 工作流执行轨迹数据
   */
  private renderLinks(trace: WorkflowTrace): void {
    const linkData: LinkData[] = trace.dataFlows.map(flow => ({
      source: flow.sourceNodeId,
      target: flow.targetNodeId,
      dataSize: flow.dataSize,
      transferTime: flow.transferTime,
      dataType: flow.dataType,
    }));

    const g = this.svg.select('g');
    const linkGroup = g.select('.links');

    this.links = linkGroup.selectAll('path')
      .data(linkData, (d) => `${d.source}-${d.target}`);

    // 移除旧连接
    this.links.exit().remove();

    // 添加新连接
    const newLinks = this.links.enter()
      .append('path')
      .attr('class', 'link')
      .attr('stroke', (d) => this.getLinkColor(d))
      .attr('stroke-width', (d) => Math.max(1, Math.log(d.dataSize + 1) / 2))
      .attr('fill', 'none')
      .attr('marker-end', (d) => `url(#arrowhead-${d.dataType})`);

    // 更新现有连接
    this.links = this.links.merge(newLinks as any)
      .attr('stroke', (d) => this.getLinkColor(d))
      .attr('stroke-width', (d) => Math.max(1, Math.log(d.dataSize + 1) / 2));

    // 添加箭头标记
    this.addArrowMarkers();

    // 添加悬停事件
    if (this.config.enableTooltip) {
      newLinks.on('mouseover', (event, d) => {
        this.showLinkTooltip(event, d);
      })
      .on('mousemove', (event) => {
        this.tooltip.style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseout', () => {
        this.hideTooltip();
      });
    }
  }

  /**
   * 渲染节点
   * @param trace 工作流执行轨迹数据
   */
  private renderNodes(trace: WorkflowTrace): void {
    const nodeData: NodeData[] = trace.nodeTraces.map(node => ({
      id: node.nodeId,
      name: node.nodeName,
      type: node.nodeType,
      status: node.status,
      duration: node.duration,
      inputDataSize: node.inputDataSize,
      outputDataSize: node.outputDataSize,
    }));

    const g = this.svg.select('g');
    const nodeGroup = g.select('.nodes');

    this.nodes = nodeGroup.selectAll('g')
      .data(nodeData, (d) => d.id);

    // 移除旧节点
    this.nodes.exit().remove();

    // 添加新节点
    const newNodes = this.nodes.enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, NodeData>()
        .on('start', (event) => this.dragstarted(event))
        .on('drag', (event) => this.dragged(event))
        .on('end', (event) => this.dragended(event))
      );

    // 添加节点圆形
    newNodes.append('circle')
      .attr('r', (d) => Math.max(10, Math.log(d.duration + 1) * 2))
      .attr('fill', (d) => this.getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // 添加节点文本
    newNodes.append('text')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .text((d) => d.name.substring(0, 8));

    // 更新现有节点
    this.nodes = this.nodes.merge(newNodes as any);

    // 更新节点圆形
    this.nodes.select('circle')
      .attr('r', (d) => Math.max(10, Math.log(d.duration + 1) * 2))
      .attr('fill', (d) => this.getNodeColor(d));

    // 更新节点文本
    this.nodes.select('text')
      .text((d) => d.name.substring(0, 8));

    // 添加悬停事件
    if (this.config.enableTooltip) {
      newNodes.on('mouseover', (event, d) => {
        this.showNodeTooltip(event, d);
      })
      .on('mousemove', (event) => {
        this.tooltip.style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseout', () => {
        this.hideTooltip();
      });
    }
  }

  /**
   * 添加箭头标记
   */
  private addArrowMarkers(): void {
    const defs = this.svg.select('defs');
    if (defs.empty()) {
      defs = this.svg.append('defs');
    }

    // 创建箭头标记
    defs.selectAll('marker')
      .data(['json', 'binary', 'paired', 'unknown'])
      .enter()
      .append('marker')
      .attr('id', (d) => `arrowhead-${d}`)
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', (d) => this.getDataTypeColor(d))
      .style('stroke', 'none');
  }

  /**
   * 渲染空状态
   */
  private renderEmptyState(): void {
    const g = this.svg.select('g');

    g.selectAll('*').remove();

    g.append('text')
      .attr('x', this.innerWidth / 2)
      .attr('y', this.innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#999')
      .text('No execution trace data available');
  }

  /**
   * 获取节点颜色
   * @param node 节点数据
   * @returns 颜色值
   */
  private getNodeColor(node: NodeData): string {
    const colorScheme = this.config.colorScheme || {};

    switch (node.status) {
      case 'success':
        return colorScheme.success || '#4CAF50';
      case 'error':
        return colorScheme.error || '#F44336';
      case 'pending':
        return colorScheme.pending || '#FFC107';
      default:
        return '#999';
    }
  }

  /**
   * 获取连接颜色
   * @param link 连接数据
   * @returns 颜色值
   */
  private getLinkColor(link: LinkData): string {
    const colorScheme = this.config.colorScheme || {};
    return colorScheme.dataFlow || '#2196F3';
  }

  /**
   * 获取数据类型颜色
   * @param dataType 数据类型
   * @returns 颜色值
   */
  private getDataTypeColor(dataType: string): string {
    const colorMap = {
      json: '#4CAF50',
      binary: '#FF9800',
      paired: '#9C27B0',
      unknown: '#999',
    };

    return colorMap[dataType as keyof typeof colorMap] || '#999';
  }

  /**
   * 显示节点提示框
   * @param event 鼠标事件
   * @param node 节点数据
   */
  private showNodeTooltip(event: MouseEvent, node: NodeData): void {
    if (!this.tooltip) return;

    const tooltipContent = `
      <strong>${node.name}</strong> (${node.type})<br>
      <span>Status: ${node.status}</span><br>
      <span>Duration: ${node.duration.toFixed(2)}ms</span><br>
      <span>Input Size: ${(node.inputDataSize / 1024).toFixed(2)}KB</span><br>
      <span>Output Size: ${(node.outputDataSize / 1024).toFixed(2)}KB</span>
    `;

    this.tooltip.html(tooltipContent)
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 10}px`)
      .style('opacity', '1');
  }

  /**
   * 显示连接提示框
   * @param event 鼠标事件
   * @param link 连接数据
   */
  private showLinkTooltip(event: MouseEvent, link: LinkData): void {
    if (!this.tooltip) return;

    const sourceNode = this.trace?.nodeTraces.find(n => n.nodeId === link.source);
    const targetNode = this.trace?.nodeTraces.find(n => n.nodeId === link.target);

    const tooltipContent = `
      <strong>Data Flow</strong><br>
      <span>From: ${sourceNode?.nodeName || link.source}</span><br>
      <span>To: ${targetNode?.nodeName || link.target}</span><br>
      <span>Data Size: ${(link.dataSize / 1024).toFixed(2)}KB</span><br>
      <span>Data Type: ${link.dataType}</span><br>
      <span>Transfer Time: ${new Date(link.transferTime).toLocaleTimeString()}</span>
    `;

    this.tooltip.html(tooltipContent)
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 10}px`)
      .style('opacity', '1');
  }

  /**
   * 隐藏提示框
   */
  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.style('opacity', '0');
    }
  }

  /**
   * 拖拽开始事件处理
   * @param event 拖拽事件
   */
  private dragstarted(event: any): void {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  /**
   * 拖拽中事件处理
   * @param event 拖拽事件
   */
  private dragged(event: any): void {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  /**
   * 拖拽结束事件处理
   * @param event 拖拽事件
   */
  private dragended(event: any): void {
    if (!event.active) this.simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  /**
   * 缩放操作
   * @param factor 缩放因子
   * @param center 缩放中心点
   */
  zoom(factor: number, center?: { x: number; y: number }): void {
    if (!this.zoom) return;

    const transform = d3.zoomTransform(this.svg.node() as SVGSVGElement);
    const newTransform = transform.scale(factor, center);

    this.svg.transition().duration(200).call(
      this.zoom.transform as any, newTransform
    );
  }

  /**
   * 平移操作
   * @param deltaX X方向平移量
   * @param deltaY Y方向平移量
   */
  pan(deltaX: number, deltaY: number): void {
    if (!this.zoom) return;

    const transform = d3.zoomTransform(this.svg.node() as SVGSVGElement);
    const newTransform = transform.translate(deltaX, deltaY);

    this.svg.transition().duration(200).call(
      this.zoom.transform as any, newTransform
    );
  }

  /**
   * 过滤节点
   * @param nodeIds 要显示的节点ID列表
   */
  filterNodes(nodeIds: string[]): void {
    if (!this.trace) return;

    const filteredTrace = {
      ...this.trace,
      nodeTraces: this.trace.nodeTraces.filter(node => nodeIds.includes(node.nodeId)),
      dataFlows: this.trace.dataFlows.filter(flow =>
        nodeIds.includes(flow.sourceNodeId) && nodeIds.includes(flow.targetNodeId)
      ),
    };

    this.update(filteredTrace);
  }

  /**
   * 重置视图
   */
  resetView(): void {
    if (!this.zoom) return;

    this.svg.transition().duration(200).call(
      this.zoom.transform as any, d3.zoomIdentity
    );
  }

  /**
   * 销毁可视化实例
   */
  destroy(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
    this.svg.remove();
    if (this.tooltip) {
      this.tooltip.remove();
    }
  }
}

/**
 * 创建数据流动可视化实例的工厂函数
 * @param config 可视化配置选项
 * @returns 数据流动可视化实例
 */
export function createDataFlowVisualizer(config: TraceVisualizationConfig): DataFlowVisualizer {
  return new DataFlowVisualizer(config);
}