import { TestRunner } from './runners/test-runner';
import type { BenchmarkConfig, BenchmarkResult, BenchmarkReportConfig, BenchmarkComparisonResult } from './types';
import { defaultBenchmarkConfig, defaultReportConfig } from './types';
import type { Workflow } from 'n8n-workflow';
import fs from 'fs';
import path from 'path';

/**
 * Main workflow benchmarker class
 */
export class WorkflowBenchmarker {
  private config: BenchmarkConfig;

  /**
   * Constructor
   */
  constructor(config: BenchmarkConfig) {
    this.config = {
      ...defaultBenchmarkConfig,
      ...config
    } as BenchmarkConfig;
  }

  /**
   * Run benchmark test
   */
  async run(): Promise<BenchmarkResult> {
    console.log(`Starting benchmark: ${this.config.name}`);
    console.log(`Iterations: ${this.config.iterations}, Concurrency: ${this.config.concurrency}`);

    const runner = new TestRunner(this.config);
    const result = await runner.run();

    // Generate reports
    await this.generateReports(result);

    console.log(`Benchmark completed in ${result.totalDuration}ms`);
    console.log(`Mean execution time: ${result.statistics.executionTime.mean.toFixed(2)}ms`);
    console.log(`Success rate: ${result.statistics.successRate.toFixed(2)}%`);
    console.log(`Throughput: ${result.statistics.throughput.toFixed(2)} iterations/sec`);

    return result;
  }

  /**
   * Generate reports for benchmark result
   */
  private async generateReports(result: BenchmarkResult): Promise<void> {
    const outputDir = this.config.outputDir || './benchmark-results';

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate JSON report
    if (this.config.outputFormats.includes('json')) {
      await this.generateJsonReport(result, outputDir);
    }

    // Generate CSV report
    if (this.config.outputFormats.includes('csv')) {
      await this.generateCsvReport(result, outputDir);
    }

    // Generate PDF report
    if (this.config.outputFormats.includes('pdf')) {
      await this.generatePdfReport(result, outputDir);
    }
  }

  /**
   * Generate JSON report
   */
  private async generateJsonReport(result: BenchmarkResult, outputDir: string): Promise<void> {
    const filename = path.join(outputDir, `${result.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`);
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`JSON report generated: ${filename}`);
  }

  /**
   * Generate CSV report
   */
  private async generateCsvReport(result: BenchmarkResult, outputDir: string): Promise<void> {
    const filename = path.join(outputDir, `${result.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.csv`);

    // Generate CSV content
    const csvContent = this.generateCsvContent(result);
    fs.writeFileSync(filename, csvContent);
    console.log(`CSV report generated: ${filename}`);
  }

  /**
   * Generate CSV content from benchmark result
   */
  private generateCsvContent(result: BenchmarkResult): string {
    let csv = 'Metric,Value\n';

    // Add summary metrics
    csv += `Mean Execution Time (ms),${result.statistics.executionTime.mean.toFixed(2)}\n`;
    csv += `Median Execution Time (ms),${result.statistics.executionTime.median.toFixed(2)}\n`;
    csv += `Min Execution Time (ms),${result.statistics.executionTime.min.toFixed(2)}\n`;
    csv += `Max Execution Time (ms),${result.statistics.executionTime.max.toFixed(2)}\n`;
    csv += `Standard Deviation (ms),${result.statistics.executionTime.stdDev.toFixed(2)}\n`;
    csv += `95th Percentile (ms),${result.statistics.executionTime.p95.toFixed(2)}\n`;
    csv += `99th Percentile (ms),${result.statistics.executionTime.p99.toFixed(2)}\n`;
    csv += `Mean Memory Usage (MB),${result.statistics.memoryUsage.mean.toFixed(2)}\n`;
    csv += `Mean CPU Usage (%),${result.statistics.cpuUsage.mean.toFixed(2)}\n`;
    csv += `Success Rate (%),${result.statistics.successRate.toFixed(2)}\n`;
    csv += `Throughput (iterations/sec),${result.statistics.throughput.toFixed(2)}\n`;

    // Add node-level metrics
    csv += '\nNode,Mean Execution Time (ms),Mean Memory Usage (MB),Mean CPU Usage (%),Success Rate (%)\n';
    Object.entries(result.nodeStatistics).forEach(([nodeName, stats]) => {
      csv += `${nodeName},${stats.executionTime.mean.toFixed(2)},`;
      csv += `${stats.memoryUsage ? stats.memoryUsage.mean.toFixed(2) : 'N/A'},`;
      csv += `${stats.cpuUsage ? stats.cpuUsage.mean.toFixed(2) : 'N/A'},`;
      csv += `${stats.successRate.toFixed(2)}\n`;
    });

    return csv;
  }

  /**
   * Generate PDF report
   */
  private async generatePdfReport(result: BenchmarkResult, outputDir: string): Promise<void> {
    const filename = path.join(outputDir, `${result.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`);

    // In a real implementation, this would use pdfkit to generate a PDF report
    // For now, we'll create a placeholder file
    fs.writeFileSync(filename, 'PDF report placeholder');
    console.log(`PDF report generated: ${filename}`);
  }

  /**
   * Compare multiple benchmark results
   */
  compareResults(results: BenchmarkResult[]): BenchmarkComparisonResult {
    const comparison: BenchmarkComparisonResult = {
      results,
      metrics: {
        executionTime: {},
        memoryUsage: {},
        cpuUsage: {},
        successRate: {},
        throughput: {}
      },
      bestPerformers: {
        executionTime: '',
        memoryUsage: '',
        cpuUsage: '',
        successRate: '',
        throughput: ''
      }
    };

    // Calculate metrics for each result
    results.forEach(result => {
      comparison.metrics.executionTime[result.name] = result.statistics.executionTime.mean;
      comparison.metrics.memoryUsage[result.name] = result.statistics.memoryUsage.mean;
      comparison.metrics.cpuUsage[result.name] = result.statistics.cpuUsage.mean;
      comparison.metrics.successRate[result.name] = result.statistics.successRate;
      comparison.metrics.throughput[result.name] = result.statistics.throughput;
    });

    // Determine best performers
    comparison.bestPerformers.executionTime = this.findBestPerformer(comparison.metrics.executionTime, 'min');
    comparison.bestPerformers.memoryUsage = this.findBestPerformer(comparison.metrics.memoryUsage, 'min');
    comparison.bestPerformers.cpuUsage = this.findBestPerformer(comparison.metrics.cpuUsage, 'min');
    comparison.bestPerformers.successRate = this.findBestPerformer(comparison.metrics.successRate, 'max');
    comparison.bestPerformers.throughput = this.findBestPerformer(comparison.metrics.throughput, 'max');

    // Calculate overall best performer (simplified)
    const performerScores = new Map<string, number>();
    Object.values(comparison.bestPerformers).forEach(performer => {
      if (performer) {
        performerScores.set(performer, (performerScores.get(performer) || 0) + 1);
      }
    });

    let bestScore = 0;
    let overallBestPerformer = '';
    performerScores.forEach((score, performer) => {
      if (score > bestScore) {
        bestScore = score;
        overallBestPerformer = performer;
      }
    });

    comparison.overallBestPerformer = overallBestPerformer;

    return comparison;
  }

  /**
   * Find best performer for a metric
   */
  private findBestPerformer(metrics: Record<string, number>, mode: 'min' | 'max'): string {
    let bestValue = mode === 'min' ? Infinity : -Infinity;
    let bestPerformer = '';

    Object.entries(metrics).forEach(([name, value]) => {
      if ((mode === 'min' && value < bestValue) || (mode === 'max' && value > bestValue)) {
        bestValue = value;
        bestPerformer = name;
      }
    });

    return bestPerformer;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BenchmarkConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): BenchmarkConfig {
    return { ...this.config };
  }
}

/**
 * Create workflow benchmarker instance
 */
export function createWorkflowBenchmarker(config: BenchmarkConfig): WorkflowBenchmarker {
  return new WorkflowBenchmarker(config);
}

/**
 * Run a quick benchmark test
 */
export async function runQuickBenchmark(
  workflow: Workflow,
  iterations: number = 5
): Promise<BenchmarkResult> {
  const benchmarker = new WorkflowBenchmarker({
    name: `Quick benchmark for ${workflow.name || 'unnamed workflow'}`,
    workflow,
    iterations,
    concurrency: 1,
    metrics: {
      executionTime: true,
      memoryUsage: true,
      cpuUsage: true,
      dataSize: true,
      networkIO: false
    },
    outputFormats: ['json']
  });

  return benchmarker.run();
}

// Export types and utilities
export * from './types';
export * from './runners/test-runner';
