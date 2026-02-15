import { describe, it, expect, vi } from 'vitest';
import { SuggestionGenerator } from '../suggestion-generator';
import type { Workflow } from 'n8n-workflow';
import { ExecutionAnalysisResult, OptimizationOptions } from '../types';

describe('SuggestionGenerator', () => {
  let generator: SuggestionGenerator;

  beforeEach(() => {
    generator = new SuggestionGenerator();
  });

  describe('generateExecutionBasedSuggestions', () => {
    it('should generate caching suggestions for long-running nodes', () => {
      const mockAnalysis: ExecutionAnalysisResult = {
        runId: 'test-run-1',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        metrics: {
          totalExecutionTime: 2000,
          nodeExecutions: new Map([
            ['Slow Node', {
              nodeName: 'Slow Node',
              nodeType: 'n8n-nodes-base.httpRequest',
              executionTime: 2000,
              executionCount: 1,
              errorCount: 0,
              successCount: 1,
              averageExecutionTime: 2000,
              inputDataSize: 1000,
              outputDataSize: 1000,
              isBottleneck: false
            }]
          ]),
          connectionCount: 1,
          nodeCount: 1,
          averageNodeExecutionTime: 2000,
          longestRunningNode: 'Slow Node',
          bottlenecks: []
        },
        executionTime: 2000,
        success: true,
        error: undefined,
        nodeExecutionData: new Map(),
        generatedAt: new Date()
      };

      const options: OptimizationOptions = {
        enabledOptimizations: ['caching', 'parallelExecution'],
        maxSuggestions: 10,
        severityThreshold: 'low'
      };

      // @ts-ignore
      const suggestions = generator.generateExecutionBasedSuggestions([mockAnalysis], options);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('caching');
      expect(suggestions[0].description).toContain('Add caching for node "Slow Node"');
      expect(suggestions[0].severity).toBe('high');
    });

    it('should generate error handling suggestions for nodes with high error rates', () => {
      const mockAnalysis: ExecutionAnalysisResult = {
        runId: 'test-run-1',
        workflowId: 'test-workflow-1',
        workflowName: 'Test Workflow',
        metrics: {
          totalExecutionTime: 1000,
          nodeExecutions: new Map([
            ['Error Node', {
              nodeName: 'Error Node',
              nodeType: 'n8n-nodes-base.httpRequest',
              executionTime: 1000,
              executionCount: 10,
              errorCount: 6,
              successCount: 4,
              averageExecutionTime: 100,
              inputDataSize: 1000,
              outputDataSize: 1000,
              isBottleneck: false
            }]
          ]),
          connectionCount: 1,
          nodeCount: 1,
          averageNodeExecutionTime: 1000,
          longestRunningNode: 'Error Node',
          bottlenecks: []
        },
        executionTime: 1000,
        success: false,
        error: 'Test error',
        nodeExecutionData: new Map(),
        generatedAt: new Date()
      };

      const options: OptimizationOptions = {
        enabledOptimizations: ['errorHandling'],
        maxSuggestions: 10,
        severityThreshold: 'low'
      };

      // @ts-ignore
      const suggestions = generator.generateExecutionBasedSuggestions([mockAnalysis], options);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('errorHandling');
      expect(suggestions[0].description).toContain('Improve error handling for node "Error Node"');
      expect(suggestions[0].severity).toBe('high');
    });
  });

  describe('generateStructureBasedSuggestions', () => {
    it('should generate workflow splitting suggestions for large workflows', () => {
      const mockWorkflow: Partial<Workflow> = {
        nodes: {
          'node-1': { id: 'node-1', name: 'Node 1', type: 'n8n-nodes-base.function', disabled: false },
          // Add more nodes to reach 51 nodes
        }
      };

      // Add 50 more nodes
      for (let i = 2; i <= 51; i++) {
        (mockWorkflow.nodes as any)[`node-${i}`] = {
          id: `node-${i}`,
          name: `Node ${i}`,
          type: 'n8n-nodes-base.function',
          disabled: false
        };
      }

      const mockStructureAnalysis = {
        nodes: new Map(Object.keys(mockWorkflow.nodes as any).map(key => [
          (mockWorkflow.nodes as any)[key].name,
          { id: key, name: (mockWorkflow.nodes as any)[key].name, depth: 1 }
        ])),
        entryNodes: ['Node 1'],
        exitNodes: ['Node 51']
      };

      const options: OptimizationOptions = {
        enabledOptimizations: ['workflowSplitting'],
        maxSuggestions: 10,
        severityThreshold: 'low'
      };

      // @ts-ignore
      const suggestions = generator.generateStructureBasedSuggestions(mockWorkflow as Workflow, mockStructureAnalysis, options);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('workflowSplitting');
      expect(suggestions[0].description).toContain('Split this large workflow into smaller, more manageable workflows');
      expect(suggestions[0].severity).toBe('medium');
    });

    it('should generate cycle detection suggestions for workflows with cycles', () => {
      const mockWorkflow: Partial<Workflow> = {
        nodes: {
          'node-1': { id: 'node-1', name: 'Node 1', type: 'n8n-nodes-base.function', disabled: false },
          'node-2': { id: 'node-2', name: 'Node 2', type: 'n8n-nodes-base.function', disabled: false }
        }
      };

      const mockStructureAnalysis = {
        nodes: new Map([
          ['Node 1', { id: 'node-1', name: 'Node 1', depth: 1 }],
          ['Node 2', { id: 'node-2', name: 'Node 2', depth: 2 }]
        ])
      };

      // Mock cycle detection
      const originalDetectCycles = generator.graphBuilder.detectCycles;
      generator.graphBuilder.detectCycles = vi.fn(() => [['Node 1', 'Node 2', 'Node 1']]);

      const options: OptimizationOptions = {
        enabledOptimizations: ['connectionOptimization'],
        maxSuggestions: 10,
        severityThreshold: 'low'
      };

      // @ts-ignore
      const suggestions = generator.generateStructureBasedSuggestions(mockWorkflow as Workflow, mockStructureAnalysis, options);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('connectionOptimization');
      expect(suggestions[0].description).toContain('Remove cycles from workflow to avoid infinite loops');
      expect(suggestions[0].severity).toBe('high');

      // Restore original method
      generator.graphBuilder.detectCycles = originalDetectCycles;
    });
  });

  describe('generateParallelizationSuggestions', () => {
    it('should generate parallelization suggestions for nodes that can be executed in parallel', () => {
      const mockStructureAnalysis = {};

      // Mock parallelization opportunities
      const originalFindOpportunities = generator.graphBuilder.findParallelizationOpportunities;
      generator.graphBuilder.findParallelizationOpportunities = vi.fn(() => [
        ['Node 1', 'Node 2'],
        ['Node 3']
      ]);

      const options: OptimizationOptions = {
        enabledOptimizations: ['parallelExecution'],
        maxSuggestions: 10,
        severityThreshold: 'low'
      };

      // @ts-ignore
      const suggestions = generator.generateParallelizationSuggestions(mockStructureAnalysis, options);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('parallelExecution');
      expect(suggestions[0].description).toContain('Execute nodes in parallel: Node 1, Node 2');
      expect(suggestions[0].severity).toBe('medium');

      // Restore original method
      generator.graphBuilder.findParallelizationOpportunities = originalFindOpportunities;
    });
  });

  describe('generateNodeBasedSuggestions', () => {
    it('should generate HTTP request specific suggestions', () => {
      const mockWorkflow: Partial<Workflow> = {
        nodes: {
          'http-node': { id: 'http-node', name: 'HTTP Request', type: 'n8n-nodes-base.httpRequest', disabled: false }
        }
      };

      const options: OptimizationOptions = {
        enabledOptimizations: ['caching', 'batchProcessing'],
        maxSuggestions: 10,
        severityThreshold: 'low'
      };

      // @ts-ignore
      const suggestions = generator.generateNodeBasedSuggestions(mockWorkflow as Workflow, options);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].type).toBe('caching');
      expect(suggestions[0].description).toContain('Add caching for HTTP Request node "HTTP Request"');
      expect(suggestions[1].type).toBe('batchProcessing');
      expect(suggestions[1].description).toContain('Use batch processing for HTTP Request node "HTTP Request"');
    });

    it('should generate code optimization suggestions for code nodes', () => {
      const mockWorkflow: Partial<Workflow> = {
        nodes: {
          'code-node': { id: 'code-node', name: 'Code', type: 'n8n-nodes-base.code', disabled: false }
        }
      };

      const options: OptimizationOptions = {
        enabledOptimizations: ['expressionOptimization'],
        maxSuggestions: 10,
        severityThreshold: 'low'
      };

      // @ts-ignore
      const suggestions = generator.generateNodeBasedSuggestions(mockWorkflow as Workflow, options);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('expressionOptimization');
      expect(suggestions[0].description).toContain('Optimize code in node "Code"');
    });
  });

  describe('deduplicateSuggestions', () => {
    it('should remove duplicate suggestions', () => {
      const duplicateSuggestions = [
        {
          id: 'test-suggestion',
          type: 'caching',
          description: 'Test suggestion',
          severity: 'medium',
          estimatedImprovement: 50,
          implementationEffort: 'low',
          appliesTo: ['Node 1'],
          details: {}
        },
        {
          id: 'test-suggestion', // Same ID as above
          type: 'caching',
          description: 'Test suggestion',
          severity: 'medium',
          estimatedImprovement: 50,
          implementationEffort: 'low',
          appliesTo: ['Node 1'],
          details: {}
        }
      ];

      // @ts-ignore
      const deduplicated = generator.deduplicateSuggestions(duplicateSuggestions);

      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].id).toBe('test-suggestion');
    });
  });
});
