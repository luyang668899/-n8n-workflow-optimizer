/**
 * Performance data visualization using D3.js
 */
export class PerformanceCharts {
  private svgElements: Map<string, SVGElement> = new Map();
  private dataStore: Map<string, any[]> = new Map();
  private maxDataPoints = 100;

  /**
   * Initialize charts
   */
  init(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Create chart containers
    this.createChartContainer(container, 'execution-time-chart', 'Execution Time (ms)');
    this.createChartContainer(container, 'memory-usage-chart', 'Memory Usage (MB)');
    this.createChartContainer(container, 'cpu-usage-chart', 'CPU Usage (%)');
    this.createChartContainer(container, 'bottleneck-heatmap', 'Bottleneck Heatmap');

    // Initialize data stores
    this.dataStore.set('executionTime', []);
    this.dataStore.set('memoryUsage', []);
    this.dataStore.set('cpuUsage', []);
    this.dataStore.set('bottlenecks', []);
  }

  /**
   * Create chart container
   */
  private createChartContainer(container: HTMLElement, id: string, title: string): void {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.style.margin = '10px';
    chartContainer.style.padding = '10px';
    chartContainer.style.border = '1px solid #ddd';
    chartContainer.style.borderRadius = '4px';

    const chartTitle = document.createElement('h3');
    chartTitle.textContent = title;
    chartTitle.style.marginTop = '0';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = id;
    svg.style.width = '100%';
    svg.style.height = '300px';

    chartContainer.appendChild(chartTitle);
    chartContainer.appendChild(svg);
    container.appendChild(chartContainer);

    this.svgElements.set(id, svg);
  }

  /**
   * Update execution time chart
   */
  updateExecutionTimeChart(nodeName: string, time: number): void {
    const data = this.dataStore.get('executionTime') || [];
    data.push({ timestamp: Date.now(), nodeName, time });

    // Keep only recent data points
    if (data.length > this.maxDataPoints) {
      data.shift();
    }

    this.dataStore.set('executionTime', data);
    this.renderLineChart('execution-time-chart', data, 'time', 'Execution Time (ms)');
  }

  /**
   * Update memory usage chart
   */
  updateMemoryUsageChart(memoryBefore: number, memoryAfter: number, memoryPeak: number): void {
    const data = this.dataStore.get('memoryUsage') || [];
    data.push({
      timestamp: Date.now(),
      before: memoryBefore,
      after: memoryAfter,
      peak: memoryPeak
    });

    // Keep only recent data points
    if (data.length > this.maxDataPoints) {
      data.shift();
    }

    this.dataStore.set('memoryUsage', data);
    this.renderBarChart('memory-usage-chart', data, ['before', 'after', 'peak'], 'Memory Usage (MB)');
  }

  /**
   * Update CPU usage chart
   */
  updateCpuUsageChart(usage: number): void {
    const data = this.dataStore.get('cpuUsage') || [];
    data.push({ timestamp: Date.now(), usage });

    // Keep only recent data points
    if (data.length > this.maxDataPoints) {
      data.shift();
    }

    this.dataStore.set('cpuUsage', data);
    this.renderLineChart('cpu-usage-chart', data, 'usage', 'CPU Usage (%)');
  }

  /**
   * Update bottleneck heatmap
   */
  updateBottleneckHeatmap(bottlenecks: any[]): void {
    this.dataStore.set('bottlenecks', bottlenecks);
    this.renderHeatmap('bottleneck-heatmap', bottlenecks);
  }

  /**
   * Render line chart
   */
  private renderLineChart(chartId: string, data: any[], valueKey: string, yAxisLabel: string): void {
    const svg = this.svgElements.get(chartId);
    if (!svg) return;

    // Clear existing content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    const xScale = this.createTimeScale(data, innerWidth);
    const yScale = this.createLinearScale(data, valueKey, innerHeight);

    // Create line generator
    const line = d3.line<any>()
      .x(d => xScale(d.timestamp) + margin.left)
      .y(d => yScale(d[valueKey]) + margin.top)
      .curve(d3.curveMonotoneX);

    // Create path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', line(data));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#3b82f6');
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);

    // Add axes
    this.addXAxis(svg, xScale, innerWidth, innerHeight, margin);
    this.addYAxis(svg, yScale, innerHeight, margin, yAxisLabel);
  }

  /**
   * Render bar chart
   */
  private renderBarChart(chartId: string, data: any[], valueKeys: string[], yAxisLabel: string): void {
    const svg = this.svgElements.get(chartId);
    if (!svg) return;

    // Clear existing content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    const xScale = this.createTimeScale(data, innerWidth);
    const maxValue = Math.max(...data.map(d =>
      Math.max(...valueKeys.map(key => d[key]))
    ));
    const yScale = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([innerHeight, 0]);

    const barWidth = innerWidth / data.length / valueKeys.length * 0.8;
    const colors = ['#3b82f6', '#10b981', '#f59e0b'];

    // Create bars
    data.forEach((d, i) => {
      valueKeys.forEach((key, j) => {
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const x = xScale(d.timestamp) + margin.left + j * barWidth;
        const barHeight = innerHeight - yScale(d[key]);

        bar.setAttribute('x', x.toString());
        bar.setAttribute('y', (yScale(d[key]) + margin.top).toString());
        bar.setAttribute('width', barWidth.toString());
        bar.setAttribute('height', barHeight.toString());
        bar.setAttribute('fill', colors[j % colors.length]);

        svg.appendChild(bar);
      });
    });

    // Add axes
    this.addXAxis(svg, xScale, innerWidth, innerHeight, margin);
    this.addYAxis(svg, yScale, innerHeight, margin, yAxisLabel);
  }

  /**
   * Render heatmap
   */
  private renderHeatmap(chartId: string, bottlenecks: any[]): void {
    const svg = this.svgElements.get(chartId);
    if (!svg) return;

    // Clear existing content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const margin = { top: 20, right: 20, bottom: 40, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Group bottlenecks by node
    const nodes = [...new Set(bottlenecks.map(b => b.nodeName))];
    const nodeMap = new Map(nodes.map((node, i) => [node, i]));

    // Create scales
    const xScale = d3.scaleBand()
      .domain(['executionTime', 'memory', 'cpu', 'dataSize', 'network'])
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleBand()
      .domain(nodes)
      .range([0, innerHeight])
      .padding(0.1);

    const colorScale = d3.scaleSequential()
      .domain([0, 2]) // 0: low, 1: medium, 2: high
      .interpolator(d3.interpolateYlOrRd);

    // Create heatmap cells
    bottlenecks.forEach(bottleneck => {
      const nodeIndex = nodeMap.get(bottleneck.nodeName);
      if (nodeIndex === undefined) return;

      const cell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const severityValue = bottleneck.severity === 'low' ? 0 : bottleneck.severity === 'medium' ? 1 : 2;

      cell.setAttribute('x', (xScale(bottleneck.type) + margin.left).toString());
      cell.setAttribute('y', (yScale(bottleneck.nodeName) + margin.top).toString());
      cell.setAttribute('width', xScale.bandwidth().toString());
      cell.setAttribute('height', yScale.bandwidth().toString());
      cell.setAttribute('fill', colorScale(severityValue));

      // Add tooltip
      cell.setAttribute('title', `${bottleneck.description}\nSeverity: ${bottleneck.severity}`);

      svg.appendChild(cell);
    });

    // Add axes
    this.addHeatmapAxes(svg, xScale, yScale, innerWidth, innerHeight, margin);
  }

  /**
   * Create time scale for x-axis
   */
  private createTimeScale(data: any[], width: number): any {
    if (data.length === 0) {
      return d3.scaleTime().domain([new Date(), new Date()]).range([0, width]);
    }

    const minTime = d3.min(data, d => d.timestamp);
    const maxTime = d3.max(data, d => d.timestamp);

    return d3.scaleTime()
      .domain([new Date(minTime), new Date(maxTime)])
      .range([0, width]);
  }

  /**
   * Create linear scale for y-axis
   */
  private createLinearScale(data: any[], valueKey: string, height: number): any {
    if (data.length === 0) {
      return d3.scaleLinear().domain([0, 100]).range([height, 0]);
    }

    const minValue = 0;
    const maxValue = d3.max(data, d => d[valueKey]) * 1.1;

    return d3.scaleLinear()
      .domain([minValue, maxValue])
      .range([height, 0]);
  }

  /**
   * Add x-axis to chart
   */
  private addXAxis(svg: SVGElement, scale: any, width: number, height: number, margin: any): void {
    const xAxis = d3.axisBottom(scale);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left}, ${height + margin.top})`);

    // Render axis
    d3.select(g).call(xAxis);
    svg.appendChild(g);
  }

  /**
   * Add y-axis to chart
   */
  private addYAxis(svg: SVGElement, scale: any, height: number, margin: any, label: string): void {
    const yAxis = d3.axisLeft(scale);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);

    // Render axis
    d3.select(g).call(yAxis);
    svg.appendChild(g);

    // Add y-axis label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', -margin.left);
    text.setAttribute('y', 15);
    text.setAttribute('text-anchor', 'start');
    text.setAttribute('transform', 'rotate(-90)');
    text.textContent = label;
    svg.appendChild(text);
  }

  /**
   * Add axes to heatmap
   */
  private addHeatmapAxes(svg: SVGElement, xScale: any, yScale: any, width: number, height: number, margin: any): void {
    // X-axis
    const xAxis = d3.axisBottom(xScale);
    const xG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    xG.setAttribute('transform', `translate(${margin.left}, ${height + margin.top})`);
    d3.select(xG).call(xAxis);
    svg.appendChild(xG);

    // Y-axis
    const yAxis = d3.axisLeft(yScale);
    const yG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    yG.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
    d3.select(yG).call(yAxis);
    svg.appendChild(yG);
  }

  /**
   * Reset all charts
   */
  reset(): void {
    // Clear data stores
    this.dataStore.clear();

    // Clear SVG elements
    this.svgElements.forEach((svg, id) => {
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }
    });
  }
}

// D3.js typings for TypeScript
declare const d3: any;
