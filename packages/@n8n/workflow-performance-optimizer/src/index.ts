import { createWorkflowScheduler } from './scheduler/workflow-scheduler';
import { createPerformanceComparator } from './comparator/performance-comparator';
import { createHealthScoringSystem } from './health/health-scoring-system';

// 导出核心功能模块
export {
  createWorkflowScheduler,
  createPerformanceComparator,
  createHealthScoringSystem
};

// 导出类型定义
export * from './scheduler/types';

// 导出默认实例
const workflowScheduler = createWorkflowScheduler();
const performanceComparator = createPerformanceComparator();
const healthScoringSystem = createHealthScoringSystem();

export {
  workflowScheduler,
  performanceComparator,
  healthScoringSystem
};

// 导出完整的性能优化套件
export class WorkflowPerformanceOptimizer {
  private static instance: WorkflowPerformanceOptimizer;

  public static getInstance(): WorkflowPerformanceOptimizer {
    if (!WorkflowPerformanceOptimizer.instance) {
      WorkflowPerformanceOptimizer.instance = new WorkflowPerformanceOptimizer();
    }
    return WorkflowPerformanceOptimizer.instance;
  }

  public readonly scheduler = workflowScheduler;
  public readonly comparator = performanceComparator;
  public readonly health = healthScoringSystem;

  /**
   * 执行工作流性能分析
   * @param workflow 工作流实例
   * @returns 综合分析结果
   */
  async analyzeWorkflow(workflow: any) {
    // 获取工作流特征
    const features = await this.scheduler.getWorkflowFeatures(workflow);

    // 运行基准测试
    const benchmark = await this.comparator.runBenchmark(workflow, {
      iterations: 5,
      concurrency: 1,
      name: `Analysis for ${workflow.name || workflow.id}`
    });

    // 计算健康评分
    const healthScore = await this.health.calculateScore(workflow);

    // 获取健康报告
    const healthReport = await this.health.getHealthReport(workflow.id);

    return {
      features,
      benchmark,
      healthScore,
      healthReport
    };
  }

  /**
   * 关闭所有服务
   */
  close() {
    (this.scheduler as any).close?.();
    (this.comparator as any).close?.();
    (this.health as any).close?.();
  }
}

export default WorkflowPerformanceOptimizer.getInstance();
