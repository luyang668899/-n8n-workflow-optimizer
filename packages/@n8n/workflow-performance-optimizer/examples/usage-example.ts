import { WorkflowPerformanceOptimizer } from '../src/index';

// 模拟工作流实例
const mockWorkflow = {
  id: 'test-workflow-1',
  name: 'Test Workflow',
  nodes: {
    'node1': {
      id: 'node1',
      name: 'Node 1',
      type: 'n8n-nodes-base.start',
      position: [0, 0],
      parameters: {},
      description: 'Start node'
    },
    'node2': {
      id: 'node2',
      name: 'Node 2',
      type: 'n8n-nodes-base.httpRequest',
      position: [200, 0],
      parameters: {}
    },
    'node3': {
      id: 'node3',
      name: 'Node 3',
      type: 'n8n-nodes-base.errorTrigger',
      position: [400, 0],
      parameters: {}
    }
  },
  connectionsBySourceNode: {
    'node1': {
      'main': {
        '0': [
          {
            node: 'node2',
            type: 'main',
            index: 0
          }
        ]
      }
    },
    'node2': {
      'error': {
        '0': [
          {
            node: 'node3',
            type: 'error',
            index: 0
          }
        ]
      }
    }
  },
  active: true,
  settings: {},
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

async function runExample() {
  console.log('=== n8n Workflow Performance Optimizer Example ===\n');

  try {
    // 获取性能优化器实例
    const optimizer = WorkflowPerformanceOptimizer.getInstance();

    // 1. 智能调度系统示例
    console.log('1. 智能调度系统测试:');
    const scheduleResult = await optimizer.scheduler.schedule(mockWorkflow);
    console.log('   调度结果:', scheduleResult.message);
    console.log('   调度状态:', scheduleResult.success ? '成功' : '失败');
    if (scheduleResult.schedule) {
      console.log('   计划执行时间:', new Date(scheduleResult.schedule.scheduledTime).toLocaleString());
    }

    // 获取工作流特征
    const workflowFeatures = await optimizer.scheduler.getWorkflowFeatures(mockWorkflow);
    console.log('\n   工作流特征:');
    console.log('   - 节点数量:', workflowFeatures.nodeCount);
    console.log('   - 连接数量:', workflowFeatures.connectionCount);
    console.log('   - 工作流深度:', workflowFeatures.depth);
    console.log('   - 复杂度评分:', workflowFeatures.complexityScore.toFixed(2));
    console.log('   - 预计执行时长:', workflowFeatures.estimatedDuration, 'ms');

    // 获取资源使用情况
    const resourceUsage = await optimizer.scheduler.getResourceUsage();
    console.log('\n   系统资源使用情况:');
    console.log('   - CPU使用率:', resourceUsage.cpu.usage.toFixed(2), '%');
    console.log('   - 内存使用率:', resourceUsage.memory.usage.toFixed(2), '%');

    // 2. 性能比较模块示例
    console.log('\n2. 性能比较模块测试:');
    const benchmarkResult = await optimizer.comparator.runBenchmark(mockWorkflow, {
      iterations: 3,
      concurrency: 1,
      name: 'Test Benchmark'
    });
    console.log('   基准测试完成:', benchmarkResult.name);
    console.log('   成功率:', benchmarkResult.statistics.successRate.toFixed(2), '%');
    console.log('   平均执行时间:', benchmarkResult.statistics.executionTime.mean.toFixed(2), 'ms');
    console.log('   平均内存使用:', benchmarkResult.statistics.memoryUsage.mean.toFixed(2), 'MB');

    // 3. 健康评分系统示例
    console.log('\n3. 健康评分系统测试:');
    const healthScore = await optimizer.health.calculateScore(mockWorkflow);
    console.log('   健康评分:', healthScore.score.toFixed(2));
    console.log('   评分等级:', healthScore.grade);
    console.log('   各维度评分:');
    console.log('   - 执行效率:', healthScore.dimensions.efficiency.toFixed(2));
    console.log('   - 资源使用:', healthScore.dimensions.resourceUsage.toFixed(2));
    console.log('   - 稳定性:', healthScore.dimensions.stability.toFixed(2));
    console.log('   - 复杂度:', healthScore.dimensions.complexity.toFixed(2));
    console.log('   - 可维护性:', healthScore.dimensions.maintainability.toFixed(2));

    // 获取健康报告
    const healthReport = await optimizer.health.getHealthReport(mockWorkflow.id);
    console.log('\n   健康报告:');
    console.log('   - 改进建议数量:', healthReport.suggestions.length);
    if (healthReport.suggestions.length > 0) {
      console.log('   - 主要改进建议:');
      healthReport.suggestions.slice(0, 2).forEach((suggestion: any, index: number) => {
        console.log(`     ${index + 1}. [${suggestion.priority}] ${suggestion.title}`);
        console.log(`        ${suggestion.description}`);
      });
    }

    // 4. 综合分析示例
    console.log('\n4. 综合分析测试:');
    const analysisResult = await optimizer.analyzeWorkflow(mockWorkflow);
    console.log('   综合分析完成:');
    console.log('   - 工作流特征:', Object.keys(analysisResult.features).length, '个特征');
    console.log('   - 基准测试结果:', analysisResult.benchmark ? '完成' : '未完成');
    console.log('   - 健康评分:', analysisResult.healthScore ? analysisResult.healthScore.score.toFixed(2) : '未计算');
    console.log('   - 健康报告:', analysisResult.healthReport ? '生成' : '未生成');

    console.log('\n=== 测试完成 ===');
    console.log('所有核心功能模块都已成功执行，没有出现错误。');

  } catch (error) {
    console.error('\n=== 测试失败 ===');
    console.error('错误信息:', (error as Error).message);
    console.error('错误堆栈:', (error as Error).stack);
  }
}

// 运行示例
runExample();
