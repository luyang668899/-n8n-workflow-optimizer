import { describe, it, expect } from 'vitest';
import { WorkflowAnalyzer } from '../analyzer';
import type { Workflow, IRun } from 'n8n-workflow';

describe('WorkflowAnalyzer', () => {
  let analyzer: WorkflowAnalyzer;

  beforeEach(() => {
    analyzer = new WorkflowAnalyzer();
  });

  describe('analyzeExecution', () => {
    it('should analyze workflow execution data', async () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Node 1': {
            id: 'node-1',
            name: 'Node 1',
            type: 'n8n-nodes-base.function',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

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
              }]
            }
          }
        },
        startedAt: new Date(),
        stoppedAt: new Date(),
        finished: true,
        status: 'success'
      };

      const result = await analyzer.analyzeExecution(mockRun, mockWorkflow);

      expect(result.runId).toBe('test-run-1');
      expect(result.workflowId).toBe('test-workflow');
      expect(result.workflowName).toBe('Test Workflow');
      expect(result.success).toBe(true);
      expect(result.metrics.totalExecutionTime).toBe(100);
      expect(result.metrics.nodeCount).toBe(1);
    });

    it('should handle failed execution', async () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Node 1': {
            id: 'node-1',
            name: 'Node 1',
            type: 'n8n-nodes-base.function',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

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
        status: 'error'
      };

      const result = await analyzer.analyzeExecution(mockRun, mockWorkflow);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.metrics.totalExecutionTime).toBe(50);
    });
  });

  describe('analyzeStructure', () => {
    it('should analyze workflow structure', () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Node 1': {
            id: 'node-1',
            name: 'Node 1',
            type: 'n8n-nodes-base.function',
            disabled: false,
            parameters: {}
          },
          'Node 2': {
            id: 'node-2',
            name: 'Node 2',
            type: 'n8n-nodes-base.httpRequest',
            disabled: false,
            parameters: {}
          }
        },
        connections: {
          'Node 1': {
            main: [
              [
                {
                  node: 'Node 2',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          }
        },
        active: true
      } as Workflow;

      const result = analyzer.analyzeStructure(mockWorkflow);

      expect(result.nodeCount).toBe(2);
      expect(result.connectionCount).toBe(1);
      expect(result.entryNodes).toHaveLength(1);
      expect(result.exitNodes).toHaveLength(1);
    });

    it('should handle workflow without connections', () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Node 1': {
            id: 'node-1',
            name: 'Node 1',
            type: 'n8n-nodes-base.function',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

      const result = analyzer.analyzeStructure(mockWorkflow);

      expect(result.nodeCount).toBe(1);
      expect(result.connectionCount).toBe(0);
      expect(result.entryNodes).toHaveLength(1);
      expect(result.exitNodes).toHaveLength(1);
    });
  });

  describe('compareExecutions', () => {
    it('should compare multiple workflow executions', async () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Node 1': {
            id: 'node-1',
            name: 'Node 1',
            type: 'n8n-nodes-base.function',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

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

      const result = await analyzer.compareExecutions([mockRun1, mockRun2], mockWorkflow);

      expect(result.baselineRunId).toBe('test-run-1');
      expect(result.comparisons).toHaveLength(1);
      expect(result.comparisons[0].runId).toBe('test-run-2');
    });
  });
});
