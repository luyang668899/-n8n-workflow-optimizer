import { WorkflowPerformanceComparator, createPerformanceComparator } from '../../src/comparator/performance-comparator';

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

describe('WorkflowPerformanceComparator', () => {
  let comparator: WorkflowPerformanceComparator;

  beforeEach(() => {
    comparator = createPerformanceComparator() as WorkflowPerformanceComparator;
  });

  afterEach(() => {
    (comparator as any).close();
  });

  describe('runBenchmark', () => {
    it('should run a benchmark successfully', async () => {
      const options = {
        iterations: 3,
        concurrency: 1,
        name: 'Test Benchmark'
      };

      const result = await comparator.runBenchmark(mockWorkflow, options);
      expect(result).toBeDefined();
      expect(result.name).toBe(options.name);
      expect(result.workflow.id).toBe(mockWorkflow.id);
      expect(result.statistics).toBeDefined();
      expect(result.rawData).toHaveLength(options.iterations);
      expect(result.statistics.successRate).toBeGreaterThan(0);
    });

    it('should handle benchmark errors', async () => {
      const mockErrorWorkflow = {
        ...mockWorkflow,
        id: 'error-workflow',
        nodes: undefined as any
      };

      const options = {
        iterations: 2,
        concurrency: 1
      };

      const result = await comparator.runBenchmark(mockErrorWorkflow, options);
      expect(result).toBeDefined();
      expect(result.rawData).toHaveLength(options.iterations);
      // 应该有失败的测试
      const failedTests = result.rawData.filter((test: any) => !test.success);
      expect(failedTests.length).toBeGreaterThan(0);
    });
  });

  describe('compareVersions', () => {
    it('should compare multiple versions', async () => {
      // 先运行两个基准测试
      await comparator.runBenchmark(mockWorkflow, {
        iterations: 2,
        concurrency: 1
      });

      await comparator.runBenchmark(mockWorkflow, {
        iterations: 2,
        concurrency: 1
      });

      const versions = ['v1', 'v2'];
      const result = await comparator.compareVersions(mockWorkflow.id, versions);
      expect(result).toBeDefined();
      expect(result.workflowId).toBe(mockWorkflow.id);
      expect(result.versions).toBeDefined();
      expect(result.bestVersion).toBeDefined();
      expect(['improving', 'declining', 'stable']).toContain(result.trend);
    });
  });

  describe('getHistoricalData', () => {
    it('should return historical performance data', async () => {
      // 先运行一个基准测试
      await comparator.runBenchmark(mockWorkflow, {
        iterations: 2,
        concurrency: 1
      });

      const history = await comparator.getHistoricalData(mockWorkflow.id, 5);
      expect(history).toBeDefined();
      expect(history.workflowId).toBe(mockWorkflow.id);
      expect(Array.isArray(history.records)).toBe(true);
      expect(history.records.length).toBeGreaterThan(0);
    });

    it('should return empty history for non-existent workflow', async () => {
      const history = await comparator.getHistoricalData('non-existent-workflow');
      expect(history).toBeDefined();
      expect(history.workflowId).toBe('non-existent-workflow');
      expect(history.records).toHaveLength(0);
    });
  });

  describe('saveBenchmarkResult', () => {
    it('should save a benchmark result', async () => {
      // 先运行一个基准测试
      const benchmarkResult = await comparator.runBenchmark(mockWorkflow, {
        iterations: 2,
        concurrency: 1
      });

      const saved = await comparator.saveBenchmarkResult(benchmarkResult);
      expect(saved).toBe(true);
    });
  });

  describe('getBenchmarkResult', () => {
    it('should return a benchmark result', async () => {
      // 先运行一个基准测试
      await comparator.runBenchmark(mockWorkflow, {
        iterations: 2,
        concurrency: 1
      });

      const result = await comparator.getBenchmarkResult(mockWorkflow.id, 'v1');
      expect(result).toBeDefined();
      expect(result.workflow.id).toBe(mockWorkflow.id);
    });

    it('should return null for non-existent benchmark', async () => {
      const result = await comparator.getBenchmarkResult('non-existent-workflow', 'v1');
      expect(result).toBeNull();
    });
  });

  describe('cleanupOldResults', () => {
    it('should cleanup old benchmark results', async () => {
      // 先运行一个基准测试
      await comparator.runBenchmark(mockWorkflow, {
        iterations: 2,
        concurrency: 1
      });

      const count = (comparator as any).cleanupOldResults();
      expect(typeof count).toBe('number');
    });
  });
});
