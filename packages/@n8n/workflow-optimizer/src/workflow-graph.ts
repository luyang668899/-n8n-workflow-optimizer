import type { Workflow, INode } from 'n8n-workflow';
import { GraphNode, WorkflowGraph } from './types';

export class WorkflowGraphBuilder {
  /**
   * Build workflow graph from workflow definition
   */
  build(workflow: Workflow): WorkflowGraph {
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, string[]>();
    const entryNodes: string[] = [];
    const exitNodes: string[] = [];

    // Build nodes
    Object.values(workflow.nodes).forEach(node => {
      if (!node.disabled) {
        nodes.set(node.name, {
          id: node.name,
          name: node.name,
          type: node.type,
          metrics: {
            nodeName: node.name,
            nodeType: node.type,
            executionTime: 0,
            executionCount: 0,
            errorCount: 0,
            successCount: 0,
            averageExecutionTime: 0,
            inputDataSize: 0,
            outputDataSize: 0,
            isBottleneck: false
          },
          children: [],
          parents: [],
          depth: 0
        });
      }
    });

    // Build edges
    Object.entries(workflow.connectionsBySourceNode).forEach(([sourceNode, connections]) => {
      if (!nodes.has(sourceNode)) return;

      const children: string[] = [];

      Object.values(connections).forEach(typeConnections => {
        Object.values(typeConnections).forEach(indexConnections => {
          indexConnections.forEach(connection => {
            if (nodes.has(connection.node)) {
              children.push(connection.node);

              // Update parent references
              const targetNode = nodes.get(connection.node);
              if (targetNode) {
                targetNode.parents.push(sourceNode);
                nodes.set(connection.node, targetNode);
              }
            }
          });
        });
      });

      edges.set(sourceNode, children);

      // Update child references
      const sourceGraphNode = nodes.get(sourceNode);
      if (sourceGraphNode) {
        sourceGraphNode.children = children;
        nodes.set(sourceNode, sourceGraphNode);
      }
    });

    // Find entry and exit nodes
    nodes.forEach((node, nodeName) => {
      if (node.parents.length === 0) {
        entryNodes.push(nodeName);
      }
      if (node.children.length === 0) {
        exitNodes.push(nodeName);
      }
    });

    // Calculate node depths
    this.calculateDepths(nodes, entryNodes);

    // Find critical path
    const criticalPath = this.findCriticalPath(nodes, edges, entryNodes, exitNodes);

    return {
      nodes,
      edges,
      entryNodes,
      exitNodes,
      criticalPath
    };
  }

  /**
   * Calculate node depths using BFS
   */
  private calculateDepths(nodes: Map<string, GraphNode>, entryNodes: string[]): void {
    const queue = [...entryNodes];

    entryNodes.forEach(nodeName => {
      const node = nodes.get(nodeName);
      if (node) {
        node.depth = 0;
        nodes.set(nodeName, node);
      }
    });

    while (queue.length > 0) {
      const currentNodeName = queue.shift()!;
      const currentNode = nodes.get(currentNodeName);

      if (!currentNode) continue;

      currentNode.children.forEach(childName => {
        const childNode = nodes.get(childName);
        if (childNode) {
          const newDepth = currentNode.depth + 1;
          if (newDepth > childNode.depth) {
            childNode.depth = newDepth;
            nodes.set(childName, childNode);
            queue.push(childName);
          }
        }
      });
    }
  }

  /**
   * Find critical path in workflow graph
   */
  private findCriticalPath(
    nodes: Map<string, GraphNode>,
    edges: Map<string, string[]>,
    entryNodes: string[],
    exitNodes: string[]
  ): string[] {
    // For now, return the longest path based on node depth
    // In a real implementation, this would use execution time

    let maxDepth = -1;
    let deepestNodes: string[] = [];

    nodes.forEach((node, nodeName) => {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
        deepestNodes = [nodeName];
      } else if (node.depth === maxDepth) {
        deepestNodes.push(nodeName);
      }
    });

    // Find path from entry to deepest node
    const criticalPaths: string[][] = [];

    deepestNodes.forEach(deepNode => {
      const path = this.findPathToNode(nodes, deepNode);
      if (path.length > 0) {
        criticalPaths.push(path);
      }
    });

    // Return the longest path
    if (criticalPaths.length > 0) {
      criticalPaths.sort((a, b) => b.length - a.length);
      return criticalPaths[0];
    }

    return [];
  }

  /**
   * Find path from entry node to target node
   */
  private findPathToNode(nodes: Map<string, GraphNode>, targetNodeName: string): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    const dfs = (nodeName: string): boolean => {
      if (visited.has(nodeName)) return false;
      visited.add(nodeName);

      path.push(nodeName);

      if (nodeName === targetNodeName) {
        return true;
      }

      const node = nodes.get(nodeName);
      if (node) {
        for (const childName of node.children) {
          if (dfs(childName)) {
            return true;
          }
        }
      }

      path.pop();
      return false;
    };

    // Try all entry nodes
    const entryNodes = Array.from(nodes.values())
      .filter(node => node.parents.length === 0)
      .map(node => node.name);

    for (const entryNode of entryNodes) {
      if (dfs(entryNode)) {
        return path;
      }
      path.length = 0;
      visited.clear();
    }

    return [];
  }

  /**
   * Calculate graph metrics
   */
  calculateMetrics(graph: WorkflowGraph): void {
    // Calculate average depth
    let totalDepth = 0;
    graph.nodes.forEach(node => {
      totalDepth += node.depth;
    });
    const averageDepth = graph.nodes.size > 0 ? totalDepth / graph.nodes.size : 0;

    // Calculate node centrality
    this.calculateNodeCentrality(graph);
  }

  /**
   * Calculate node centrality
   */
  private calculateNodeCentrality(graph: WorkflowGraph): void {
    // Implementation of betweenness centrality or other centrality measures
    // This can help identify important nodes in the workflow
  }

  /**
   * Detect cycles in workflow graph
   */
  detectCycles(graph: WorkflowGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeName: string): void => {
      if (!visited.has(nodeName)) {
        visited.add(nodeName);
        recursionStack.add(nodeName);
        path.push(nodeName);

        const node = graph.nodes.get(nodeName);
        if (node) {
          for (const childName of node.children) {
            if (!visited.has(childName)) {
              dfs(childName);
            } else if (recursionStack.has(childName)) {
              // Found a cycle
              const cycleStartIndex = path.indexOf(childName);
              if (cycleStartIndex !== -1) {
                cycles.push([...path.slice(cycleStartIndex), childName]);
              }
            }
          }
        }
      }

      recursionStack.delete(nodeName);
      path.pop();
    };

    // Check all nodes
    graph.nodes.forEach((_, nodeName) => {
      if (!visited.has(nodeName)) {
        dfs(nodeName);
      }
    });

    return cycles;
  }

  /**
   * Find parallelization opportunities
   */
  findParallelizationOpportunities(graph: WorkflowGraph): string[][] {
    const opportunities: string[][] = [];
    const processed = new Set<string>();

    // Find nodes with multiple independent children
    graph.nodes.forEach((node, nodeName) => {
      if (node.children.length > 1) {
        const independentGroups: string[][] = [];
        const childDependencies = new Map<string, Set<string>>();

        // Check if children have dependencies between each other
        node.children.forEach(childName => {
          const child = graph.nodes.get(childName);
          if (child) {
            const dependencies = new Set<string>();
            this.collectDependencies(child, graph, dependencies);
            childDependencies.set(childName, dependencies);
          }
        });

        // Group independent children
        node.children.forEach(childName => {
          if (!processed.has(childName)) {
            const group = [childName];
            processed.add(childName);

            node.children.forEach(otherChildName => {
              if (childName !== otherChildName && !processed.has(otherChildName)) {
                const hasDependency = this.checkDependency(
                  childDependencies.get(childName)!,
                  childDependencies.get(otherChildName)!
                );

                if (!hasDependency) {
                  group.push(otherChildName);
                  processed.add(otherChildName);
                }
              }
            });

            if (group.length > 1) {
              opportunities.push(group);
            }
          }
        });
      }
    });

    return opportunities;
  }

  /**
   * Collect all dependencies for a node
   */
  private collectDependencies(
    node: GraphNode,
    graph: WorkflowGraph,
    dependencies: Set<string>
  ): void {
    node.parents.forEach(parentName => {
      if (!dependencies.has(parentName)) {
        dependencies.add(parentName);
        const parentNode = graph.nodes.get(parentName);
        if (parentNode) {
          this.collectDependencies(parentNode, graph, dependencies);
        }
      }
    });
  }

  /**
   * Check if two nodes have dependencies
   */
  private checkDependency(
    dependencies1: Set<string>,
    dependencies2: Set<string>
  ): boolean {
    for (const dep of dependencies1) {
      if (dependencies2.has(dep)) {
        return true;
      }
    }
    return false;
  }
}
