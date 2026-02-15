import type { Workflow } from 'n8n-workflow';
import type { CiCdConfig, CiCdResult, CiCdContext, GateResult, WorkflowChange } from '../types';
import { WorkflowBenchmarker, createWorkflowBenchmarker } from '@n8n/workflow-benchmarker';
import { glob } from 'glob';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * CI/CD管理器
 * 负责协调性能测试、门禁检查和报告生成等功能
 */
export class CiCdManager {
  private config: CiCdConfig;
  private context: CiCdContext;
  private benchmarker: WorkflowBenchmarker;

  /**
   * 构造函数
   * @param config CI/CD配置选项
   * @param context CI/CD执行上下文
   */
  constructor(config: CiCdConfig, context: CiCdContext) {
    this.config = config;
    this.context = context;
    this.benchmarker = createWorkflowBenchmarker();
  }

  /**
   * 执行CI/CD流程
   * @returns CI/CD执行结果
   */
  async execute(): Promise<CiCdResult> {
    const startTime = Date.now();

    try {
      // 1. 检测变更的工作流
      const changedWorkflows = await this.detectChangedWorkflows();

      // 2. 如果没有变更的工作流，跳过测试
      if (changedWorkflows.length === 0) {
        return {
          status: 'skipped',
          executionTime: Date.now() - startTime,
          testedWorkflows: 0,
          benchmarkResults: [],
          gateResults: [],
          errorMessage: 'No changed workflows detected',
        };
      }

      // 3. 执行性能测试
      const benchmarkResults = await this.executePerformanceTests(changedWorkflows);

      // 4. 执行性能门禁检查
      const gateResults = this.executeGateChecks(benchmarkResults);

      // 5. 生成报告
      const reportFiles = await this.generateReports(benchmarkResults, gateResults);

      // 6. 确定执行状态
      const status = this.determineExecutionStatus(gateResults);

      return {
        status,
        executionTime: Date.now() - startTime,
        testedWorkflows: benchmarkResults.length,
        benchmarkResults,
        gateResults,
        reportFiles,
      };
    } catch (error) {
      return {
        status: 'failure',
        executionTime: Date.now() - startTime,
        testedWorkflows: 0,
        benchmarkResults: [],
        gateResults: [],
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 检测变更的工作流
   * @returns 变更的工作流列表
   */
  private async detectChangedWorkflows(): Promise<WorkflowChange[]> {
    if (!this.config.incrementalTest.enabled) {
      // 非增量测试模式，返回所有工作流
      return this.getAllWorkflows();
    }

    // 增量测试模式，检测变更的工作流
    // 这里是一个简化的实现，实际应该使用git命令或CI系统的API
    const changedWorkflows: WorkflowChange[] = [];

    // 遍历工作流路径，检查文件是否存在
    for (const workflowPath of this.config.workflowPaths) {
      const files = await glob(workflowPath);

      for (const file of files) {
        try {
          const workflow = this.loadWorkflow(file);
          changedWorkflows.push({
            filePath: file,
            changeType: 'modified', // 简化实现，假设所有文件都已修改
            workflow,
          });
        } catch (error) {
          console.warn(`Failed to load workflow ${file}:`, error);
        }
      }
    }

    return changedWorkflows;
  }

  /**
   * 获取所有工作流
   * @returns 所有工作流列表
   */
  private async getAllWorkflows(): Promise<WorkflowChange[]> {
    const workflows: WorkflowChange[] = [];

    for (const workflowPath of this.config.workflowPaths) {
      const files = await glob(workflowPath);

      for (const file of files) {
        try {
          const workflow = this.loadWorkflow(file);
          workflows.push({
            filePath: file,
            changeType: 'modified',
            workflow,
          });
        } catch (error) {
          console.warn(`Failed to load workflow ${file}:`, error);
        }
      }
    }

    return workflows;
  }

  /**
   * 加载工作流文件
   * @param filePath 工作流文件路径
   * @returns 工作流实例
   */
  private loadWorkflow(filePath: string): Workflow {
    const content = readFileSync(filePath, 'utf8');
    const workflowData = JSON.parse(content);

    // 这里应该使用n8n的工作流加载逻辑
    // 为了演示，我们返回一个简化的工作流对象
    return {
      id: workflowData.id || filePath,
      name: workflowData.name || filePath,
      nodes: workflowData.nodes || [],
      connections: workflowData.connections || {},
      getNodes: () => workflowData.nodes || [],
    } as any;
  }

  /**
   * 执行性能测试
   * @param workflows 要测试的工作流列表
   * @returns 性能测试结果
   */
  private async executePerformanceTests(workflows: WorkflowChange[]): Promise<any[]> {
    const results = [];

    for (const workflowChange of workflows) {
      if (!workflowChange.workflow) continue;

      try {
        // 执行性能测试
        const result = await this.benchmarker.benchmark({
          workflow: workflowChange.workflow,
          iterations: this.config.performanceTest.iterations,
          concurrency: this.config.performanceTest.concurrency,
          inputData: this.generateTestInputData(this.config.performanceTest.dataSize),
          envVars: this.config.performanceTest.envVars,
        });

        results.push(result);
      } catch (error) {
        console.warn(`Failed to benchmark workflow ${workflowChange.filePath}:`, error);
      }
    }

    return results;
  }

  /**
   * 生成测试输入数据
   * @param dataSize 数据量
   * @returns 测试输入数据
   */
  private generateTestInputData(dataSize: number): any[] {
    const data = [];

    for (let i = 0; i < dataSize; i++) {
      data.push({
        json: {
          test: `test-${i}`,
          value: i,
          timestamp: Date.now(),
          data: Array(100).fill('test').join(''), // 生成一些测试数据
        },
      });
    }

    return data;
  }

  /**
   * 执行性能门禁检查
   * @param benchmarkResults 性能测试结果
   * @returns 门禁检查结果
   */
  private executeGateChecks(benchmarkResults: any[]): GateResult[] {
    const gateResults: GateResult[] = [];

    for (const result of benchmarkResults) {
      const failedGates: string[] = [];

      // 检查执行时间门禁
      if (result.averageExecutionTime > this.config.performanceGates.maxExecutionTime) {
        failedGates.push(`Execution time (${result.averageExecutionTime}ms) exceeds maximum (${this.config.performanceGates.maxExecutionTime}ms)`);
      }

      // 检查内存使用门禁
      if (result.maxMemoryUsage > this.config.performanceGates.maxMemoryUsage) {
        failedGates.push(`Memory usage (${result.maxMemoryUsage}MB) exceeds maximum (${this.config.performanceGates.maxMemoryUsage}MB)`);
      }

      // 检查CPU使用率门禁
      if (result.maxCpuUsage > this.config.performanceGates.maxCpuUsage) {
        failedGates.push(`CPU usage (${result.maxCpuUsage}%) exceeds maximum (${this.config.performanceGates.maxCpuUsage}%)`);
      }

      gateResults.push({
        workflowId: result.workflowId,
        workflowName: result.workflowName,
        passed: failedGates.length === 0,
        failedGates,
        metrics: {
          executionTime: result.averageExecutionTime,
          memoryUsage: result.maxMemoryUsage,
          cpuUsage: result.maxCpuUsage,
        },
      });
    }

    return gateResults;
  }

  /**
   * 生成报告
   * @param benchmarkResults 性能测试结果
   * @param gateResults 门禁检查结果
   * @returns 报告文件路径列表
   */
  private async generateReports(benchmarkResults: any[], gateResults: GateResult[]): Promise<string[]> {
    const reportFiles: string[] = [];
    const outputDir = this.config.report.outputDirectory;

    // 确保输出目录存在
    const { mkdirSync } = await import('fs');
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      console.warn(`Failed to create output directory ${outputDir}:`, error);
    }

    // 生成JSON报告
    if (this.config.report.generateJson) {
      const jsonReport = {
        timestamp: Date.now(),
        context: this.context,
        benchmarkResults,
        gateResults,
      };

      const jsonPath = join(outputDir, 'performance-report.json');
      const { writeFileSync } = await import('fs');
      writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
      reportFiles.push(jsonPath);
    }

    // 生成CSV报告
    if (this.config.report.generateCsv) {
      const csvContent = this.generateCsvReport(benchmarkResults, gateResults);
      const csvPath = join(outputDir, 'performance-report.csv');
      const { writeFileSync } = await import('fs');
      writeFileSync(csvPath, csvContent);
      reportFiles.push(csvPath);
    }

    // 生成PDF报告
    if (this.config.report.generatePdf) {
      // 这里应该实现PDF报告生成逻辑
      // 为了演示，我们跳过PDF生成
      console.log('PDF report generation not implemented');
    }

    return reportFiles;
  }

  /**
   * 生成CSV报告
   * @param benchmarkResults 性能测试结果
   * @param gateResults 门禁检查结果
   * @returns CSV报告内容
   */
  private generateCsvReport(benchmarkResults: any[], gateResults: GateResult[]): string {
    const headers = [
      'Workflow ID',
      'Workflow Name',
      'Average Execution Time (ms)',
      'Median Execution Time (ms)',
      '95th Percentile Execution Time (ms)',
      'Max Memory Usage (MB)',
      'Max CPU Usage (%)',
      'Status',
      'Failed Gates',
    ];

    const rows = gateResults.map(gateResult => {
      const benchmarkResult = benchmarkResults.find(r => r.workflowId === gateResult.workflowId);

      return [
        gateResult.workflowId,
        gateResult.workflowName,
        benchmarkResult?.averageExecutionTime || 0,
        benchmarkResult?.medianExecutionTime || 0,
        benchmarkResult?.p95ExecutionTime || 0,
        gateResult.metrics.memoryUsage,
        gateResult.metrics.cpuUsage,
        gateResult.passed ? 'PASS' : 'FAIL',
        gateResult.failedGates.join('; '),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * 确定执行状态
   * @param gateResults 门禁检查结果
   * @returns 执行状态
   */
  private determineExecutionStatus(gateResults: GateResult[]): 'success' | 'failure' | 'skipped' {
    if (gateResults.length === 0) {
      return 'skipped';
    }

    const allPassed = gateResults.every(result => result.passed);
    return allPassed ? 'success' : 'failure';
  }

  /**
   * 销毁CI/CD管理器实例
   */
  destroy(): void {
    // 清理资源
  }
}

/**
 * 创建CI/CD管理器实例的工厂函数
 * @param config CI/CD配置选项
 * @param context CI/CD执行上下文
 * @returns CI/CD管理器实例
 */
export function createCiCdManager(config: CiCdConfig, context: CiCdContext): CiCdManager {
  return new CiCdManager(config, context);
}