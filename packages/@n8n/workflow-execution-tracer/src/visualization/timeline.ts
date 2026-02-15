import * as d3 from 'd3';
import type { WorkflowTrace, NodeTrace, TraceVisualizationConfig } from '../types';

/**
 * 时间轴可视化组件
 * 展示工作流执行的时间线，包括节点执行顺序、执行时长和状态
 */
export class TimelineVisualizer {
  private config: TraceVisualizationConfig;
  private container: HTMLElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width: number;
  private height: number;
  private margin = {
    top: 20,
    right: 20,
    bottom: 60,
    left: 120,
  };
  private innerWidth: number;
  private innerHeight: number;
  private xScale: d3.ScaleLinear<number, number>;
  private yScale: d3.ScaleBand<string>;
  private xAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  private yAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
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
      height: config.height || 400,
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

    // 创建X轴
    this.xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.innerHeight})`);

    // 创建Y轴
    this.yAxis = g.append('g')
      .attr('class', 'y-axis');

    // 创建提示框
    if (this.config.enableTooltip) {
      this.tooltip = d3.select(this.container)
        .append('div')
        .attr('class', 'timeline-tooltip')
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
   * 渲染时间轴可视化
   * @param trace 工作流执行轨迹数据
   */
  render(trace: WorkflowTrace): void {
    this.trace = trace;
    this.update(trace);
  }

  /**
   * 更新时间轴可视化
   * @param trace 工作流执行轨迹数据
   */
  update(trace: WorkflowTrace): void {
    this.trace = trace;

    if (!trace.nodeTraces || trace.nodeTraces.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.updateScales(trace);
    this.updateAxes();
    this.renderNodeBars(trace);
    this.renderTimelineMarkers(trace);
  }

  /**
   * 更新比例尺
   * @param trace 工作流执行轨迹数据
   */
  private updateScales(trace: WorkflowTrace): void {
    const nodeIds = trace.nodeTraces.map(node => node.nodeId);
    const startTime = Math.min(...trace.nodeTraces.map(node => node.startTime));
    const endTime = Math.max(...trace.nodeTraces.map(node => node.endTime || Date.now()));

    this.xScale = d3.scaleLinear()
      .domain([startTime, endTime])
      .range([0, this.innerWidth]);

    this.yScale = d3.scaleBand<string>()
      .domain(nodeIds)
      .range([0, this.innerHeight])
      .padding(0.2);
  }

  /**
   * 更新坐标轴
   */
  private updateAxes(): void {
    // 更新X轴（时间轴）
    this.xAxis.call(d3.axisBottom(this.xScale)
      .tickFormat(d => new Date(d).toLocaleTimeString())
      .ticks(8));

    // 更新Y轴（节点名称）
    this.yAxis.call(d3.axisLeft(this.yScale)
      .tickFormat((d) => {
        const node = this.trace?.nodeTraces.find(n => n.nodeId === d);
        return node ? `${node.nodeName} (${node.nodeType})` : d;
      }));

    // 旋转X轴标签以避免重叠
    this.xAxis.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-0.8em')
      .attr('dy', '0.15em')
      .attr('transform', 'rotate(-45)');
  }

  /**
   * 渲染节点执行条
   * @param trace 工作流执行轨迹数据
   */
  private renderNodeBars(trace: WorkflowTrace): void {
    const g = this.svg.select('g');
    const nodeBars = g.selectAll('.node-bar')
      .data(trace.nodeTraces, (d: NodeTrace) => d.nodeId);

    // 移除旧元素
    nodeBars.exit().remove();

    // 添加新元素
    const newNodeBars = nodeBars.enter()
      .append('rect')
      .attr('class', 'node-bar')
      .attr('x', (d: NodeTrace) => this.xScale(d.startTime))
      .attr('y', (d: NodeTrace) => this.yScale(d.nodeId) || 0)
      .attr('width', (d: NodeTrace) => {
        if (!d.endTime) return 20; // 对于未完成的节点，显示一个小条
        return Math.max(1, this.xScale(d.endTime) - this.xScale(d.startTime));
      })
      .attr('height', this.yScale.bandwidth())
      .attr('fill', (d: NodeTrace) => this.getNodeColor(d))
      .attr('rx', 2)
      .attr('ry', 2);

    // 更新现有元素
    nodeBars.merge(newNodeBars as any)
      .attr('x', (d: NodeTrace) => this.xScale(d.startTime))
      .attr('y', (d: NodeTrace) => this.yScale(d.nodeId) || 0)
      .attr('width', (d: NodeTrace) => {
        if (!d.endTime) return 20;
        return Math.max(1, this.xScale(d.endTime) - this.xScale(d.startTime));
      })
      .attr('height', this.yScale.bandwidth())
      .attr('fill', (d: NodeTrace) => this.getNodeColor(d));

    // 添加悬停事件
    if (this.config.enableTooltip) {
      newNodeBars.on('mouseover', (event, d: NodeTrace) => {
        this.showTooltip(event, d);
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
   * 渲染时间线标记
   * @param trace 工作流执行轨迹数据
   */
  private renderTimelineMarkers(trace: WorkflowTrace): void {
    const g = this.svg.select('g');

    // 清除旧标记
    g.selectAll('.timeline-marker').remove();

    // 添加工作流开始标记
    g.append('line')
      .attr('class', 'timeline-marker')
      .attr('x1', this.xScale(trace.startTime))
      .attr('y1', 0)
      .attr('x2', this.xScale(trace.startTime))
      .attr('y2', this.innerHeight)
      .attr('stroke', '#999')
      .attr('stroke-dasharray', '4')
      .attr('stroke-width', 1);

    // 添加工作流结束标记（如果已完成）
    if (trace.status !== 'pending') {
      g.append('line')
        .attr('class', 'timeline-marker')
        .attr('x1', this.xScale(trace.endTime))
        .attr('y1', 0)
        .attr('x2', this.xScale(trace.endTime))
        .attr('y2', this.innerHeight)
        .attr('stroke', '#999')
        .attr('stroke-dasharray', '4')
        .attr('stroke-width', 1);
    }
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
   * @param node 节点轨迹数据
   * @returns 颜色值
   */
  private getNodeColor(node: NodeTrace): string {
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
   * 显示提示框
   * @param event 鼠标事件
   * @param node 节点轨迹数据
   */
  private showTooltip(event: MouseEvent, node: NodeTrace): void {
    if (!this.tooltip) return;

    const duration = node.duration || (Date.now() - node.startTime);
    const endTime = node.endTime || Date.now();

    const tooltipContent = `
      <strong>${node.nodeName}</strong> (${node.nodeType})<br>
      <span>Status: ${node.status}</span><br>
      <span>Start: ${new Date(node.startTime).toLocaleString()}</span><br>
      <span>End: ${new Date(endTime).toLocaleString()}</span><br>
      <span>Duration: ${duration.toFixed(2)}ms</span><br>
      <span>Input Size: ${(node.inputDataSize / 1024).toFixed(2)}KB</span><br>
      <span>Output Size: ${(node.outputDataSize / 1024).toFixed(2)}KB</span>
      ${node.errorMessage ? `<br><span style="color: #F44336;">Error: ${node.errorMessage}</span>` : ''}
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
    this.svg.remove();
    if (this.tooltip) {
      this.tooltip.remove();
    }
  }
}

/**
 * 创建时间轴可视化实例的工厂函数
 * @param config 可视化配置选项
 * @returns 时间轴可视化实例
 */
export function createTimelineVisualizer(config: TraceVisualizationConfig): TimelineVisualizer {
  return new TimelineVisualizer(config);
}