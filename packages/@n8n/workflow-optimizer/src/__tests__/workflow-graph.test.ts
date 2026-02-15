import { describe, it, expect } from 'vitest';
import { WorkflowGraphBuilder } from '../workflow-graph';
import type { Workflow } from 'n8n-workflow';

describe('WorkflowGraphBuilder', () => {
  let graphBuilder: WorkflowGraphBuilder;

  beforeEach(() => {
    graphBuilder = new WorkflowGraphBuilder();
  });

  describe('build', () => {
    it('should build workflow graph from simple workflow', () => {
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

      const graph = graphBuilder.build(mockWorkflow);

      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.length).toBe(1);
      expect(graph.entryNodes).toEqual(['Node 1']);
      expect(graph.exitNodes).toEqual(['Node 2']);
      expect(graph.criticalPath).toEqual(['Node 1', 'Node 2']);
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

      const graph = graphBuilder.build(mockWorkflow);

      expect(graph.nodes.size).toBe(1);
      expect(graph.edges.length).toBe(0);
      expect(graph.entryNodes).toEqual(['Node 1']);
      expect(graph.exitNodes).toEqual(['Node 1']);
      expect(graph.criticalPath).toEqual(['Node 1']);
    });

    it('should handle complex workflow with multiple paths', () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Start': {
            id: 'start',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            disabled: false,
            parameters: {}
          },
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
          },
          'End': {
            id: 'end',
            name: 'End',
            type: 'n8n-nodes-base.end',
            disabled: false,
            parameters: {}
          }
        },
        connections: {
          'Start': {
            main: [
              [
                {
                  node: 'Node 1',
                  type: 'main',
                  index: 0
                }
              ],
              [
                {
                  node: 'Node 2',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          },
          'Node 1': {
            main: [
              [
                {
                  node: 'End',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          },
          'Node 2': {
            main: [
              [
                {
                  node: 'End',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          }
        },
        active: true
      } as Workflow;

      const graph = graphBuilder.build(mockWorkflow);

      expect(graph.nodes.size).toBe(4);
      expect(graph.edges.length).toBe(4);
      expect(graph.entryNodes).toEqual(['Start']);
      expect(graph.exitNodes).toEqual(['End']);
    });
  });

  describe('detectCycles', () => {
    it('should detect cycles in workflow', () => {
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
            type: 'n8n-nodes-base.function',
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
          },
          'Node 2': {
            main: [
              [
                {
                  node: 'Node 1',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          }
        },
        active: true
      } as Workflow;

      const graph = graphBuilder.build(mockWorkflow);
      const cycles = graphBuilder.detectCycles(graph);

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('Node 1');
      expect(cycles[0]).toContain('Node 2');
    });

    it('should return empty array for workflow without cycles', () => {
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
            type: 'n8n-nodes-base.function',
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

      const graph = graphBuilder.build(mockWorkflow);
      const cycles = graphBuilder.detectCycles(graph);

      expect(cycles).toHaveLength(0);
    });
  });

  describe('findParallelizationOpportunities', () => {
    it('should find parallelization opportunities in workflow', () => {
      const mockWorkflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: {
          'Start': {
            id: 'start',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            disabled: false,
            parameters: {}
          },
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
          },
          'End': {
            id: 'end',
            name: 'End',
            type: 'n8n-nodes-base.end',
            disabled: false,
            parameters: {}
          }
        },
        connections: {
          'Start': {
            main: [
              [
                {
                  node: 'Node 1',
                  type: 'main',
                  index: 0
                }
              ],
              [
                {
                  node: 'Node 2',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          },
          'Node 1': {
            main: [
              [
                {
                  node: 'End',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          },
          'Node 2': {
            main: [
              [
                {
                  node: 'End',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          }
        },
        active: true
      } as Workflow;

      const graph = graphBuilder.build(mockWorkflow);
      const opportunities = graphBuilder.findParallelizationOpportunities(graph);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0]).toEqual(['Node 1', 'Node 2']);
    });
  });
});
