import type { Workflow } from 'n8n-workflow';
import type { BenchmarkResult } from '@n8n/workflow-benchmarker';

/**
 * CI/CD配置选项
 */
export interface CiCdConfig {
  /** 工作流文件路径或目录 */
  workflowPaths: string[];
  /** 性能测试配置 */
  performanceTest: {
    /** 迭代次数 */
    iterations: number;
    /** 并发度 */
    concurrency: number;
    /** 数据量 */
    dataSize: number;
    /** 环境变量 */
    envVars: Record<string, string>;
  };
  /** 性能门禁配置 */
  performanceGates: {
    /** 最大执行时间（毫秒） */
    maxExecutionTime: number;
    /** 最大内存使用（MB） */
    maxMemoryUsage: number;
    /** 最大CPU使用率（百分比） */
    maxCpuUsage: number;
    /** 允许的性能下降百分比 */
    allowedPerformanceDegradation: number;
  };
  /** 报告配置 */
  report: {
    /** 是否生成JSON报告 */
    generateJson: boolean;
    /** 是否生成CSV报告 */
    generateCsv: boolean;
    /** 是否生成PDF报告 */
    generatePdf: boolean;
    /** 报告输出目录 */
    outputDirectory: string;
  };
  /** 增量测试配置 */
  incrementalTest: {
    /** 是否启用增量测试 */
    enabled: boolean;
    /** 比较基准分支 */
    baseBranch: string;
    /** 变更检测策略 */
    changeDetectionStrategy: 'git' | 'file';
  };
}

/**
 * CI/CD执行结果
 */
export interface CiCdResult {
  /** 执行状态 */
  status: 'success' | 'failure' | 'skipped';
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 测试的工作流数量 */
  testedWorkflows: number;
  /** 性能测试结果 */
  benchmarkResults: BenchmarkResult[];
  /** 性能门禁检查结果 */
  gateResults: GateResult[];
  /** 错误信息（如果有） */
  errorMessage?: string;
  /** 报告文件路径 */
  reportFiles?: string[];
}

/**
 * 性能门禁检查结果
 */
export interface GateResult {
  /** 工作流ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 是否通过门禁 */
  passed: boolean;
  /** 失败的门禁项 */
  failedGates: string[];
  /** 性能指标 */
  metrics: {
    /** 执行时间（毫秒） */
    executionTime: number;
    /** 内存使用（MB） */
    memoryUsage: number;
    /** CPU使用率（百分比） */
    cpuUsage: number;
  };
}

/**
 * GitHub Action配置选项
 */
export interface GitHubActionConfig extends CiCdConfig {
  /** GitHub仓库信息 */
  repository: {
    /** 所有者 */
    owner: string;
    /** 仓库名 */
    repo: string;
    /** 分支 */
    branch: string;
  };
  /** GitHub Token */
  githubToken: string;
  /** 是否创建PR评论 */
  createPrComment: boolean;
  /** 是否更新PR状态 */
  updatePrStatus: boolean;
}

/**
 * GitLab CI配置选项
 */
export interface GitLabCiConfig extends CiCdConfig {
  /** GitLab项目ID */
  projectId: string;
  /** GitLab Token */
  gitlabToken: string;
  /** 是否创建MR评论 */
  createMrComment: boolean;
  /** 是否更新MR状态 */
  updateMrStatus: boolean;
}

/**
 * 工作流变更信息
 */
export interface WorkflowChange {
  /** 工作流文件路径 */
  filePath: string;
  /** 变更类型 */
  changeType: 'added' | 'modified' | 'deleted';
  /** 工作流实例 */
  workflow?: Workflow;
}

/**
 * CI/CD执行上下文
 */
export interface CiCdContext {
  /** CI系统类型 */
  ciSystem: 'github' | 'gitlab' | 'local';
  /** 分支信息 */
  branch: string;
  /** 提交信息 */
  commit: string;
  /** PR/MR信息 */
  prInfo?: {
    /** PR/MR编号 */
    number: number;
    /** 标题 */
    title: string;
    /** 描述 */
    description: string;
  };
  /** 环境变量 */
  envVars: Record<string, string>;
}

/**
 * 性能测试配置文件接口
 */
export interface PerformanceTestConfig {
  /** 测试名称 */
  name: string;
  /** 测试描述 */
  description?: string;
  /** 工作流文件路径 */
  workflowPath: string;
  /** 测试参数 */
  testParams: {
    /** 迭代次数 */
    iterations: number;
    /** 并发度 */
    concurrency: number;
    /** 输入数据 */
    inputData?: any[];
    /** 环境变量 */
    envVars?: Record<string, string>;
  };
  /** 性能门禁 */
  performanceGates: {
    /** 最大执行时间（毫秒） */
    maxExecutionTime?: number;
    /** 最大内存使用（MB） */
    maxMemoryUsage?: number;
    /** 最大CPU使用率（百分比） */
    maxCpuUsage?: number;
  };
}
