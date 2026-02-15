import type { Workflow, INode } from 'n8n-workflow';

/**
 * 工作流解析器
 * 负责解析工作流定义，提取触发节点、数据引用等信息
 */
export class WorkflowParser {
  /**
   * 查找工作流中的触发节点
   * @param workflow 工作流
   * @returns 触发节点列表
   */
  findTriggerNodes(workflow: Workflow): INode[] {
    return workflow.nodes.filter(node => {
      // 检查节点是否为触发器类型
      return node.type.includes('trigger') ||
             node.type.includes('webhook') ||
             node.type.includes('schedule');
    });
  }

  /**
   * 从触发节点中提取目标工作流
   * @param triggerNode 触发节点
   * @returns 目标工作流 ID 列表
   */
  extractTargetWorkflows(triggerNode: INode): string[] {
    const targetWorkflows: string[] = [];

    // 检查节点参数是否包含工作流引用
    if (triggerNode.parameters) {
      const parameters = triggerNode.parameters;

      // 检查常见的工作流引用字段
      const workflowReferenceFields = ['workflowId', 'workflow', 'targetWorkflow', 'workflowReference'];

      for (const field of workflowReferenceFields) {
        if (parameters[field]) {
          const workflowId = this.extractWorkflowId(parameters[field]);
          if (workflowId) {
            targetWorkflows.push(workflowId);
          }
        }
      }

      // 检查参数是否为对象，递归查找
      if (typeof parameters === 'object' && parameters !== null) {
        const nestedWorkflowIds = this.findWorkflowReferencesInObject(parameters);
        targetWorkflows.push(...nestedWorkflowIds);
      }
    }

    return targetWorkflows;
  }

  /**
   * 查找工作流中的数据引用节点
   * @param workflow 工作流
   * @returns 数据引用节点列表
   */
  findDataReferenceNodes(workflow: Workflow): INode[] {
    return workflow.nodes.filter(node => {
      // 检查节点是否包含数据引用
      if (node.parameters) {
        return this.containsDataReference(node.parameters);
      }
      return false;
    });
  }

  /**
   * 从数据引用节点中提取引用的工作流
   * @param referenceNode 数据引用节点
   * @returns 引用的工作流 ID 列表
   */
  extractReferencedWorkflows(referenceNode: INode): string[] {
    const referencedWorkflows: string[] = [];

    if (referenceNode.parameters) {
      const references = this.findWorkflowReferencesInObject(referenceNode.parameters);
      referencedWorkflows.push(...references);
    }

    return referencedWorkflows;
  }

  /**
   * 获取数据引用路径
   * @param referenceNode 数据引用节点
   * @returns 数据引用路径
   */
  getDataReferencePath(referenceNode: INode): string {
    if (referenceNode.parameters) {
      const referencePath = this.findDataReferencePath(referenceNode.parameters);
      if (referencePath) {
        return referencePath;
      }
    }
    return '';
  }

  /**
   * 获取触发器方法
   * @param triggerNode 触发节点
   * @returns 触发方法
   */
  getTriggerMethod(triggerNode: INode): 'webhook' | 'schedule' | 'manual' | undefined {
    const nodeType = triggerNode.type.toLowerCase();

    if (nodeType.includes('webhook')) {
      return 'webhook';
    } else if (nodeType.includes('schedule')) {
      return 'schedule';
    } else if (nodeType.includes('manual')) {
      return 'manual';
    }

    return undefined;
  }

  /**
   * 提取工作流使用的资源
   * @param workflow 工作流
   * @returns 资源名称列表
   */
  extractResources(workflow: Workflow): string[] {
    const resources: Set<string> = new Set();

    workflow.nodes.forEach(node => {
      if (node.parameters) {
        const nodeResources = this.extractResourcesFromNode(node);
        nodeResources.forEach(resource => resources.add(resource));
      }
    });

    return Array.from(resources);
  }

  /**
   * 从节点中提取资源
   * @param node 节点
   * @returns 资源名称列表
   */
  private extractResourcesFromNode(node: INode): string[] {
    const resources: string[] = [];

    // 基于节点类型提取资源
    const nodeType = node.type.toLowerCase();

    // 数据库节点
    if (nodeType.includes('database') || nodeType.includes('sql') || nodeType.includes('db')) {
      if (node.parameters?.connectionId) {
        resources.push(`database_${node.parameters.connectionId}`);
      }
    }

    // API 节点
    if (nodeType.includes('api') || nodeType.includes('http')) {
      if (node.parameters?.url) {
        resources.push(`api_${this.normalizeResourceName(node.parameters.url)}`);
      }
      if (node.parameters?.connectionId) {
        resources.push(`api_connection_${node.parameters.connectionId}`);
      }
    }

    // 文件节点
    if (nodeType.includes('file') || nodeType.includes('storage') || nodeType.includes('s3')) {
      if (node.parameters?.bucket) {
        resources.push(`storage_${node.parameters.bucket}`);
      }
      if (node.parameters?.connectionId) {
        resources.push(`storage_connection_${node.parameters.connectionId}`);
      }
    }

    // 通用连接资源
    if (node.parameters?.connectionId) {
      resources.push(`connection_${node.parameters.connectionId}`);
    }

    return resources;
  }

  /**
   * 提取工作流 ID
   * @param value 可能包含工作流 ID 的值
   * @returns 工作流 ID
   */
  private extractWorkflowId(value: any): string | null {
    if (typeof value === 'string') {
      // 检查是否为有效的工作流 ID 格式
      if (value.length > 10 && /^[a-zA-Z0-9_-]+$/.test(value)) {
        return value;
      }
    } else if (typeof value === 'object' && value !== null) {
      if (value.id) {
        return this.extractWorkflowId(value.id);
      }
    }
    return null;
  }

  /**
   * 在对象中查找工作流引用
   * @param obj 对象
   * @returns 工作流 ID 列表
   */
  private findWorkflowReferencesInObject(obj: any): string[] {
    const workflowIds: string[] = [];

    if (typeof obj !== 'object' || obj === null) {
      return workflowIds;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];

        // 检查键名是否包含工作流相关词汇
        const keyLower = key.toLowerCase();
        if (keyLower.includes('workflow') && value) {
          const workflowId = this.extractWorkflowId(value);
          if (workflowId) {
            workflowIds.push(workflowId);
          }
        }

        // 递归查找
        if (typeof value === 'object' && value !== null) {
          const nestedWorkflowIds = this.findWorkflowReferencesInObject(value);
          workflowIds.push(...nestedWorkflowIds);
        }
      }
    }

    return workflowIds;
  }

  /**
   * 检查对象是否包含数据引用
   * @param obj 对象
   * @returns 是否包含数据引用
   */
  private containsDataReference(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];

        // 检查是否为表达式引用
        if (typeof value === 'string' && (value.includes('{{') || value.includes('$'))) {
          return true;
        }

        // 递归检查
        if (typeof value === 'object' && value !== null) {
          if (this.containsDataReference(value)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 查找数据引用路径
   * @param obj 对象
   * @returns 数据引用路径
   */
  private findDataReferencePath(obj: any, currentPath: string = ''): string | null {
    if (typeof obj !== 'object' || obj === null) {
      return null;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const newPath = currentPath ? `${currentPath}.${key}` : key;

        // 检查是否为表达式引用
        if (typeof value === 'string' && (value.includes('{{') || value.includes('$'))) {
          return `${newPath}: ${value}`;
        }

        // 递归检查
        if (typeof value === 'object' && value !== null) {
          const referencePath = this.findDataReferencePath(value, newPath);
          if (referencePath) {
            return referencePath;
          }
        }
      }
    }

    return null;
  }

  /**
   * 标准化资源名称
   * @param resourceName 资源名称
   * @returns 标准化后的资源名称
   */
  private normalizeResourceName(resourceName: string): string {
    // 移除协议部分
    let normalized = resourceName.replace(/^https?:\/\//, '');

    // 移除路径部分
    normalized = normalized.split('/')[0];

    // 移除特殊字符
    normalized = normalized.replace(/[^a-zA-Z0-9_-]/g, '_');

    // 限制长度
    return normalized.substring(0, 50);
  }

  /**
   * 解析工作流触发条件
   * @param workflow 工作流
   * @returns 触发条件
   */
  parseTriggerConditions(workflow: Workflow): any {
    const triggerNodes = this.findTriggerNodes(workflow);

    return triggerNodes.map(node => {
      const triggerMethod = this.getTriggerMethod(node);
      const parameters = node.parameters || {};

      return {
        nodeId: node.id,
        nodeType: node.type,
        triggerMethod,
        parameters,
        schedule: this.parseScheduleParameters(parameters),
        webhook: this.parseWebhookParameters(parameters),
      };
    });
  }

  /**
   * 解析定时触发器参数
   * @param parameters 节点参数
   * @returns 定时配置
   */
  private parseScheduleParameters(parameters: any): any {
    if (parameters.intervalUnit || parameters.cronExpression) {
      return {
        intervalUnit: parameters.intervalUnit,
        intervalValue: parameters.intervalValue,
        cronExpression: parameters.cronExpression,
        timezone: parameters.timezone,
      };
    }
    return null;
  }

  /**
   * 解析 Webhook 触发器参数
   * @param parameters 节点参数
   * @returns Webhook 配置
   */
  private parseWebhookParameters(parameters: any): any {
    if (parameters.path || parameters.httpMethod) {
      return {
        path: parameters.path,
        httpMethod: parameters.httpMethod,
        responseMode: parameters.responseMode,
        authentication: parameters.authentication,
      };
    }
    return null;
  }

  /**
   * 分析工作流执行顺序
   * @param workflow 工作流
   * @returns 执行顺序分析
   */
  analyzeExecutionOrder(workflow: Workflow): any {
    // 构建节点依赖图
    const nodeDependencies = new Map<string, string[]>();

    // 初始化每个节点的依赖
    workflow.nodes.forEach(node => {
      nodeDependencies.set(node.id, []);
    });

    // 分析连接依赖
    workflow.connections.forEach(connection => {
      connection.outputs.forEach(output => {
        output.targets.forEach(target => {
          nodeDependencies.get(target.nodeId)?.push(connection.nodeId);
        });
      });
    });

    // 拓扑排序
    const executionOrder = this.topologicalSort(nodeDependencies);

    return {
      nodeDependencies: Object.fromEntries(nodeDependencies),
      executionOrder,
      criticalPath: this.findCriticalPath(workflow, executionOrder),
    };
  }

  /**
   * 拓扑排序
   * @param dependencies 节点依赖图
   * @returns 排序后的节点 ID 列表
   */
  private topologicalSort(dependencies: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) {
        throw new Error('Circular dependency detected');
      }

      if (!visited.has(nodeId)) {
        temp.add(nodeId);

        const nodeDeps = dependencies.get(nodeId) || [];
        for (const depNodeId of nodeDeps) {
          visit(depNodeId);
        }

        temp.delete(nodeId);
        visited.add(nodeId);
        result.push(nodeId);
      }
    };

    dependencies.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    });

    return result;
  }

  /**
   * 查找关键路径
   * @param workflow 工作流
   * @param executionOrder 执行顺序
   * @returns 关键路径节点 ID 列表
   */
  private findCriticalPath(workflow: Workflow, executionOrder: string[]): string[] {
    // 简化实现，返回执行顺序作为关键路径
    // 实际实现应该基于节点执行时间和依赖关系计算
    return executionOrder;
  }
}
