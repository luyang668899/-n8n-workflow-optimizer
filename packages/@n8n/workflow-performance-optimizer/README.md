# n8n Workflow Performance Optimizer

A comprehensive performance optimization system for n8n workflows, designed to improve workflow efficiency, resource utilization, and overall health.

## Features

### Core Features (Phase 1)

1. **Intelligent Scheduling System**
   - Dynamic scheduling algorithm based on workflow complexity and resource usage
   - Real-time resource monitoring
   - Workflow feature extraction and analysis
   - Optimal scheduling time calculation

2. **Performance Comparison Module**
   - Workflow execution efficiency benchmarking
   - Multi-version performance comparison
   - Statistical analysis of performance data
   - Performance history tracking

3. **Health Scoring System**
   - Multi-dimensional workflow health assessment
   - Health grade calculation (A-F)
   - Actionable improvement suggestions
   - Health trend analysis

## Installation

```bash
# Install via pnpm (recommended for monorepo)
pnpm add @n8n/workflow-performance-optimizer

# Install via npm
npm install @n8n/workflow-performance-optimizer

# Install via yarn
yarn add @n8n/workflow-performance-optimizer
```

## Usage

### Basic Usage

```typescript
import { WorkflowPerformanceOptimizer } from '@n8n/workflow-performance-optimizer';

// Get optimizer instance
const optimizer = WorkflowPerformanceOptimizer.getInstance();

// Example workflow
const workflow = {
  id: 'test-workflow',
  name: 'Test Workflow',
  nodes: {
    // Workflow nodes
  },
  connectionsBySourceNode: {
    // Workflow connections
  }
};

// 1. Intelligent Scheduling
const scheduleResult = await optimizer.scheduler.schedule(workflow);
console.log('Scheduling result:', scheduleResult);

// 2. Performance Benchmarking
const benchmarkResult = await optimizer.comparator.runBenchmark(workflow, {
  iterations: 5,
  concurrency: 1,
  name: 'Test Benchmark'
});
console.log('Benchmark result:', benchmarkResult);

// 3. Health Assessment
const healthScore = await optimizer.health.calculateScore(workflow);
console.log('Health score:', healthScore);

const healthReport = await optimizer.health.getHealthReport(workflow.id);
console.log('Health report:', healthReport);

// 4. Comprehensive Analysis
const analysisResult = await optimizer.analyzeWorkflow(workflow);
console.log('Comprehensive analysis:', analysisResult);
```

### Advanced Usage

#### Intelligent Scheduling

```typescript
// Get workflow features
const features = await optimizer.scheduler.getWorkflowFeatures(workflow);
console.log('Workflow features:', features);

// Get resource usage
const resourceUsage = await optimizer.scheduler.getResourceUsage();
console.log('Resource usage:', resourceUsage);

// Reschedule a workflow
const rescheduleResult = await optimizer.scheduler.reschedule('workflow-id');
console.log('Rescheduling result:', rescheduleResult);
```

#### Performance Comparison

```typescript
// Compare multiple versions
const comparisonResult = await optimizer.comparator.compareVersions('workflow-id', ['v1', 'v2']);
console.log('Version comparison:', comparisonResult);

// Get historical performance data
const history = await optimizer.comparator.getHistoricalData('workflow-id', 10);
console.log('Performance history:', history);
```

#### Health Assessment

```typescript
// Get improvement suggestions
const suggestions = await optimizer.health.getImprovementSuggestions('workflow-id');
console.log('Improvement suggestions:', suggestions);

// Analyze health trend
const trend = await optimizer.health.analyzeHealthTrend('workflow-id', 7);
console.log('Health trend:', trend);

// Get score history
const scoreHistory = await optimizer.health.getScoreHistory('workflow-id', 10);
console.log('Score history:', scoreHistory);
```

## API Reference

### WorkflowPerformanceOptimizer

The main entry point for the performance optimization system.

#### Methods

- **getInstance(): WorkflowPerformanceOptimizer** - Returns the singleton instance
- **analyzeWorkflow(workflow: Workflow): Promise<AnalysisResult>** - Performs comprehensive workflow analysis
- **close(): void** - Closes all services and cleans up resources

#### Properties

- **scheduler: WorkflowScheduler** - Intelligent scheduling system
- **comparator: PerformanceComparator** - Performance comparison module
- **health: HealthScoringSystem** - Health scoring system

### WorkflowScheduler

#### Methods

- **schedule(workflow: Workflow, options?: ScheduleOptions): Promise<ScheduleResult>**
- **reschedule(workflowId: string, options?: ScheduleOptions): Promise<ScheduleResult>**
- **getSchedule(workflowId: string): Promise<ScheduleInfo | null>**
- **getResourceUsage(): Promise<ResourceUsage>**
- **getWorkflowFeatures(workflow: Workflow): Promise<WorkflowFeatures>**
- **cancelSchedule(workflowId: string): Promise<boolean>**
- **getAllSchedules(): Promise<ScheduleInfo[]>**
- **cleanupSchedules(): Promise<number>**

### PerformanceComparator

#### Methods

- **runBenchmark(workflow: Workflow, options: BenchmarkOptions): Promise<BenchmarkResult>**
- **compareVersions(workflowId: string, versions: string[]): Promise<ComparisonResult>**
- **getHistoricalData(workflowId: string, limit?: number): Promise<PerformanceHistory>**
- **saveBenchmarkResult(result: BenchmarkResult): Promise<boolean>**
- **getBenchmarkResult(workflowId: string, version: string): Promise<BenchmarkResult | null>**

### HealthScoringSystem

#### Methods

- **calculateScore(workflow: Workflow): Promise<HealthScore>**
- **getHealthReport(workflowId: string): Promise<HealthReport>**
- **getScoreHistory(workflowId: string, limit?: number): Promise<ScoreHistory>**
- **getImprovementSuggestions(workflowId: string): Promise<ImprovementSuggestion[]>**
- **saveHealthScore(score: HealthScore): Promise<boolean>**
- **analyzeHealthTrend(workflowId: string, days: number): Promise<TrendAnalysis>**

## Configuration

The performance optimizer can be configured through environment variables:

| Environment Variable | Description | Default Value |
|---------------------|-------------|---------------|
| `N8N_PERFORMANCE_OPTIMIZER_ENABLED` | Enable/disable the performance optimizer | `true` |
| `N8N_PERFORMANCE_OPTIMIZER_MAX_SCHEDULES` | Maximum number of schedules to maintain | `100` |
| `N8N_PERFORMANCE_OPTIMIZER_CLEANUP_INTERVAL` | Cleanup interval in milliseconds | `300000` (5 minutes) |
| `N8N_PERFORMANCE_OPTIMIZER_HISTORY_LIMIT` | Maximum number of history records to keep | `50` |

## Performance Considerations

- **Resource Monitoring**: The optimizer periodically monitors system resources, which may have a minimal impact on system performance.
- **Caching**: The optimizer uses caching to avoid redundant calculations, improving performance for repeated operations.
- **Benchmarking**: Running benchmarks can be resource-intensive, especially for complex workflows. Use appropriate iteration counts.
- **Memory Usage**: The optimizer maintains in-memory caches for performance data. Monitor memory usage for large deployments.

## Testing

```bash
# Run unit tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run linting
pnpm lint

# Run formatting
pnpm format
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests to ensure code quality
5. Submit a pull request

## License

This project is licensed under the [MIT License](LICENSE.md).

## Support

For questions, issues, or feature requests, please open an issue in the repository or contact the n8n team.
