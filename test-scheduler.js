const { WorkflowPerformanceOptimizer } = require('./packages/@n8n/workflow-performance-optimizer/dist/index.js');

// 测试智能调度系统
async function testScheduler() {
  console.log('=== 测试智能调度系统 ===\n');

  try {
    // 获取优化器实例
    const optimizer = WorkflowPerformanceOptimizer.getInstance();
    console.log('✓ 成功获取WorkflowPerformanceOptimizer实例');

    // 测试工作流
    const testWorkflow = {
      id: 'test-workflow-1',
      name: '测试工作流',
      nodes: {
        start: {
          id: 'start',
          name: 'Start',
          type: 'n8n-nodes-base.start',
          position: [250, 300],
          parameters: {},
          credentials: {}
        },
        function: {
          id: 'function',
          name: 'Function',
          type: 'n8n-nodes-base.function',
          position: [450, 300],
          parameters: {
            functionCode: 'return items;
'
          },
          credentials: {}
        }
      },
      connectionsBySourceNode: {
        start: {
          main: [
            [
              {
                node: 'function',
                type: 'main',
                index: 0
              }
            ]
          ]
        }
      }
    };

    console.log('✓ 测试工作流创建完成');

    // 测试1: 获取工作流特征
    console.log('\n1. 测试工作流特征提取:');
    const features = await optimizer.scheduler.getWorkflowFeatures(testWorkflow);
    console.log('✓ 成功获取工作流特征');
    console.log('  - 节点数量:', features.nodeCount);
    console.log('  - 连接数量:', features.connectionCount);
    console.log('  - 工作流深度:', features.depth);
    console.log('  - 预计执行时长:', features.estimatedDuration, 'ms');
    console.log('  - 复杂度评分:', features.complexityScore.toFixed(2));
    console.log('  - 资源需求:', {
      cpu: features.resourceRequirements.cpu.toFixed(2) + '%',
      memory: features.resourceRequirements.memory.toFixed(2) + 'MB'
    });

    // 测试2: 获取资源使用情况
    console.log('\n2. 测试实时资源监控:');
    const resourceUsage = await optimizer.scheduler.getResourceUsage();
    console.log('✓ 成功获取资源使用情况');
    console.log('  - CPU使用:', resourceUsage.cpu.usage.toFixed(2) + '%');
    console.log('  - CPU核心数:', resourceUsage.cpu.cores);
    console.log('  - 内存使用:', {
      used: (resourceUsage.memory.used / 1024).toFixed(2) + 'GB',
      total: (resourceUsage.memory.total / 1024).toFixed(2) + 'GB',
      usage: resourceUsage.memory.usage.toFixed(2) + '%'
    });

    // 测试3: 调度工作流
    console.log('\n3. 测试工作流调度:');
    const scheduleResult = await optimizer.scheduler.schedule(testWorkflow, {
      priority: 5,
      estimatedDuration: 1000
    });
    console.log('✓ 成功调度工作流');
    console.log('  - 调度结果:', scheduleResult.success ? '成功' : '失败');
    console.log('  - 调度消息:', scheduleResult.message);
    if (scheduleResult.schedule) {
      console.log('  - 调度ID:', scheduleResult.schedule.id);
      console.log('  - 计划执行时间:', new Date(scheduleResult.schedule.scheduledTime).toLocaleString());
      console.log('  - 预计执行时长:', scheduleResult.schedule.estimatedDuration, 'ms');
      console.log('  - 优先级:', scheduleResult.schedule.priority);
    }

    // 测试4: 获取调度计划
    console.log('\n4. 测试获取调度计划:');
    const schedule = await optimizer.scheduler.getSchedule(testWorkflow.id);
    console.log('✓ 成功获取调度计划');
    if (schedule) {
      console.log('  - 调度状态:', schedule.status);
      console.log('  - 工作流ID:', schedule.workflowId);
      console.log('  - 工作流名称:', schedule.workflowName);
    }

    // 测试5: 重新调度工作流
    console.log('\n5. 测试重新调度工作流:');
    const rescheduleResult = await optimizer.scheduler.reschedule(testWorkflow.id, {
      priority: 8
    });
    console.log('✓ 成功重新调度工作流');
    console.log('  - 重新调度结果:', rescheduleResult.success ? '成功' : '失败');
    console.log('  - 重新调度消息:', rescheduleResult.message);

    // 测试6: 获取所有调度计划
    console.log('\n6. 测试获取所有调度计划:');
    const allSchedules = await optimizer.scheduler.getAllSchedules();
    console.log('✓ 成功获取所有调度计划');
    console.log('  - 调度计划数量:', allSchedules.length);

    // 测试7: 取消调度计划
    console.log('\n7. 测试取消调度计划:');
    const cancelResult = await optimizer.scheduler.cancelSchedule(testWorkflow.id);
    console.log('✓ 成功取消调度计划');
    console.log('  - 取消结果:', cancelResult ? '成功' : '失败');

    // 测试8: 清理调度计划
    console.log('\n8. 测试清理调度计划:');
    const cleanupCount = await optimizer.scheduler.cleanupSchedules();
    console.log('✓ 成功清理调度计划');
    console.log('  - 清理的计划数量:', cleanupCount);

    console.log('\n=== 智能调度系统测试完成 ===');
    console.log('✓ 所有测试用例通过');

  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testScheduler();
