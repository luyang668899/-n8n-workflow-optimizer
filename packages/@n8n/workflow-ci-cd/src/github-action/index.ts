import * as core from '@actions/core';
import * as github from '@actions/github';
import type { GitHubActionConfig, CiCdResult } from '../types';
import { createCiCdManager } from '../core/ci-cd-manager';

/**
 * GitHub Action 执行器
 * 负责在 GitHub Actions 环境中执行工作流性能测试和门禁检查
 */
export class GitHubActionExecutor {
  private config: GitHubActionConfig;
  private octokit: ReturnType<typeof github.getOctokit>;

  /**
   * 构造函数
   * @param config GitHub Action 配置选项
   */
  constructor(config: GitHubActionConfig) {
    this.config = config;
    this.octokit = github.getOctokit(config.githubToken);
  }

  /**
   * 执行 GitHub Action
   * @returns CI/CD 执行结果
   */
  async execute(): Promise<CiCdResult> {
    try {
      // 获取 GitHub 上下文
      const context = this.getContext();

      // 创建 CI/CD 管理器
      const ciCdManager = createCiCdManager(this.config, context);

      // 执行 CI/CD 流程
      const result = await ciCdManager.execute();

      // 更新 PR 状态
      if (this.config.updatePrStatus && context.prInfo) {
        await this.updatePrStatus(result, context.prInfo.number);
      }

      // 创建 PR 评论
      if (this.config.createPrComment && context.prInfo) {
        await this.createPrComment(result, context.prInfo.number);
      }

      // 设置 Action 输出
      this.setActionOutputs(result);

      // 根据执行结果设置 Action 状态
      if (result.status === 'failure') {
        core.setFailed('Performance gates failed');
      } else if (result.status === 'skipped') {
        core.info('No changed workflows detected, skipping performance tests');
      }

      return result;
    } catch (error) {
      core.setFailed(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 获取 GitHub 上下文
   * @returns CI/CD 执行上下文
   */
  private getContext() {
    const githubContext = github.context;

    return {
      ciSystem: 'github' as const,
      branch: githubContext.ref.replace('refs/heads/', ''),
      commit: githubContext.sha,
      prInfo: githubContext.issue.number ? {
        number: githubContext.issue.number,
        title: githubContext.issue.title || '',
        description: githubContext.issue.body || '',
      } : undefined,
      envVars: process.env,
    };
  }

  /**
   * 更新 PR 状态
   * @param result CI/CD 执行结果
   * @param prNumber PR 编号
   */
  private async updatePrStatus(result: CiCdResult, prNumber: number) {
    const { owner, repo } = github.context.repo;
    const state = result.status === 'success' ? 'success' : result.status === 'failure' ? 'failure' : 'pending';
    const description = this.getStatusDescription(result);

    await this.octokit.rest.repos.createCommitStatus({
      owner,
      repo,
      sha: github.context.sha,
      state,
      context: 'n8n-workflow-performance',
      description,
      target_url: process.env.GITHUB_SERVER_URL ? `${process.env.GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined,
    });
  }

  /**
   * 创建 PR 评论
   * @param result CI/CD 执行结果
   * @param prNumber PR 编号
   */
  private async createPrComment(result: CiCdResult, prNumber: number) {
    const { owner, repo } = github.context.repo;
    const commentBody = this.generatePrCommentBody(result);

    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });
  }

  /**
   * 生成 PR 评论内容
   * @param result CI/CD 执行结果
   * @returns PR 评论内容
   */
  private generatePrCommentBody(result: CiCdResult): string {
    let body = `## 🚀 Workflow Performance Test Results

`;

    // 添加执行状态
    const statusEmoji = result.status === 'success' ? '✅' : result.status === 'failure' ? '❌' : '⏭️';
    body += `${statusEmoji} **Status**: ${result.status.toUpperCase()}

`;

    // 添加执行信息
    body += `### Execution Information
`;
    body += `- **Execution Time**: ${result.executionTime.toFixed(2)}ms
`;
    body += `- **Tested Workflows**: ${result.testedWorkflows}
`;

    // 添加性能测试结果
    if (result.benchmarkResults.length > 0) {
      body += `
### Performance Results
`;
      body += `| Workflow | Avg Execution Time | Max Memory | Max CPU | Status |
`;
      body += `|----------|-------------------|------------|---------|--------|
`;

      result.gateResults.forEach(gateResult => {
        const benchmarkResult = result.benchmarkResults.find(r => r.workflowId === gateResult.workflowId);
        const statusEmoji = gateResult.passed ? '✅' : '❌';
        const status = gateResult.passed ? 'PASS' : 'FAIL';

        body += `| ${gateResult.workflowName} | ${benchmarkResult?.averageExecutionTime || 0}ms | ${gateResult.metrics.memoryUsage}MB | ${gateResult.metrics.cpuUsage}% | ${statusEmoji} ${status} |
`;
      });
    }

    // 添加失败的门禁信息
    if (result.gateResults.some(r => !r.passed)) {
      body += `
### Failed Gates
`;
      result.gateResults.forEach(gateResult => {
        if (!gateResult.passed) {
          body += `
#### ${gateResult.workflowName}
`;
          gateResult.failedGates.forEach(gate => {
            body += `- ❌ ${gate}
`;
          });
        }
      });
    }

    // 添加报告链接
    if (result.reportFiles && result.reportFiles.length > 0) {
      body += `
### Reports
`;
      result.reportFiles.forEach(file => {
        body += `- [${file}](${file})
`;
      });
    }

    // 添加错误信息
    if (result.errorMessage) {
      body += `
### Error
`;
      body += `
${result.errorMessage}

`;
    }

    return body;
  }

  /**
   * 获取状态描述
   * @param result CI/CD 执行结果
   * @returns 状态描述
   */
  private getStatusDescription(result: CiCdResult): string {
    if (result.status === 'success') {
      return `All ${result.testedWorkflows} workflows passed performance gates`;
    } else if (result.status === 'failure') {
      const failedWorkflows = result.gateResults.filter(r => !r.passed).length;
      return `${failedWorkflows} of ${result.testedWorkflows} workflows failed performance gates`;
    } else {
      return 'No changed workflows detected';
    }
  }

  /**
   * 设置 Action 输出
   * @param result CI/CD 执行结果
   */
  private setActionOutputs(result: CiCdResult) {
    core.setOutput('status', result.status);
    core.setOutput('execution-time', result.executionTime.toString());
    core.setOutput('tested-workflows', result.testedWorkflows.toString());
    core.setOutput('failed-workflows', result.gateResults.filter(r => !r.passed).length.toString());
    core.setOutput('report-files', JSON.stringify(result.reportFiles || []));
  }
}

/**
 * 创建 GitHub Action 执行器实例的工厂函数
 * @param config GitHub Action 配置选项
 * @returns GitHub Action 执行器实例
 */
export function createGitHubActionExecutor(config: GitHubActionConfig): GitHubActionExecutor {
  return new GitHubActionExecutor(config);
}

/**
 * GitHub Action 主入口函数
 */
export async function run(): Promise<void> {
  try {
    // 读取输入参数
    const config = {
      workflowPaths: core.getInput('workflow-paths').split('\n').filter(Boolean),
      performanceTest: {
        iterations: parseInt(core.getInput('iterations') || '5'),
        concurrency: parseInt(core.getInput('concurrency') || '1'),
        dataSize: parseInt(core.getInput('data-size') || '10'),
        envVars: {},
      },
      performanceGates: {
        maxExecutionTime: parseInt(core.getInput('max-execution-time') || '10000'),
        maxMemoryUsage: parseInt(core.getInput('max-memory-usage') || '512'),
        maxCpuUsage: parseInt(core.getInput('max-cpu-usage') || '80'),
        allowedPerformanceDegradation: parseInt(core.getInput('allowed-performance-degradation') || '10'),
      },
      report: {
        generateJson: core.getInput('generate-json-report') === 'true',
        generateCsv: core.getInput('generate-csv-report') === 'true',
        generatePdf: core.getInput('generate-pdf-report') === 'true',
        outputDirectory: core.getInput('report-output-directory') || './reports',
      },
      incrementalTest: {
        enabled: core.getInput('incremental-test') === 'true',
        baseBranch: core.getInput('base-branch') || 'main',
        changeDetectionStrategy: 'git' as const,
      },
      repository: {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        branch: github.context.ref.replace('refs/heads/', ''),
      },
      githubToken: core.getInput('github-token', { required: true }),
      createPrComment: core.getInput('create-pr-comment') === 'true',
      updatePrStatus: core.getInput('update-pr-status') === 'true',
    } as GitHubActionConfig;

    // 创建并执行 GitHub Action 执行器
    const executor = createGitHubActionExecutor(config);
    await executor.execute();
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : 'Unknown error');
  }
}

// 如果直接运行此文件，则执行 run 函数
if (require.main === module) {
  run();
}