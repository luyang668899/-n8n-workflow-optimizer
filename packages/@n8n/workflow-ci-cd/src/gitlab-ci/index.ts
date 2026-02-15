import type { GitLabCiConfig, CiCdResult } from '../types';
import { createCiCdManager } from '../core/ci-cd-manager';

/**
 * GitLab CI 执行器
 * 负责在 GitLab CI 环境中执行工作流性能测试和门禁检查
 */
export class GitLabCiExecutor {
  private config: GitLabCiConfig;
  private projectId: string;
  private gitlabToken: string;

  /**
   * 构造函数
   * @param config GitLab CI 配置选项
   */
  constructor(config: GitLabCiConfig) {
    this.config = config;
    this.projectId = config.projectId;
    this.gitlabToken = config.gitlabToken;
  }

  /**
   * 执行 GitLab CI
   * @returns CI/CD 执行结果
   */
  async execute(): Promise<CiCdResult> {
    try {
      // 获取 GitLab 上下文
      const context = this.getContext();

      // 创建 CI/CD 管理器
      const ciCdManager = createCiCdManager(this.config, context);

      // 执行 CI/CD 流程
      const result = await ciCdManager.execute();

      // 更新 MR 状态
      if (this.config.updateMrStatus && context.prInfo) {
        await this.updateMrStatus(result, context.prInfo.number);
      }

      // 创建 MR 评论
      if (this.config.createMrComment && context.prInfo) {
        await this.createMrComment(result, context.prInfo.number);
      }

      // 设置 CI 输出
      this.setCiOutputs(result);

      // 根据执行结果设置 CI 状态
      if (result.status === 'failure') {
        process.exit(1);
      } else if (result.status === 'skipped') {
        console.log('No changed workflows detected, skipping performance tests');
      }

      return result;
    } catch (error) {
      console.error('Error executing GitLab CI:', error);
      process.exit(1);
    }
  }

  /**
   * 获取 GitLab 上下文
   * @returns CI/CD 执行上下文
   */
  private getContext() {
    return {
      ciSystem: 'gitlab' as const,
      branch: process.env.CI_COMMIT_BRANCH || '',
      commit: process.env.CI_COMMIT_SHA || '',
      prInfo: process.env.CI_MERGE_REQUEST_IID ? {
        number: parseInt(process.env.CI_MERGE_REQUEST_IID || '0'),
        title: process.env.CI_MERGE_REQUEST_TITLE || '',
        description: process.env.CI_MERGE_REQUEST_DESCRIPTION || '',
      } : undefined,
      envVars: process.env,
    };
  }

  /**
   * 更新 MR 状态
   * @param result CI/CD 执行结果
   * @param mrNumber MR 编号
   */
  private async updateMrStatus(result: CiCdResult, mrNumber: number) {
    // GitLab API 端点
    const apiUrl = process.env.CI_API_V4_URL || 'https://gitlab.com/api/v4';
    const url = `${apiUrl}/projects/${encodeURIComponent(this.projectId)}/merge_requests/${mrNumber}/notes`;

    // 创建状态笔记
    const noteContent = this.generateStatusNote(result);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': this.gitlabToken,
        },
        body: JSON.stringify({ body: noteContent }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update MR status: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to update MR status:', error);
    }
  }

  /**
   * 创建 MR 评论
   * @param result CI/CD 执行结果
   * @param mrNumber MR 编号
   */
  private async createMrComment(result: CiCdResult, mrNumber: number) {
    // GitLab API 端点
    const apiUrl = process.env.CI_API_V4_URL || 'https://gitlab.com/api/v4';
    const url = `${apiUrl}/projects/${encodeURIComponent(this.projectId)}/merge_requests/${mrNumber}/notes`;

    // 创建评论内容
    const commentBody = this.generateMrCommentBody(result);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': this.gitlabToken,
        },
        body: JSON.stringify({ body: commentBody }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create MR comment: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to create MR comment:', error);
    }
  }

  /**
   * 生成状态笔记内容
   * @param result CI/CD 执行结果
   * @returns 状态笔记内容
   */
  private generateStatusNote(result: CiCdResult): string {
    const statusEmoji = result.status === 'success' ? '✅' : result.status === 'failure' ? '❌' : '⏭️';
    const statusText = result.status.toUpperCase();
    const description = this.getStatusDescription(result);

    return `${statusEmoji} **Workflow Performance Test**: ${statusText} - ${description}`;
  }

  /**
   * 生成 MR 评论内容
   * @param result CI/CD 执行结果
   * @returns MR 评论内容
   */
  private generateMrCommentBody(result: CiCdResult): string {
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
   * 设置 CI 输出
   * @param result CI/CD 执行结果
   */
  private setCiOutputs(result: CiCdResult) {
    // GitLab CI 使用 echo 命令设置输出变量
    console.log(`\n${'='.repeat(80)}\n`);
    console.log('📊 Workflow Performance Test Results:');
    console.log(`\nStatus: ${result.status}`);
    console.log(`Execution Time: ${result.executionTime.toFixed(2)}ms`);
    console.log(`Tested Workflows: ${result.testedWorkflows}`);
    console.log(`Failed Workflows: ${result.gateResults.filter(r => !r.passed).length}`);

    if (result.reportFiles && result.reportFiles.length > 0) {
      console.log(`\nGenerated Reports:`);
      result.reportFiles.forEach(file => {
        console.log(`- ${file}`);
      });
    }

    console.log(`\n${'='.repeat(80)}\n`);

    // 设置 GitLab CI 输出变量
    console.log(`\n${'='.repeat(80)}\n`);
    console.log('Setting GitLab CI output variables:');
    console.log(`\necho "STATUS=${result.status}" >> \$GITHUB_OUTPUT`);
    console.log(`echo "EXECUTION_TIME=${result.executionTime}" >> \$GITHUB_OUTPUT`);
    console.log(`echo "TESTED_WORKFLOWS=${result.testedWorkflows}" >> \$GITHUB_OUTPUT`);
    console.log(`echo "FAILED_WORKFLOWS=${result.gateResults.filter(r => !r.passed).length}" >> \$GITHUB_OUTPUT`);
    console.log(`echo "REPORT_FILES=${JSON.stringify(result.reportFiles || [])}" >> \$GITHUB_OUTPUT`);
    console.log(`\n${'='.repeat(80)}\n`);
  }
}

/**
 * 创建 GitLab CI 执行器实例的工厂函数
 * @param config GitLab CI 配置选项
 * @returns GitLab CI 执行器实例
 */
export function createGitLabCiExecutor(config: GitLabCiConfig): GitLabCiExecutor {
  return new GitLabCiExecutor(config);
}

/**
 * GitLab CI 主入口函数
 */
export async function run(): Promise<void> {
  try {
    // 读取输入参数
    const config = {
      workflowPaths: process.env.WORKFLOW_PATHS?.split('\n').filter(Boolean) || ['./**/*.json'],
      performanceTest: {
        iterations: parseInt(process.env.ITERATIONS || '5'),
        concurrency: parseInt(process.env.CONCURRENCY || '1'),
        dataSize: parseInt(process.env.DATA_SIZE || '10'),
        envVars: {},
      },
      performanceGates: {
        maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '10000'),
        maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '512'),
        maxCpuUsage: parseInt(process.env.MAX_CPU_USAGE || '80'),
        allowedPerformanceDegradation: parseInt(process.env.ALLOWED_PERFORMANCE_DEGRADATION || '10'),
      },
      report: {
        generateJson: process.env.GENERATE_JSON_REPORT === 'true',
        generateCsv: process.env.GENERATE_CSV_REPORT === 'true',
        generatePdf: process.env.GENERATE_PDF_REPORT === 'true',
        outputDirectory: process.env.REPORT_OUTPUT_DIRECTORY || './reports',
      },
      incrementalTest: {
        enabled: process.env.INCREMENTAL_TEST === 'true',
        baseBranch: process.env.BASE_BRANCH || 'main',
        changeDetectionStrategy: 'git' as const,
      },
      projectId: process.env.CI_PROJECT_ID || '',
      gitlabToken: process.env.GITLAB_TOKEN || '',
      createMrComment: process.env.CREATE_MR_COMMENT === 'true',
      updateMrStatus: process.env.UPDATE_MR_STATUS === 'true',
    } as GitLabCiConfig;

    // 验证必需的参数
    if (!config.projectId) {
      console.error('Error: CI_PROJECT_ID is required');
      process.exit(1);
    }

    if (!config.gitlabToken) {
      console.error('Error: GITLAB_TOKEN is required');
      process.exit(1);
    }

    // 创建并执行 GitLab CI 执行器
    const executor = createGitLabCiExecutor(config);
    await executor.execute();
  } catch (error) {
    console.error('Error executing GitLab CI:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行 run 函数
if (require.main === module) {
  run();
}