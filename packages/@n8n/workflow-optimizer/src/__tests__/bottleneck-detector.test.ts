import { describe, it, expect } from 'vitest';
import { BottleneckDetector } from '../bottleneck-detector';
import { WorkflowMetrics, NodeExecutionMetrics } from '../types';

describe('BottleneckDetector', () => {
  let detector: BottleneckDetector;

  beforeEach(() => {
    detector = new BottleneckDetector();
  });

  describe('detect', () => {
    it('should detect bottlenecks based on execution time', () => {
      const nodeExecutions = new Map<string, NodeExecutionMetrics>();
      nodeExecutions.set('Fast Node', {
        nodeName: 'Fast Node',
        nodeType: 'n8n-nodes-base.function',
        executionTime: 100,
        executionCount: 1,
        errorCount: 0,
        successCount: 1,
        averageExecutionTime: 100,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      });
      nodeExecutions.set('Slow Node', {
        nodeName: 'Slow Node',
        nodeType: 'n8n-nodes-base.httpRequest',
        executionTime: 1000,
        executionCount: 1,
        errorCount: 0,
        successCount: 1,
        averageExecutionTime: 1000,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      });

      const metrics: WorkflowMetrics = {
        totalExecutionTime: 1100,
        nodeExecutions,
        connectionCount: 1,
        nodeCount: 2,
        averageNodeExecutionTime: 550,
        longestRunningNode: 'Slow Node',
        bottlenecks: []
      };

      const bottlenecks = detector.detect(metrics);

      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].nodeName).toBe('Slow Node');
      expect(bottlenecks[0].severity).toBe('medium');
      expect(bottlenecks[0].reason).toContain('Execution time (1000ms) is significantly higher than average (550ms)');
    });

    it('should detect bottlenecks based on error rate', () => {
      const nodeExecutions = new Map<string, NodeExecutionMetrics>();
      nodeExecutions.set('Error Prone Node', {
        nodeName: 'Error Prone Node',
        nodeType: 'n8n-nodes-base.httpRequest',
        executionTime: 100,
        executionCount: 10,
        errorCount: 5,
        successCount: 5,
        averageExecutionTime: 10,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      });

      const metrics: WorkflowMetrics = {
        totalExecutionTime: 100,
        nodeExecutions,
        connectionCount: 0,
        nodeCount: 1,
        averageNodeExecutionTime: 100,
        longestRunningNode: 'Error Prone Node',
        bottlenecks: []
      };

      const bottlenecks = detector.detect(metrics);

      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].nodeName).toBe('Error Prone Node');
      expect(bottlenecks[0].severity).toBe('high');
      expect(bottlenecks[0].reason).toContain('High error rate');
    });

    it('should detect bottlenecks based on data size', () => {
      const nodeExecutions = new Map<string, NodeExecutionMetrics>();
      nodeExecutions.set('Large Data Node', {
        nodeName: 'Large Data Node',
        nodeType: 'n8n-nodes-base.function',
        executionTime: 100,
        executionCount: 1,
        errorCount: 0,
        successCount: 1,
        averageExecutionTime: 100,
        inputDataSize: 2 * 1024 * 1024, // 2MB
        outputDataSize: 1000,
        isBottleneck: false
      });

      const metrics: WorkflowMetrics = {
        totalExecutionTime: 100,
        nodeExecutions,
        connectionCount: 0,
        nodeCount: 1,
        averageNodeExecutionTime: 100,
        longestRunningNode: 'Large Data Node',
        bottlenecks: []
      };

      const bottlenecks = detector.detect(metrics);

      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].nodeName).toBe('Large Data Node');
      expect(bottlenecks[0].severity).toBe('medium');
      expect(bottlenecks[0].reason).toContain('Large input data size');
    });

    it('should not detect bottlenecks for normal nodes', () => {
      const nodeExecutions = new Map<string, NodeExecutionMetrics>();
      nodeExecutions.set('Normal Node', {
        nodeName: 'Normal Node',
        nodeType: 'n8n-nodes-base.function',
        executionTime: 100,
        executionCount: 1,
        errorCount: 0,
        successCount: 1,
        averageExecutionTime: 100,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      });

      const metrics: WorkflowMetrics = {
        totalExecutionTime: 100,
        nodeExecutions,
        connectionCount: 0,
        nodeCount: 1,
        averageNodeExecutionTime: 100,
        longestRunningNode: 'Normal Node',
        bottlenecks: []
      };

      const bottlenecks = detector.detect(metrics);

      expect(bottlenecks).toHaveLength(0);
    });

    it('should sort bottlenecks by severity', () => {
      const nodeExecutions = new Map<string, NodeExecutionMetrics>();
      nodeExecutions.set('Low Severity Node', {
        nodeName: 'Low Severity Node',
        nodeType: 'n8n-nodes-base.function',
        executionTime: 300,
        executionCount: 1,
        errorCount: 0,
        successCount: 1,
        averageExecutionTime: 100,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      });
      nodeExecutions.set('High Severity Node', {
        nodeName: 'High Severity Node',
        nodeType: 'n8n-nodes-base.httpRequest',
        executionTime: 1000,
        executionCount: 1,
        errorCount: 0,
        successCount: 1,
        averageExecutionTime: 100,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      });
      nodeExecutions.set('Medium Severity Node', {
        nodeName: 'Medium Severity Node',
        nodeType: 'n8n-nodes-base.function',
        executionTime: 500,
        executionCount: 1,
        errorCount: 0,
        successCount: 1,
        averageExecutionTime: 100,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      });

      const metrics: WorkflowMetrics = {
        totalExecutionTime: 1800,
        nodeExecutions,
        connectionCount: 2,
        nodeCount: 3,
        averageNodeExecutionTime: 600,
        longestRunningNode: 'High Severity Node',
        bottlenecks: []
      };

      const bottlenecks = detector.detect(metrics);

      expect(bottlenecks).toHaveLength(3);
      expect(bottlenecks[0].severity).toBe('high');
      expect(bottlenecks[1].severity).toBe('medium');
      expect(bottlenecks[2].severity).toBe('low');
    });
  });

  describe('generateSuggestions', () => {
    it('should generate parallel execution suggestions for suitable nodes', () => {
      const nodeMetrics: NodeExecutionMetrics = {
        nodeName: 'HTTP Node',
        nodeType: 'n8n-nodes-base.httpRequest',
        executionTime: 1000,
        executionCount: 5,
        errorCount: 0,
        successCount: 5,
        averageExecutionTime: 200,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      };

      const metrics: WorkflowMetrics = {
        totalExecutionTime: 1000,
        nodeExecutions: new Map([['HTTP Node', nodeMetrics]]),
        connectionCount: 0,
        nodeCount: 1,
        averageNodeExecutionTime: 1000,
        longestRunningNode: 'HTTP Node',
        bottlenecks: []
      };

      const bottlenecks = detector.detect(metrics);

      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].suggestions).toHaveLength(3);
      expect(bottlenecks[0].suggestions[0].type).toBe('parallelExecution');
      expect(bottlenecks[0].suggestions[1].type).toBe('caching');
      expect(bottlenecks[0].suggestions[2].type).toBe('batchProcessing');
    });

    it('should generate error handling suggestions for nodes with errors', () => {
      const nodeMetrics: NodeExecutionMetrics = {
        nodeName: 'Error Node',
        nodeType: 'n8n-nodes-base.httpRequest',
        executionTime: 100,
        executionCount: 10,
        errorCount: 6,
        successCount: 4,
        averageExecutionTime: 10,
        inputDataSize: 1000,
        outputDataSize: 1000,
        isBottleneck: false
      };

      const metrics: WorkflowMetrics = {
        totalExecutionTime: 100,
        nodeExecutions: new Map([['Error Node', nodeMetrics]]),
        connectionCount: 0,
        nodeCount: 1,
        averageNodeExecutionTime: 100,
        longestRunningNode: 'Error Node',
        bottlenecks: []
      };

      const bottlenecks = detector.detect(metrics);

      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].suggestions).toHaveLength(1);
      expect(bottlenecks[0].suggestions[0].type).toBe('errorHandling');
    });

    it('should generate data size optimization suggestions for nodes with large data', () => {
      const nodeMetrics: NodeExecutionMetrics = {
        nodeName: 'Large Data Node',
        nodeType: 'n8n-nodes-base.function',
        executionTime: 100,
        executionCount: 1,
        errorCount: 0,
        successCount: 1,
        averageExecutionTime: 100,
        inputDataSize: 2 * 1024 * 1024, // 2MB
        outputDataSize: 1000,
        isBottleneck: false
      };

      const metrics: WorkflowMetrics = {
        totalExecutionTime: 100,
        nodeExecutions: new Map([['Large Data Node', nodeMetrics]]),
        connectionCount: 0,
        nodeCount: 1,
        averageNodeExecutionTime: 100,
        longestRunningNode: 'Large Data Node',
        bottlenecks: []
      };

      const bottlenecks = detector.detect(metrics);

      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].suggestions).toHaveLength(1);
      expect(bottlenecks[0].suggestions[0].type).toBe('connectionOptimization');
    });
  });
});
