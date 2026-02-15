import { SmartWorkflowScheduler, createWorkflowScheduler } from '../../src/scheduler/workflow-scheduler';

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
      parameters: {}
    },
    'node2': {
      id: 'node2',
      name: 'Node 2',
      type: 'n8n-nodes-base.httpRequest',
      position: [200, 0],
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
    }
  },
  active: true,
  settings: {},
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('SmartWorkflowScheduler', () => {
  let scheduler: SmartWorkflowScheduler;

  beforeEach(() => {
    scheduler = createWorkflowScheduler() as SmartWorkflowScheduler;
  });

  afterEach(() => {
    (scheduler as any).close();
  });

  describe('schedule', () => {
    it('should successfully schedule a workflow', async () => {
      const result = await scheduler.schedule(mockWorkflow);
      expect(result.success).toBe(true);
      expect(result.message).toBe('工作流已成功调度');
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.workflowId).toBe(mockWorkflow.id);
    });

    it('should handle scheduling errors', async () => {
      // 模拟错误情况
      const mockErrorWorkflow = {
        ...mockWorkflow,
        id: 'error-workflow',
        nodes: undefined as any
      };

      const result = await scheduler.schedule(mockErrorWorkflow);
      expect(result.success).toBe(false);
      expect(result.message).toBe('调度失败');
      expect(result.error).toBeDefined();
    });
  });

  describe('getResourceUsage', () => {
    it('should return resource usage information', async () => {
      const resourceUsage = await scheduler.getResourceUsage();
      expect(resourceUsage).toBeDefined();
      expect(resourceUsage.cpu).toBeDefined();
      expect(resourceUsage.memory).toBeDefined();
      expect(typeof resourceUsage.cpu.usage).toBe('number');
      expect(typeof resourceUsage.memory.usage).toBe('number');
    });
  });

  describe('getWorkflowFeatures', () => {
    it('should return workflow features', async () => {
      const features = await scheduler.getWorkflowFeatures(mockWorkflow);
      expect(features).toBeDefined();
      expect(features.workflowId).toBe(mockWorkflow.id);
      expect(features.workflowName).toBe(mockWorkflow.name);
      expect(features.nodeCount).toBe(Object.keys(mockWorkflow.nodes).length);
      expect(features.connectionCount).toBeGreaterThan(0);
      expect(features.depth).toBeGreaterThan(0);
      expect(features.complexityScore).toBeGreaterThan(0);
    });
  });

  describe('cancelSchedule', () => {
    it('should cancel a scheduled workflow', async () => {
      // 先调度一个工作流
      await scheduler.schedule(mockWorkflow);

      // 取消调度
      const result = await scheduler.cancelSchedule(mockWorkflow.id);
      expect(result).toBe(true);
    });

    it('should return false if no workflow to cancel', async () => {
      const result = await scheduler.cancelSchedule('non-existent-workflow');
      expect(result).toBe(false);
    });
  });

  describe('getSchedule', () => {
    it('should return the schedule for a workflow', async () => {
      // 先调度一个工作流
      await scheduler.schedule(mockWorkflow);

      // 获取调度计划
      const schedule = await scheduler.getSchedule(mockWorkflow.id);
      expect(schedule).toBeDefined();
      expect(schedule?.workflowId).toBe(mockWorkflow.id);
    });

    it('should return null if no schedule exists', async () => {
      const schedule = await scheduler.getSchedule('non-existent-workflow');
      expect(schedule).toBeNull();
    });
  });

  describe('getAllSchedules', () => {
    it('should return all schedules', async () => {
      // 调度一个工作流
      await scheduler.schedule(mockWorkflow);

      // 获取所有调度计划
      const schedules = await scheduler.getAllSchedules();
      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBeGreaterThan(0);
    });
  });

  describe('cleanupSchedules', () => {
    it('should cleanup old schedules', async () => {
      // 调度一个工作流
      await scheduler.schedule(mockWorkflow);

      // 清理调度计划
      const count = await scheduler.cleanupSchedules();
      expect(typeof count).toBe('number');
    });
  });

  describe('reschedule', () => {
    it('should reschedule a workflow', async () => {
      const result = await scheduler.reschedule(mockWorkflow.id);
      expect(result.success).toBe(true);
      expect(result.message).toBe('工作流已成功调度');
    });

    it('should handle rescheduling errors', async () => {
      const result = await scheduler.reschedule('non-existent-workflow');
      expect(result.success).toBe(false);
      expect(result.message).toBe('工作流不存在');
    });
  });
});
