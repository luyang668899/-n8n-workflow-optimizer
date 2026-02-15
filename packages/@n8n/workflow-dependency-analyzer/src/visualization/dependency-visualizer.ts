import fs from 'fs';
import path from 'path';
import * as d3 from 'd3';
import type { DependencyGraph, BottleneckAnalysis } from '../types';

/**
 * 依赖可视化器
 * 负责生成依赖图的可视化展示
 */
export class DependencyVisualizer {
  /**
   * 生成依赖图可视化
   * @param graph 依赖图
   * @param bottleneckAnalysis 瓶颈分析
   * @param outputPath 输出路径
   */
  async generate(graph: DependencyGraph, bottleneckAnalysis: BottleneckAnalysis, outputPath: string): Promise<void> {
    // 确保输出目录存在
    this.ensureOutputDirectoryExists(outputPath);

    // 生成 SVG 可视化
    await this.generateSvgVisualization(graph, bottleneckAnalysis, outputPath);

    // 生成 JSON 数据
    this.generateJsonData(graph, bottleneckAnalysis, outputPath);

    console.log(`Dependency visualizations generated successfully in ${outputPath}`);
  }

  /**
   * 确保输出目录存在
   * @param outputPath 输出路径
   */
  private ensureOutputDirectoryExists(outputPath: string): void {
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
  }

  /**
   * 生成 SVG 可视化
   * @param graph 依赖图
   * @param bottleneckAnalysis 瓶颈分析
   * @param outputPath 输出路径
   */
  private async generateSvgVisualization(graph: DependencyGraph, bottleneckAnalysis: BottleneckAnalysis, outputPath: string): Promise<void> {
    const width = 1200;
    const height = 800;

    // 创建 SVG 元素
    const svg = d3.select('body')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // 创建力导向图
    const simulation = d3.forceSimulation(graph.nodes)
      .force('link', d3.forceLink(graph.edges).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // 创建箭头标记
    svg.append('defs').selectAll('marker')
      .data(['end'])
      .enter().append('marker')
      .attr('id', d => d)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#999')
      .attr('d', 'M0,-5L10,0L0,5');

    // 创建连接线
    const link = svg.append('g')
      .selectAll('line')
      .data(graph.edges)
      .enter().append('line')
      .attr('stroke', d => this.getEdgeColor(d.dependencyType))
      .attr('stroke-width', d => this.getEdgeThickness(d.dependencyStrength))
      .attr('marker-end', 'url(#end)')
      .attr('class', 'link');

    // 创建节点
    const node = svg.append('g')
      .selectAll('g')
      .data(graph.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // 添加节点圆圈
    node.append('circle')
      .attr('r', d => this.getNodeSize(d))
      .attr('fill', d => this.getNodeColor(d, bottleneckAnalysis))
      .attr('stroke', d => this.getNodeStroke(d, bottleneckAnalysis))
      .attr('stroke-width', d => this.getNodeStrokeWidth(d, bottleneckAnalysis));

    // 添加节点标签
    node.append('text')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#333')
      .attr('font-size', '12px')
      .attr('font-weight', d => this.getNodeFontWeight(d, bottleneckAnalysis))
      .text(d => this.getNodeLabel(d));

    // 添加节点工具提示
    node.append('title')
      .text(d => this.getNodeTooltip(d, bottleneckAnalysis));

    // 更新力导向图
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // 拖拽函数
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // 保存 SVG 到文件
    const svgContent = svg.node()?.outerHTML || '';
    const svgPath = path.join(outputPath, 'dependency-graph.svg');
    fs.writeFileSync(svgPath, svgContent);

    // 清理临时 DOM 元素
    d3.select('body').select('svg').remove();

    console.log(`Generated SVG visualization: ${svgPath}`);
  }

  /**
   * 生成 JSON 数据
   * @param graph 依赖图
   * @param bottleneckAnalysis 瓶颈分析
   * @param outputPath 输出路径
   */
  private generateJsonData(graph: DependencyGraph, bottleneckAnalysis: BottleneckAnalysis, outputPath: string): void {
    const jsonData = {
      graph,
      bottleneckAnalysis,
      metadata: {
        generatedAt: new Date().toISOString(),
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        bottleneckCount: bottleneckAnalysis.bottleneckWorkflows.length,
      },
    };

    const jsonPath = path.join(outputPath, 'dependency-graph.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

    console.log(`Generated JSON data: ${jsonPath}`);
  }

  /**
   * 获取节点大小
   * @param node 工作流节点
   * @returns 节点大小
   */
  private getNodeSize(node: any): number {
    // 基于入度和出度计算节点大小
    const dependencyCount = node.inDegree + node.outDegree;
    return Math.max(15, Math.min(30, 15 + dependencyCount * 2));
  }

  /**
   * 获取节点颜色
   * @param node 工作流节点
   * @param bottleneckAnalysis 瓶颈分析
   * @returns 节点颜色
   */
  private getNodeColor(node: any, bottleneckAnalysis: BottleneckAnalysis): string {
    // 检查是否为瓶颈工作流
    const isBottleneck = bottleneckAnalysis.bottleneckWorkflows.some(
      wf => wf.workflowId === node.id
    );

    if (isBottleneck) {
      return '#ff6b6b'; // 红色
    }

    // 基于瓶颈分数计算颜色
    if (node.bottleneckScore > 1) {
      return '#ffd93d'; // 黄色
    }

    // 基于依赖数量计算颜色
    const dependencyCount = node.inDegree + node.outDegree;
    if (dependencyCount > 5) {
      return '#6bcb77'; // 绿色
    }

    return '#4d96ff'; // 蓝色
  }

  /**
   * 获取节点边框颜色
   * @param node 工作流节点
   * @param bottleneckAnalysis 瓶颈分析
   * @returns 节点边框颜色
   */
  private getNodeStroke(node: any, bottleneckAnalysis: BottleneckAnalysis): string {
    // 检查是否为瓶颈工作流
    const isBottleneck = bottleneckAnalysis.bottleneckWorkflows.some(
      wf => wf.workflowId === node.id
    );

    if (isBottleneck) {
      return '#c44569'; // 深红色
    }

    return '#333'; // 黑色
  }

  /**
   * 获取节点边框宽度
   * @param node 工作流节点
   * @param bottleneckAnalysis 瓶颈分析
   * @returns 节点边框宽度
   */
  private getNodeStrokeWidth(node: any, bottleneckAnalysis: BottleneckAnalysis): number {
    // 检查是否为瓶颈工作流
    const isBottleneck = bottleneckAnalysis.bottleneckWorkflows.some(
      wf => wf.workflowId === node.id
    );

    if (isBottleneck) {
      return 3; // 粗边框
    }

    return 1; // 细边框
  }

  /**
   * 获取节点字体权重
   * @param node 工作流节点
   * @param bottleneckAnalysis 瓶颈分析
   * @returns 字体权重
   */
  private getNodeFontWeight(node: any, bottleneckAnalysis: BottleneckAnalysis): string {
    // 检查是否为瓶颈工作流
    const isBottleneck = bottleneckAnalysis.bottleneckWorkflows.some(
      wf => wf.workflowId === node.id
    );

    if (isBottleneck) {
      return 'bold'; // 粗体
    }

    return 'normal'; // 正常
  }

  /**
   * 获取节点标签
   * @param node 工作流节点
   * @returns 节点标签
   */
  private getNodeLabel(node: any): string {
    // 截断长名称
    const maxLength = 15;
    return node.name.length > maxLength ? `${node.name.substring(0, maxLength)}...` : node.name;
  }

  /**
   * 获取节点工具提示
   * @param node 工作流节点
   * @param bottleneckAnalysis 瓶颈分析
   * @returns 工具提示内容
   */
  private getNodeTooltip(node: any, bottleneckAnalysis: BottleneckAnalysis): string {
    // 检查是否为瓶颈工作流
    const bottleneckInfo = bottleneckAnalysis.bottleneckWorkflows.find(
      wf => wf.workflowId === node.id
    );

    let tooltip = `Workflow: ${node.name}\n`;
    tooltip += `ID: ${node.id}\n`;
    tooltip += `Dependencies: ${node.inDegree} incoming, ${node.outDegree} outgoing\n`;
    tooltip += `Average Execution Time: ${node.averageExecutionTime}ms\n`;
    tooltip += `Failure Rate: ${(node.failureRate * 100).toFixed(1)}%\n`;
    tooltip += `Bottleneck Score: ${node.bottleneckScore.toFixed(2)}\n`;

    if (bottleneckInfo) {
      tooltip += `\nBOTTLENECK: ${bottleneckInfo.primaryBottleneckReason}\n`;
      tooltip += `Suggestion: ${bottleneckInfo.suggestedSolution}\n`;
    }

    return tooltip;
  }

  /**
   * 获取边颜色
   * @param dependencyType 依赖类型
   * @returns 边颜色
   */
  private getEdgeColor(dependencyType: string): string {
    switch (dependencyType) {
      case 'trigger':
        return '#ff6b6b'; // 红色
      case 'data':
        return '#4ecdc4'; // 青色
      case 'resource':
        return '#45b7d1'; // 蓝色
      case 'time':
        return '#96ceb4'; // 绿色
      default:
        return '#999'; // 灰色
    }
  }

  /**
   * 获取边粗细
   * @param dependencyStrength 依赖强度
   * @returns 边粗细
   */
  private getEdgeThickness(dependencyStrength: number): number {
    return Math.max(1, Math.min(5, dependencyStrength * 5));
  }

  /**
   * 生成瓶颈分析可视化
   * @param bottleneckAnalysis 瓶颈分析
   * @param outputPath 输出路径
   */
  private generateBottleneckVisualization(bottleneckAnalysis: BottleneckAnalysis, outputPath: string): void {
    const width = 800;
    const height = 600;

    // 创建 SVG 元素
    const svg = d3.select('body')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // 准备数据
    const bottleneckData = bottleneckAnalysis.bottleneckWorkflows;

    // 创建比例尺
    const xScale = d3.scaleBand()
      .domain(bottleneckData.map(d => d.workflowName))
      .range([50, width - 50])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(bottleneckData, d => d.bottleneckScore) || 1])
      .range([height - 50, 50]);

    // 创建轴
    svg.append('g')
      .attr('transform', `translate(0,${height - 50})`)
      .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end')
      .attr('font-size', '10px');

    svg.append('g')
      .attr('transform', 'translate(50,0)')
      .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10));

    // 创建条形图
    svg.append('g')
      .selectAll('rect')
      .data(bottleneckData)
      .enter().append('rect')
      .attr('x', d => xScale(d.workflowName) || 0)
      .attr('y', d => yScale(d.bottleneckScore))
      .attr('width', xScale.bandwidth())
      .attr('height', d => height - 50 - yScale(d.bottleneckScore))
      .attr('fill', '#ff6b6b')
      .append('title')
      .text(d => `Score: ${d.bottleneckScore.toFixed(2)}\nReason: ${d.primaryBottleneckReason}`);

    // 添加标题
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('Bottleneck Workflows');

    // 保存 SVG 到文件
    const svgContent = svg.node()?.outerHTML || '';
    const svgPath = path.join(outputPath, 'bottleneck-analysis.svg');
    fs.writeFileSync(svgPath, svgContent);

    // 清理临时 DOM 元素
    d3.select('body').select('svg').remove();

    console.log(`Generated bottleneck analysis visualization: ${svgPath}`);
  }

  /**
   * 生成依赖类型分布可视化
   * @param graph 依赖图
   * @param outputPath 输出路径
   */
  private generateDependencyTypeVisualization(graph: DependencyGraph, outputPath: string): void {
    const width = 600;
    const height = 400;
    const radius = Math.min(width, height) / 2 - 20;

    // 准备数据
    const dependencyTypeCounts = this.countDependencyTypes(graph);
    const data = Object.entries(dependencyTypeCounts).map(([type, count]) => ({
      type,
      count,
    }));

    // 创建 SVG 元素
    const svg = d3.select('body')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // 创建颜色比例尺
    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.type))
      .range(['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4']);

    // 创建饼图生成器
    const pie = d3.pie<typeof data[0]>()
      .value(d => d.count)
      .sort(null);

    // 创建弧生成器
    const arc = d3.arc<d3.PieArcDatum<typeof data[0]>>()
      .innerRadius(0)
      .outerRadius(radius);

    // 创建标签弧生成器
    const labelArc = d3.arc<d3.PieArcDatum<typeof data[0]>>()
      .innerRadius(radius + 10)
      .outerRadius(radius + 30);

    // 创建饼图
    const arcs = svg.selectAll('arc')
      .data(pie(data))
      .enter().append('g')
      .attr('class', 'arc');

    // 添加扇形
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.type));

    // 添加标签
    arcs.append('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text(d => `${d.data.type}: ${d.data.count}`);

    // 添加标题
    svg.append('text')
      .attr('x', 0)
      .attr('y', -height / 2 + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('Dependency Type Distribution');

    // 保存 SVG 到文件
    const svgContent = d3.select('body').select('svg').node()?.outerHTML || '';
    const svgPath = path.join(outputPath, 'dependency-type-distribution.svg');
    fs.writeFileSync(svgPath, svgContent);

    // 清理临时 DOM 元素
    d3.select('body').select('svg').remove();

    console.log(`Generated dependency type distribution visualization: ${svgPath}`);
  }

  /**
   * 统计依赖类型
   * @param graph 依赖图
   * @returns 依赖类型计数
   */
  private countDependencyTypes(graph: DependencyGraph): Record<string, number> {
    const counts: Record<string, number> = {};

    graph.edges.forEach(edge => {
      counts[edge.dependencyType] = (counts[edge.dependencyType] || 0) + 1;
    });

    return counts;
  }
}
