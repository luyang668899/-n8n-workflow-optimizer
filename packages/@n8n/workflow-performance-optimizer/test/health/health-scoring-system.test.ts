import { WorkflowHealthScoringSystem, createHealthScoringSystem } from '../../src/health/health-scoring-system';

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

describe('WorkflowHealthScoringSystem', () => {
  let healthSystem: WorkflowHealthScoringSystem;

  beforeEach(() => {
    healthSystem = createHealthScoringSystem() as WorkflowHealthScoringSystem;
  });

  afterEach(() => {
    (healthSystem as any).close();
  });

  describe('calculateScore', () => {
    it('should calculate health score successfully', async () => {
      const score = await healthSystem.calculateScore(mockWorkflow);
      expect(score).toBeDefined();
      expect(score.workflowId).toBe(mockWorkflow.id);
      expect(score.workflowName).toBe(mockWorkflow.name);
      expect(typeof score.score).toBe('number');
      expect(score.score).toBeGreaterThan(0);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(score.grade);
      expect(score.dimensions).toBeDefined();
      expect(typeof score.dimensions.efficiency).toBe('number');
      expect(typeof score.dimensions.resourceUsage).toBe('number');
      expect(typeof score.dimensions.stability).toBe('number');
      expect(typeof score.dimensions.complexity).toBe('number');
      expect(typeof score.dimensions.maintainability).toBe('number');
    });
  });

  describe('getHealthReport', () => {
    it('should get health report successfully', async () => {
      // 先计算健康评分
      await healthSystem.calculateScore(mockWorkflow);

      const report = await healthSystem.getHealthReport(mockWorkflow.id);
      expect(report).toBeDefined();
      expect(report.score).toBeDefined();
      expect(report.analysis).toBeDefined();
      expect(report.suggestions).toBeDefined();
      expect(Array.isArray(report.suggestions)).toBe(true);
      expect(report.history).toBeDefined();
      expect(Array.isArray(report.history)).toBe(true);
    });

    it('should handle getHealthReport errors', async () => {
      await expect(healthSystem.getHealthReport('non-existent-workflow')).rejects.toThrow();
    });
  });

  describe('getScoreHistory', () => {
    it('should get score history successfully', async () => {
      // 先计算健康评分
      await healthSystem.calculateScore(mockWorkflow);

      const history = await healthSystem.getScoreHistory(mockWorkflow.id, 5);
      expect(history).toBeDefined();
      expect(history.workflowId).toBe(mockWorkflow.id);
      expect(Array.isArray(history.records)).toBe(true);
      expect(history.records.length).toBeGreaterThan(0);
      expect(history.trend).toBeDefined();
      expect(['improving', 'declining', 'stable']).toContain(history.trend.overall);
    });

    it('should return empty history for non-existent workflow', async () => {
      const history = await healthSystem.getScoreHistory('non-existent-workflow');
      expect(history).toBeDefined();
      expect(history.workflowId).toBe('non-existent-workflow');
      expect(history.records).toHaveLength(0);
      expect(history.trend).toBeDefined();
      expect(history.trend.overall).toBe('stable');
    });
  });

  describe('getImprovementSuggestions', () => {
    it('should get improvement suggestions', async () => {
      const suggestions = await healthSystem.getImprovementSuggestions(mockWorkflow.id);
      expect(Array.isArray(suggestions)).toBe(true);
      // 应该至少有一个建议
      expect(suggestions.length).toBeGreaterThan(0);

      // 检查建议的结构
      if (suggestions.length > 0) {
        const suggestion = suggestions[0];
        expect(suggestion.id).toBeDefined();
        expect(suggestion.type).toBeDefined();
        expect(suggestion.title).toBeDefined();
        expect(suggestion.description).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(suggestion.priority);
        expect(['easy', 'medium', 'hard']).toContain(suggestion.difficulty);
        expect(Array.isArray(suggestion.steps)).toBe(true);
      }
    });
  });

  describe('saveHealthScore', () => {
    it('should save health score successfully', async () => {
      // 先计算健康评分
      const score = await healthSystem.calculateScore(mockWorkflow);

      const result = await healthSystem.saveHealthScore(score);
      expect(result).toBe(true);
    });
  });

  describe('analyzeHealthTrend', () => {
    it('should analyze health trend', async () => {
      // 先计算健康评分
      await healthSystem.calculateScore(mockWorkflow);

      const trend = await healthSystem.analyzeHealthTrend(mockWorkflow.id, 7);
      expect(trend).toBeDefined();
      expect(['improving', 'declining', 'stable']).toContain(trend.trend);
      expect(typeof trend.scoreChange).toBe('number');
      expect(Array.isArray(trend.keyInsights)).toBe(true);
    });

    it('should handle insufficient data for trend analysis', async () => {
      const trend = await healthSystem.analyzeHealthTrend('non-existent-workflow', 7);
      expect(trend).toBeDefined();
      expect(trend.trend).toBe('stable');
      expect(trend.keyInsights.length).toBeGreaterThan(0);
    });
  });

  describe('cleanupOldData', () => {
    it('should cleanup old health data', async () => {
      // 先计算健康评分
      await healthSystem.calculateScore(mockWorkflow);

      const count = (healthSystem as any).cleanupOldData();
      expect(typeof count).toBe('number');
    });
  });
});
