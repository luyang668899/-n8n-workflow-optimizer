import { describe, it, expect, vi } from 'vitest';
import { ExecutionAnalyzer } from '../execution-analyzer';
import type { IRun } from 'n8n-workflow';

describe('ExecutionAnalyzer', () => {
  let analyzer: ExecutionAnalyzer;

  beforeEach(() => {
    analyzer = new ExecutionAnalyzer();
  });

  describe('analyzeRun', () => {
    it('should analyze a successful execution', () => {
      const mockRun: IRun = {
        id: 'test-run-1',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {
              'Node 1': [{
                executionTime: 100,
                data: {
                  main: [[{ json: { test: 'data' } }]
                ]
              }],
              'Node 2': [{
                executionTime: 200,
                data: {
                  main: [[{ json: { result: 'success' } }]
                ]
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      };

      const result = analyzer.analyzeRun(mockRun);

      expect(result.runId).toBe('test-run-1');
      expect(result.workflowId).toBe('test-workflow-1');
      expect(result.workflowName).toBe('Test Workflow');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.metrics.totalExecutionTime).toBe(300);
      expect(result.metrics.nodeCount).toBe(2);
      expect(result.metrics.nodeExecutions.size).toBe(2);
    });

    it('should analyze a failed execution', () => {
      const mockRun: IRun = {
        id: 'test-run-2',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            error: {
              message: 'Test error',
              stack: 'Error: Test error\n    at test.js:1:1'
            },
            runData: {
              'Node 1': [{
                executionTime: 100,
                data: {
                  main: [[{ json: { test: 'data' } }]
                ]
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'error'
      };

      const result = analyzer.analyzeRun(mockRun);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should handle empty run data', () => {
      const mockRun: IRun = {
        id: 'test-run-3',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {}
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      };

      const result = analyzer.analyzeRun(mockRun);

      expect(result.metrics.nodeCount).toBe(0);
      expect(result.metrics.totalExecutionTime).toBe(0);
    });
  });

  describe('compareExecutions', () => {
    it('should compare multiple executions', () => {
      const mockRun1: IRun = {
        id: 'test-run-1',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {
              'Node 1': [{
                executionTime: 100,
                data: {
                  main: [[{ json: { test: 'data' } }]
                ]
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      };

      const mockRun2: IRun = {
        id: 'test-run-2',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {
              'Node 1': [{
                executionTime: 50,
                data: {
                  main: [[{ json: { test: 'data' } }]
                ]
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      };

      const result = analyzer.compareExecutions([mockRun1, mockRun2]);

      expect(result.baselineRunId).toBe('test-run-1');
      expect(result.comparisons).toHaveLength(1);
      expect(result.comparisons[0].runId).toBe('test-run-2');
      expect(result.comparisons[0].comparison.executionTimeChange).toBe(-50); // 50% improvement
    });

    it('should throw error for insufficient runs', () => {
      const mockRun: IRun = {
        id: 'test-run-1',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {}
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      };

      expect(() => analyzer.compareExecutions([mockRun])).toThrow('Need at least 2 runs to compare');
    });
  });

  describe('detectAnomalies', () => {
    it('should detect execution time anomalies', () => {
      const mockRun: IRun = {
        id: 'test-run-1',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {
              'Node 1': [{
                executionTime: 1000,
                data: {
                  main: [[{ json: { test: 'data' } }]
                ]
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      };

      // Create historical runs with much lower execution times
      const historicalRuns: IRun[] = Array.from({ length: 3 }, (_, i) => ({
        id: `historical-run-${i}`,
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {
              'Node 1': [{
                executionTime: 100,
                data: {
                  main: [[{ json: { test: 'data' } }]
                ]
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      }));

      const analysis = analyzer.analyzeRun(mockRun);
      const historicalAnalyses = historicalRuns.map(run => analyzer.analyzeRun(run));

      const anomalies = analyzer.detectAnomalies(analysis, historicalAnalyses);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('executionTime');
      expect(anomalies[0].severity).toBe('high');
    });

    it('should not detect anomalies with insufficient historical data', () => {
      const mockRun: IRun = {
        id: 'test-run-1',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {
              'Node 1': [{
                executionTime: 1000,
                data: {
                  main: [[{ json: { test: 'data' } }]
                ]
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      };

      const analysis = analyzer.analyzeRun(mockRun);
      const historicalAnalyses = [];

      const anomalies = analyzer.detectAnomalies(analysis, historicalAnalyses);

      expect(anomalies).toHaveLength(0);
    });
  });
});
