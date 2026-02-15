import { describe, it, expect } from 'vitest';
import { MetricsCollector } from '../metrics-collector';
import type { IRun } from 'n8n-workflow';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('collect', () => {
    it('should collect metrics from workflow execution', () => {
      const mockRun: IRun = {
        id: 'test-run-1',
        workflowId: 'test-workflow',
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

      const metrics = collector.collect(mockRun);

      expect(metrics.totalExecutionTime).toBe(300);
      expect(metrics.nodeCount).toBe(2);
      expect(metrics.nodeExecutions.size).toBe(2);
      expect(metrics.longestRunningNode).toBe('Node 2');
      expect(metrics.averageNodeExecutionTime).toBe(150);
    });

    it('should handle execution with errors', () => {
      const mockRun: IRun = {
        id: 'test-run-2',
        workflowId: 'test-workflow',
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
              }, {
                executionTime: 50,
                error: {
                  message: 'Node error'
                }
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'error'
      };

      const metrics = collector.collect(mockRun);

      expect(metrics.totalExecutionTime).toBe(150);
      expect(metrics.nodeCount).toBe(1);
      expect(metrics.nodeExecutions.size).toBe(1);

      const node1Metrics = metrics.nodeExecutions.get('Node 1');
      expect(node1Metrics).toBeDefined();
      expect(node1Metrics?.errorCount).toBe(1);
      expect(node1Metrics?.successCount).toBe(1);
      expect(node1Metrics?.executionCount).toBe(2);
    });

    it('should handle empty execution data', () => {
      const mockRun: IRun = {
        id: 'test-run-3',
        workflowId: 'test-workflow',
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

      const metrics = collector.collect(mockRun);

      expect(metrics.totalExecutionTime).toBe(0);
      expect(metrics.nodeCount).toBe(0);
      expect(metrics.nodeExecutions.size).toBe(0);
      expect(metrics.longestRunningNode).toBe('');
      expect(metrics.averageNodeExecutionTime).toBe(0);
    });
  });

  describe('collectBatch', () => {
    it('should collect metrics from multiple executions', () => {
      const mockRun1: IRun = {
        id: 'test-run-1',
        workflowId: 'test-workflow',
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
        workflowId: 'test-workflow',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            runData: {
              'Node 1': [{
                executionTime: 150,
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

      const batchMetrics = collector.collectBatch([mockRun1, mockRun2]);

      expect(batchMetrics.runs.length).toBe(2);
      expect(batchMetrics.averageTotalExecutionTime).toBe(125);
      expect(batchMetrics.minTotalExecutionTime).toBe(100);
      expect(batchMetrics.maxTotalExecutionTime).toBe(150);
      expect(batchMetrics.successRate).toBe(100);
    });

    it('should handle batch with failed executions', () => {
      const mockRun1: IRun = {
        id: 'test-run-1',
        workflowId: 'test-workflow',
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
        workflowId: 'test-workflow',
        workflowName: 'Test Workflow',
        data: {
          resultData: {
            error: {
              message: 'Test error'
            },
            runData: {}
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'error'
      };

      const batchMetrics = collector.collectBatch([mockRun1, mockRun2]);

      expect(batchMetrics.runs.length).toBe(2);
      expect(batchMetrics.successRate).toBe(50);
    });

    it('should handle empty batch', () => {
      const batchMetrics = collector.collectBatch([]);

      expect(batchMetrics.runs.length).toBe(0);
      expect(batchMetrics.averageTotalExecutionTime).toBe(0);
      expect(batchMetrics.minTotalExecutionTime).toBe(0);
      expect(batchMetrics.maxTotalExecutionTime).toBe(0);
      expect(batchMetrics.successRate).toBe(0);
    });
  });
});
