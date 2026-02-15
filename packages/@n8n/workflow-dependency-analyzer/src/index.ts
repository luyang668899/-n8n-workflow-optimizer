export * from './types';
export * from './core/dependency-analyzer';
export * from './core/dependency-strength-calculator';
export * from './parser/workflow-parser';
export * from './visualization/dependency-visualizer';

/**
 * 工作流依赖分析器
 * 提供工作流依赖关系分析、可视化和优化建议功能
 */
export * as WorkflowDependencyAnalyzer from './core/dependency-analyzer';

/**
 * 依赖强度计算器
 * 计算不同类型依赖的强度值
 */
export * as DependencyStrengthCalculator from './core/dependency-strength-calculator';

/**
 * 工作流解析器
 * 解析工作流定义，提取触发节点、数据引用等信息
 */
export * as WorkflowParser from './parser/workflow-parser';

/**
 * 依赖可视化器
 * 生成依赖图的可视化展示
 */
export * as DependencyVisualizer from './visualization/dependency-visualizer';
