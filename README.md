# n8n Workflow Optimizer

A comprehensive performance optimization system for n8n workflows, designed to improve workflow efficiency, resource utilization, and overall health.

## 项目概述

n8n Workflow Optimizer 是一个专为 n8n 工作流设计的性能优化系统，旨在通过智能调度、性能分析和健康评估等功能，帮助用户构建更高效、更可靠的自动化工作流。

### 核心价值

- **提升性能**：通过智能调度和优化建议，显著提高工作流执行速度
- **降低资源消耗**：优化资源分配，减少系统负载
- **增强可靠性**：通过健康评估，提前发现并解决潜在问题
- **简化管理**：提供统一的优化接口和详细的分析报告

## 核心功能

### 1. 智能调度系统

- **动态调度算法**：基于工作流复杂度和资源使用情况自动调整执行计划
- **实时资源监控**：持续监控系统资源使用状态
- **工作流特征提取**：分析工作流结构和执行模式
- **最优执行时间计算**：根据历史数据和系统状态预测最佳执行时机

### 2. 性能比较模块

- **工作流执行效率基准测试**：量化工作流性能指标
- **多版本性能比较**：对比不同版本工作流的执行效率
- **性能数据统计分析**：生成详细的性能报告
- **性能历史追踪**：记录并分析性能变化趋势

### 3. 健康评分系统

- **多维度工作流健康评估**：从多个角度评估工作流质量
- **健康等级计算**：使用 A-F 等级系统直观表示健康状态
- **可操作的改进建议**：基于分析结果提供具体优化建议
- **健康趋势分析**：跟踪工作流健康状态的变化

### 4. 自动优化功能

- **智能参数调整**：自动优化工作流配置参数
- **节点执行顺序优化**：重新排序节点执行顺序以提高效率
- **资源分配优化**：根据工作流需求动态分配资源

### 5. AI 辅助优化

- **基于 LangChain 的智能分析**：利用 AI 技术分析工作流模式
- **预测性优化建议**：根据历史数据预测潜在问题并提供解决方案
- **自然语言交互**：通过自然语言查询工作流状态和优化建议

## 安装方法

### 环境要求

- Node.js 18.0.0 或更高版本
- npm 9.0.0 或更高版本
- pnpm 8.0.0 或更高版本（推荐）
- n8n 1.0.0 或更高版本

### 安装步骤

#### 通过 pnpm 安装（推荐，适用于 monorepo）

```bash
# 克隆仓库
git clone https://github.com/luyang668899/-n8n-workflow-optimizer.git
cd -n8n-workflow-optimizer

# 安装依赖
pnpm install

# 构建项目
pnpm build
```

#### 通过 npm 安装

```bash
# 安装为依赖
npm install @n8n/workflow-performance-optimizer

# 或全局安装
npm install -g @n8n/workflow-performance-optimizer
```

#### 通过 yarn 安装

```bash
yarn add @n8n/workflow-performance-optimizer
```

## 使用说明

### 基本使用

```typescript
import { WorkflowPerformanceOptimizer } from '@n8n/workflow-performance-optimizer';

// 获取优化器实例
const optimizer = WorkflowPerformanceOptimizer.getInstance();

// 示例工作流
const workflow = {
  id: 'test-workflow',
  name: 'Test Workflow',
  nodes: {
    // 工作流节点
  },
  connectionsBySourceNode: {
    // 工作流连接
  }
};

// 1. 智能调度
const scheduleResult = await optimizer.scheduler.schedule(workflow);
console.log('调度结果:', scheduleResult);

// 2. 性能基准测试
const benchmarkResult = await optimizer.comparator.runBenchmark(workflow, {
  iterations: 5,
  concurrency: 1,
  name: '测试基准测试'
});
console.log('基准测试结果:', benchmarkResult);

// 3. 健康评估
const healthScore = await optimizer.health.calculateScore(workflow);
console.log('健康评分:', healthScore);

const healthReport = await optimizer.health.getHealthReport(workflow.id);
console.log('健康报告:', healthReport);

// 4. 综合分析
const analysisResult = await optimizer.analyzeWorkflow(workflow);
console.log('综合分析结果:', analysisResult);
```

### 高级使用

#### 智能调度

```typescript
// 获取工作流特征
const features = await optimizer.scheduler.getWorkflowFeatures(workflow);
console.log('工作流特征:', features);

// 获取资源使用情况
const resourceUsage = await optimizer.scheduler.getResourceUsage();
console.log('资源使用情况:', resourceUsage);

// 重新调度工作流
const rescheduleResult = await optimizer.scheduler.reschedule('workflow-id');
console.log('重新调度结果:', rescheduleResult);
```

#### 性能比较

```typescript
// 比较多个版本
const comparisonResult = await optimizer.comparator.compareVersions('workflow-id', ['v1', 'v2']);
console.log('版本比较:', comparisonResult);

// 获取历史性能数据
const history = await optimizer.comparator.getHistoricalData('workflow-id', 10);
console.log('性能历史:', history);
```

#### 健康评估

```typescript
// 获取改进建议
const suggestions = await optimizer.health.getImprovementSuggestions('workflow-id');
console.log('改进建议:', suggestions);

// 分析健康趋势
const trend = await optimizer.health.analyzeHealthTrend('workflow-id', 7);
console.log('健康趋势:', trend);

// 获取评分历史
const scoreHistory = await optimizer.health.getScoreHistory('workflow-id', 10);
console.log('评分历史:', scoreHistory);
```

## 版本信息

### 当前版本

**v1.0.0**

### 更新日志

#### v1.0.0 (2026-02-15)

- ✨ 初始版本发布
- 🚀 实现智能调度系统
- 📊 实现性能比较模块
- 🩺 实现健康评分系统
- 🤖 实现 AI 辅助优化功能
- 📈 实现自动优化功能
- 📚 完善文档和使用示例

## 项目结构

```
├── packages/
│   ├── @n8n/
│   │   ├── workflow-performance-optimizer/  # 核心优化器包
│   │   ├── workflow-optimizer/               # 基础优化器模块
│   │   ├── workflow-optimizer-dashboard/     # 优化器仪表板
│   │   ├── workflow-auto-optimizer/          # 自动优化模块
│   │   └── workflow-ai-optimizer/            # AI 优化模块
├── README.md                                 # 项目文档
├── package.json                              # 项目配置
└── pnpm-workspace.yaml                       # 工作区配置
```

## 配置选项

### 环境变量

| 环境变量 | 描述 | 默认值 |
|---------|------|-------|
| `N8N_PERFORMANCE_OPTIMIZER_ENABLED` | 启用/禁用性能优化器 | `true` |
| `N8N_PERFORMANCE_OPTIMIZER_MAX_SCHEDULES` | 最大维护的调度数量 | `100` |
| `N8N_PERFORMANCE_OPTIMIZER_CLEANUP_INTERVAL` | 清理间隔（毫秒） | `300000` (5分钟) |
| `N8N_PERFORMANCE_OPTIMIZER_HISTORY_LIMIT` | 保留的历史记录最大数量 | `50` |

## 性能考虑

- **资源监控**：优化器会定期监控系统资源，对系统性能影响最小
- **缓存机制**：使用缓存避免重复计算，提高重复操作的性能
- **基准测试**：运行基准测试可能会消耗较多资源，尤其是对于复杂工作流
- **内存使用**：优化器维护内存缓存以提高性能，对于大型部署请监控内存使用

## 测试

```bash
# 运行单元测试
pnpm test

# 运行带覆盖率的测试
pnpm test:coverage

# 运行代码检查
pnpm lint

# 运行代码格式化
pnpm format
```

## 贡献

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 运行测试确保代码质量
5. 提交拉取请求

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 支持

如有问题、建议或功能请求，请在仓库中打开 issue 或联系 n8n 团队。

---

**n8n Workflow Optimizer** - 让您的工作流更智能、更高效、更可靠！