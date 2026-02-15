import { describe, it, expect, vi } from 'vitest';
import { WorkflowOptimizer } from '../optimizer';
import type { Workflow, IRun } from 'n8n-workflow';

describe('WorkflowOptimizer', () => {
  let optimizer: WorkflowOptimizer;

  beforeEach(() => {
    optimizer = new WorkflowOptimizer();
  });

  describe('optimize', () => {
    it('should optimize workflow based on execution data', async () => {
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

      const result = await optimizer.optimize(mockWorkflow, [mockRun]);

      expect(result.workflowId).toBe('test-workflow');
      expect(result.workflowName).toBe('Test Workflow');
      expect(result.totalSuggestions).toBeGreaterThanOrEqual(0);
      expect(result.estimatedImprovement).toBeGreaterThanOrEqual(0);
    });
  });

  describe('optimizeStructure', () => {
    it('should optimize workflow based on structure only', async () => {
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

      const result = await optimizer.optimizeStructure(mockWorkflow);

      expect(result.workflowId).toBe('test-workflow');
      expect(result.workflowName).toBe('Test Workflow');
      expect(result.totalSuggestions).toBeGreaterThanOrEqual(0);
      expect(result.estimatedImprovement).toBeGreaterThanOrEqual(0);
    });
  });

  describe('applyOptimizations', () => {
    it('should apply caching optimization to workflow', async () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'HTTP Node': {
            id: 'http-node',
            name: 'HTTP Node',
            type: 'n8n-nodes-base.httpRequest',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

      const mockSuggestions = [
        {
          id: 'cache-http-HTTP Node',
          type: 'caching',
          description: 'Add caching for HTTP Request node "HTTP Node"',
          severity: 'medium',
          estimatedImprovement: 60,
          implementationEffort: 'low',
          appliesTo: ['HTTP Node'],
          details: {
            nodeName: 'HTTP Node',
            nodeType: 'n8n-nodes-base.httpRequest'
          }
        }
      ];

      const optimizedWorkflow = await optimizer.applyOptimizations(mockWorkflow, mockSuggestions);

      expect(optimizedWorkflow.nodes['HTTP Node'].parameters).toHaveProperty('caching');
      expect(optimizedWorkflow.nodes['HTTP Node'].parameters.caching.enabled).toBe(true);
      expect(optimizedWorkflow.nodes['HTTP Node'].parameters.caching.ttl).toBe(3600);
    });

    it('should apply parallel execution optimization to workflow', async () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'HTTP Node': {
            id: 'http-node',
            name: 'HTTP Node',
            type: 'n8n-nodes-base.httpRequest',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

      const mockSuggestions = [
        {
          id: 'parallel-HTTP Node',
          type: 'parallelExecution',
          description: 'Execute node "HTTP Node" in parallel to improve performance',
          severity: 'medium',
          estimatedImprovement: 60,
          implementationEffort: 'medium',
          appliesTo: ['HTTP Node'],
          details: {
            nodeName: 'HTTP Node',
            executionCount: 5
          }
        }
      ];

      const optimizedWorkflow = await optimizer.applyOptimizations(mockWorkflow, mockSuggestions);

      expect(optimizedWorkflow.nodes['HTTP Node'].parameters).toHaveProperty('parallelExecution');
      expect(optimizedWorkflow.nodes['HTTP Node'].parameters.parallelExecution.enabled).toBe(true);
      expect(optimizedWorkflow.nodes['HTTP Node'].parameters.parallelExecution.maxConcurrency).toBe(5);
    });

    it('should apply error handling optimization to workflow', async () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Error Node': {
            id: 'error-node',
            name: 'Error Node',
            type: 'n8n-nodes-base.httpRequest',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

      const mockSuggestions = [
        {
          id: 'error-handling-Error Node',
          type: 'errorHandling',
          description: 'Improve error handling for node "Error Node"',
          severity: 'high',
          estimatedImprovement: 30,
          implementationEffort: 'low',
          appliesTo: ['Error Node'],
          details: {
            nodeName: 'Error Node',
            errorCount: 5,
            executionCount: 10,
            errorRate: 0.5
          }
        }
      ];

      const optimizedWorkflow = await optimizer.applyOptimizations(mockWorkflow, mockSuggestions);

      expect(optimizedWorkflow.nodes['Error Node'].parameters).toHaveProperty('errorHandling');
      expect(optimizedWorkflow.nodes['Error Node'].parameters.errorHandling.enabled).toBe(true);
      expect(optimizedWorkflow.nodes['Error Node'].parameters.errorHandling.retryCount).toBe(3);
    });

    it('should apply only selected optimizations', async () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'HTTP Node': {
            id: 'http-node',
            name: 'HTTP Node',
            type: 'n8n-nodes-base.httpRequest',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

      const mockSuggestions = [
        {
          id: 'cache-http-HTTP Node',
          type: 'caching',
          description: 'Add caching for HTTP Request node "HTTP Node"',
          severity: 'medium',
          estimatedImprovement: 60,
          implementationEffort: 'low',
          appliesTo: ['HTTP Node'],
          details: {
            nodeName: 'HTTP Node',
            nodeType: 'n8n-nodes-base.httpRequest'
          }
        },
        {
          id: 'batch-http-HTTP Node',
          type: 'batchProcessing',
          description: 'Use batch processing for HTTP Request node "HTTP Node"',
          severity: 'low',
          estimatedImprovement: 40,
          implementationEffort: 'medium',
          appliesTo: ['HTTP Node'],
          details: {
            nodeName: 'HTTP Node',
            nodeType: 'n8n-nodes-base.httpRequest'
          }
        }
      ];

      const optimizedWorkflow = await optimizer.applyOptimizations(mockWorkflow, mockSuggestions, {
        applyOnly: ['cache-http-HTTP Node']
      });

      expect(optimizedWorkflow.nodes['HTTP Node'].parameters).toHaveProperty('caching');
      expect(optimizedWorkflow.nodes['HTTP Node'].parameters).not.toHaveProperty('batchProcessing');
    });
  });

  describe('validateSuggestions', () => {
    it('should validate optimization suggestions', () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Existing Node': {
            id: 'existing-node',
            name: 'Existing Node',
            type: 'n8n-nodes-base.function',
            disabled: false,
            parameters: {}
          }
        },
        connections: {},
        active: true
      } as Workflow;

      const mockSuggestions = [
        {
          id: 'valid-suggestion',
          type: 'caching',
          description: 'Add caching for existing node',
          severity: 'medium',
          estimatedImprovement: 60,
          implementationEffort: 'low',
          appliesTo: ['Existing Node'],
          details: {}
        },
        {
          id: 'invalid-suggestion',
          type: 'caching',
          description: 'Add caching for non-existing node',
          severity: 'medium',
          estimatedImprovement: 60,
          implementationEffort: 'low',
          appliesTo: ['Non-Existing Node'],
          details: {}
        }
      ];

      const validatedSuggestions = optimizer.validateSuggestions(mockSuggestions, mockWorkflow);

      expect(validatedSuggestions).toHaveLength(1);
      expect(validatedSuggestions[0].id).toBe('valid-suggestion');
    });
  });

  describe('prioritizeSuggestions', () => {
    it('should prioritize optimization suggestions', () => {
      const mockSuggestions = [
        {
          id: 'low-severity',
          type: 'caching',
          description: 'Low severity suggestion',
          severity: 'low',
          estimatedImprovement: 50,
          implementationEffort: 'low',
          appliesTo: ['Node 1'],
          details: {}
        },
        {
          id: 'high-severity',
          type: 'caching',
          description: 'High severity suggestion',
          severity: 'high',
          estimatedImprovement: 70,
          implementationEffort: 'low',
          appliesTo: ['Node 2'],
          details: {}
        },
        {
          id: 'medium-severity',
          type: 'caching',
          description: 'Medium severity suggestion',
          severity: 'medium',
          estimatedImprovement: 60,
          implementationEffort: 'low',
          appliesTo: ['Node 3'],
          details: {}
        }
      ];

      const prioritizedSuggestions = optimizer.prioritizeSuggestions(mockSuggestions);

      expect(prioritizedSuggestions[0].severity).toBe('high');
      expect(prioritizedSuggestions[1].severity).toBe('medium');
      expect(prioritizedSuggestions[2].severity).toBe('low');
    });
  });
});
