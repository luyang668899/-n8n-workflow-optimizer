#!/usr/bin/env node

import { Command } from 'commander';
import type { CiCdConfig } from '../types';
import { createCiCdManager } from '../core/ci-cd-manager';

/**
 * CLI 工具
 * 用于本地执行工作流性能测试和门禁检查
 */
export class CiCdCli {
  private program: Command;

  /**
   * 构造函数
   */
  constructor() {
    this.program = new Command();
    this.initialize();
  }

  /**
   * 初始化 CLI 命令
   */
  private initialize() {
    this.program
      .name('n8n-workflow-ci-cd')
      .description('n8n 工作流 CI/CD 工具，用于执行性能测试和门禁检查')
      .version('1.0.0');

    // 执行命令
    this.program
      .command('execute')
      .description('执行工作流性能测试和门禁检查')
      .option('-w, --workflow-paths <paths>', '工作流文件路径或目录，多个路径用逗号分隔', (value) => value.split(','))
      .option('-i, --iterations <number>', '性能测试迭代次数', (value) => parseInt(value), 5)
      .option('-c, --concurrency <number>', '性能测试并发度', (value) => parseInt(value), 1)
      .option('-d, --data-size <number>', '性能测试数据量', (value) => parseInt(value), 10)
      .option('--max-execution-time <number>', '最大执行时间（毫秒）', (value) => parseInt(value), 10000)
      .option('--max-memory-usage <number>', '最大内存使用（MB）', (value) => parseInt(value), 512)
      .option('--max-cpu-usage <number>', '最大CPU使用率（百分比）', (value) => parseInt(value), 80)
      .option('--allowed-performance-degradation <number>', '允许的性能下降百分比', (value) => parseInt(value), 10)
      .option('--generate-json-report', '生成 JSON 报告', false)
      .option('--generate-csv-report', '生成 CSV 报告', false)
      .option('--generate-pdf-report', '生成 PDF 报告', false)
      .option('--report-output-directory <directory>', '报告输出目录', './reports')
      .option('--incremental-test', '启用增量测试', false)
      .option('--base-branch <branch>', '比较基准分支', 'main')
      .action(async (options) => {
        await this.executeCommand(options);
      });

    // 帮助命令
    this.program
      .command('help')
      .description('显示帮助信息')
      .action(() => {
        this.program.outputHelp();
      });
  }

  /**
   * 执行命令
   * @param options 命令选项
   */
  private async executeCommand(options: any) {
    try {
      // 构建配置
      const config: CiCdConfig = {
        workflowPaths: options.workflowPaths || ['./**/*.json'],
        performanceTest: {
          iterations: options.iterations,
          concurrency: options.concurrency,
          dataSize: options.dataSize,
          envVars: {},
        },
        performanceGates: {
          maxExecutionTime: options.maxExecutionTime,
          maxMemoryUsage: options.maxMemoryUsage,
          maxCpuUsage: options.maxCpuUsage,
          allowedPerformanceDegradation: options.allowedPerformanceDegradation,
        },
        report: {
          generateJson: options.generateJsonReport,
          generateCsv: options.generateCsvReport,
          generatePdf: options.generatePdfReport,
          outputDirectory: options.reportOutputDirectory,
        },
        incrementalTest: {
          enabled: options.incrementalTest,
          baseBranch: options.baseBranch,
          changeDetectionStrategy: 'git',
        },
      };

      // 获取本地上下文
      const context = this.getContext();

      // 创建 CI/CD 管理器
      const ciCdManager = createCiCdManager(config, context);

      // 执行 CI/CD 流程
      console.log('🚀 Starting workflow performance tests...');
      console.log(`\n📋 Configuration:`);
      console.log(`   Workflow Paths: ${config.workflowPaths.join(', ')}`);
      console.log(`   Iterations: ${config.performanceTest.iterations}`);
      console.log(`   Concurrency: ${config.performanceTest.concurrency}`);
      console.log(`   Data Size: ${config.performanceTest.dataSize}`);
      console.log(`   Max Execution Time: ${config.performanceGates.maxExecutionTime}ms`);
      console.log(`   Max Memory Usage: ${config.performanceGates.maxMemoryUsage}MB`);
      console.log(`   Max CPU Usage: ${config.performanceGates.maxCpuUsage}%`);
      console.log(`   Allowed Performance Degradation: ${config.performanceGates.allowedPerformanceDegradation}%`);
      console.log(`   Report Output Directory: ${config.report.outputDirectory}`);
      console.log(`   Incremental Test: ${config.incrementalTest.enabled ? 'Enabled' : 'Disabled'}`);
      if (config.incrementalTest.enabled) {
        console.log(`   Base Branch: ${config.incrementalTest.baseBranch}`);
      }

      console.log(`\n${'='.repeat(80)}\n`);

      const result = await ciCdManager.execute();

      // 显示执行结果
      this.displayResult(result);

      // 根据执行结果设置退出代码
      if (result.status === 'failure') {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error executing CI/CD process:', error);
      process.exit(1);
    }
  }

  /**
   * 获取本地上下文
   * @returns CI/CD 执行上下文
   */
  private getContext() {
    return {
      ciSystem: 'local' as const,
      branch: 'local',
      commit: 'local',
      envVars: process.env,
    };
  }

  /**
   * 显示执行结果
   * @param result CI/CD 执行结果
   */
  private displayResult(result: any) {
    console.log(`\n${'='.repeat(80)}\n`);
    console.log('📊 Workflow Performance Test Results:');
    console.log(`\n${'='.repeat(80)}\n`);

    // 显示执行状态
    const statusEmoji = result.status === 'success' ? '✅' : result.status === 'failure' ? '❌' : '⏭️';
    console.log(`${statusEmoji} Status: ${result.status.toUpperCase()}`);
    console.log(`⏱️  Execution Time: ${result.executionTime.toFixed(2)}ms`);
    console.log(`📈 Tested Workflows: ${result.testedWorkflows}`);
    console.log(`❌ Failed Workflows: ${result.gateResults.filter((r: any) => !r.passed).length}`);

    // 显示性能测试结果
    if (result.benchmarkResults.length > 0) {
      console.log(`\n${'-'.repeat(80)}\n`);
      console.log('Performance Results:');
      console.log(`\n${'-'.repeat(80)}\n`);
      console.log('| Workflow | Avg Execution Time | Max Memory | Max CPU | Status |');
      console.log('|----------|-------------------|------------|---------|--------|');

      result.gateResults.forEach((gateResult: any) => {
        const benchmarkResult = result.benchmarkResults.find((r: any) => r.workflowId === gateResult.workflowId);
        const statusEmoji = gateResult.passed ? '✅' : '❌';
        const status = gateResult.passed ? 'PASS' : 'FAIL';

        console.log(`| ${gateResult.workflowName} | ${benchmarkResult?.averageExecutionTime || 0}ms | ${gateResult.metrics.memoryUsage}MB | ${gateResult.metrics.cpuUsage}% | ${statusEmoji} ${status} |`);
      });
    }

    // 显示失败的门禁信息
    if (result.gateResults.some((r: any) => !r.passed)) {
      console.log(`\n${'-'.repeat(80)}\n`);
      console.log('Failed Gates:');
      console.log(`\n${'-'.repeat(80)}\n`);
      result.gateResults.forEach((gateResult: any) => {
        if (!gateResult.passed) {
          console.log(`\n🔴 ${gateResult.workflowName}:`);
          gateResult.failedGates.forEach((gate: string) => {
            console.log(`   - ❌ ${gate}`);
          });
        }
      });
    }

    // 显示报告信息
    if (result.reportFiles && result.reportFiles.length > 0) {
      console.log(`\n${'-'.repeat(80)}\n`);
      console.log('Generated Reports:');
      console.log(`\n${'-'.repeat(80)}\n`);
      result.reportFiles.forEach((file: string) => {
        console.log(`   📄 ${file}`);
      });
    }

    // 显示错误信息
    if (result.errorMessage) {
      console.log(`\n${'-'.repeat(80)}\n`);
      console.log('Error:');
      console.log(`\n${'-'.repeat(80)}\n`);
      console.log(`   ${result.errorMessage}`);
    }

    console.log(`\n${'='.repeat(80)}\n`);

    // 显示总结
    if (result.status === 'success') {
      console.log('🎉 All workflows passed performance gates!');
    } else if (result.status === 'failure') {
      const failedWorkflows = result.gateResults.filter((r: any) => !r.passed).length;
      console.log(`❌ ${failedWorkflows} of ${result.testedWorkflows} workflows failed performance gates!`);
    } else {
      console.log('⏭️  No changed workflows detected, skipping performance tests.');
    }

    console.log(`\n${'='.repeat(80)}\n`);
  }

  /**
   * 运行 CLI
   */
  run() {
    this.program.parse(process.argv);
  }
}

/**
 * 创建 CLI 实例的工厂函数
 * @returns CLI 实例
 */
export function createCiCdCli(): CiCdCli {
  return new CiCdCli();
}

/**
 * CLI 主入口函数
 */
export function run() {
  const cli = createCiCdCli();
  cli.run();
}

// 如果直接运行此文件，则执行 run 函数
if (require.main === module) {
  run();
}