import fs from 'fs';
import path from 'path';
import { createMonitoringManager } from '../core/monitoring-manager';

/**
 * Grafana 仪表板生成器
 * 负责生成和导出 Grafana 仪表板模板
 */
export class GrafanaDashboardGenerator {
  private config: any;

  /**
   * 构造函数
   * @param config Grafana 配置选项
   */
  constructor(config: any) {
    this.config = config;
  }

  /**
   * 生成 Grafana 仪表板
   */
  async generateDashboards(): Promise<void> {
    // 确保导出目录存在
    this.ensureExportDirectoryExists();

    // 生成工作流性能仪表板
    await this.generateWorkflowPerformanceDashboard();

    // 生成系统资源仪表板
    await this.generateSystemResourceDashboard();

    // 生成节点性能仪表板
    await this.generateNodePerformanceDashboard();

    // 生成告警仪表板
    await this.generateAlertDashboard();

    console.log('Grafana dashboards generated successfully');
  }

  /**
   * 确保导出目录存在
   */
  private ensureExportDirectoryExists(): void {
    if (!fs.existsSync(this.config.exportPath)) {
      fs.mkdirSync(this.config.exportPath, { recursive: true });
    }
  }

  /**
   * 生成工作流性能仪表板
   */
  private async generateWorkflowPerformanceDashboard(): Promise<void> {
    const dashboard = {
      id: null,
      uid: 'n8n-workflow-performance',
      title: 'n8n Workflow Performance',
      tags: ['n8n', 'performance', 'workflow'],
      timezone: 'browser',
      schemaVersion: 36,
      version: 1,
      refresh: '5s',
      panels: [
        {
          id: 1,
          title: 'Workflow Executions',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 0
          },
          targets: [
            {
              expr: 'rate(n8n_workflow_executions_total{status="success"}[5m])',
              legendFormat: 'Success',
              refId: 'A'
            },
            {
              expr: 'rate(n8n_workflow_executions_total{status="error"}[5m])',
              legendFormat: 'Error',
              refId: 'B'
            }
          ],
          yaxes: [
            {
              format: 'ops',
              label: 'Executions / Second',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 2,
          title: 'Workflow Execution Duration',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 12,
            y: 0
          },
          targets: [
            {
              expr: 'histogram_quantile(0.95, sum(rate(n8n_workflow_execution_duration_seconds_bucket[5m])) by (le, workflow_name))',
              legendFormat: '{{workflow_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 's',
              label: 'Duration (s)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 3,
          title: 'Workflow Memory Usage',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 8
          },
          targets: [
            {
              expr: 'n8n_workflow_memory_usage_bytes / 1024 / 1024',
              legendFormat: '{{workflow_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'MiB',
              label: 'Memory Usage (MiB)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 4,
          title: 'Workflow CPU Usage',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 12,
            y: 8
          },
          targets: [
            {
              expr: 'n8n_workflow_cpu_usage_percent',
              legendFormat: '{{workflow_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'percentunit',
              label: 'CPU Usage (%)',
              logBase: 1,
              max: '100',
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 5,
          title: 'Workflow Data Processed',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 24,
            x: 0,
            y: 16
          },
          targets: [
            {
              expr: 'rate(n8n_workflow_data_processed_bytes[5m]) / 1024 / 1024',
              legendFormat: '{{workflow_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'MiB',
              label: 'Data Processed (MiB/s)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        }
      ]
    };

    const outputPath = path.join(this.config.exportPath, 'workflow-performance-dashboard.json');
    fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
    console.log(`Generated workflow performance dashboard: ${outputPath}`);
  }

  /**
   * 生成系统资源仪表板
   */
  private async generateSystemResourceDashboard(): Promise<void> {
    const dashboard = {
      id: null,
      uid: 'n8n-system-resources',
      title: 'n8n System Resources',
      tags: ['n8n', 'system', 'resources'],
      timezone: 'browser',
      schemaVersion: 36,
      version: 1,
      refresh: '5s',
      panels: [
        {
          id: 1,
          title: 'System Memory Usage',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 0
          },
          targets: [
            {
              expr: 'n8n_system_memory_usage_bytes / 1024 / 1024',
              legendFormat: '{{component}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'MiB',
              label: 'Memory Usage (MiB)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 2,
          title: 'System CPU Usage',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 12,
            y: 0
          },
          targets: [
            {
              expr: 'n8n_system_cpu_usage_percent',
              legendFormat: '{{component}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'percentunit',
              label: 'CPU Usage (%)',
              logBase: 1,
              max: '100',
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 3,
          title: 'System Disk Usage',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 8
          },
          targets: [
            {
              expr: 'n8n_system_disk_usage_bytes / 1024 / 1024 / 1024',
              legendFormat: '{{mount_point}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'GiB',
              label: 'Disk Usage (GiB)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 4,
          title: 'System Network Traffic',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 12,
            y: 8
          },
          targets: [
            {
              expr: 'rate(n8n_system_network_bytes_total{direction="inbound"}[5m]) / 1024 / 1024',
              legendFormat: 'Inbound',
              refId: 'A'
            },
            {
              expr: 'rate(n8n_system_network_bytes_total{direction="outbound"}[5m]) / 1024 / 1024',
              legendFormat: 'Outbound',
              refId: 'B'
            }
          ],
          yaxes: [
            {
              format: 'MiB',
              label: 'Network Traffic (MiB/s)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        }
      ]
    };

    const outputPath = path.join(this.config.exportPath, 'system-resources-dashboard.json');
    fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
    console.log(`Generated system resources dashboard: ${outputPath}`);
  }

  /**
   * 生成节点性能仪表板
   */
  private async generateNodePerformanceDashboard(): Promise<void> {
    const dashboard = {
      id: null,
      uid: 'n8n-node-performance',
      title: 'n8n Node Performance',
      tags: ['n8n', 'performance', 'node'],
      timezone: 'browser',
      schemaVersion: 36,
      version: 1,
      refresh: '5s',
      panels: [
        {
          id: 1,
          title: 'Node Executions',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 0
          },
          targets: [
            {
              expr: 'rate(n8n_node_executions_total[5m])',
              legendFormat: '{{node_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'ops',
              label: 'Executions / Second',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 2,
          title: 'Node Execution Duration',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 12,
            y: 0
          },
          targets: [
            {
              expr: 'histogram_quantile(0.95, sum(rate(n8n_node_execution_duration_seconds_bucket[5m])) by (le, node_name))',
              legendFormat: '{{node_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 's',
              label: 'Duration (s)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 3,
          title: 'Node Input Data Size',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 8
          },
          targets: [
            {
              expr: 'rate(n8n_node_input_data_size_bytes[5m]) / 1024 / 1024',
              legendFormat: '{{node_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'MiB',
              label: 'Input Data (MiB/s)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 4,
          title: 'Node Output Data Size',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 12,
            y: 8
          },
          targets: [
            {
              expr: 'rate(n8n_node_output_data_size_bytes[5m]) / 1024 / 1024',
              legendFormat: '{{node_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'MiB',
              label: 'Output Data (MiB/s)',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        }
      ]
    };

    const outputPath = path.join(this.config.exportPath, 'node-performance-dashboard.json');
    fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
    console.log(`Generated node performance dashboard: ${outputPath}`);
  }

  /**
   * 生成告警仪表板
   */
  private async generateAlertDashboard(): Promise<void> {
    const dashboard = {
      id: null,
      uid: 'n8n-alerts',
      title: 'n8n Alerts',
      tags: ['n8n', 'alerts'],
      timezone: 'browser',
      schemaVersion: 36,
      version: 1,
      refresh: '5s',
      panels: [
        {
          id: 1,
          title: 'Workflow Execution Errors',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 0
          },
          targets: [
            {
              expr: 'rate(n8n_workflow_executions_failed_total[5m])',
              legendFormat: '{{workflow_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'ops',
              label: 'Errors / Second',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 2,
          title: 'Node Execution Errors',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 12,
            y: 0
          },
          targets: [
            {
              expr: 'rate(n8n_node_executions_failed_total[5m])',
              legendFormat: '{{node_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'ops',
              label: 'Errors / Second',
              logBase: 1,
              max: null,
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 3,
          title: 'High Memory Usage Alerts',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 8
          },
          targets: [
            {
              expr: 'n8n_workflow_memory_usage_bytes / 1024 / 1024 > 500',
              legendFormat: '{{workflow_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'boolean',
              label: 'Alert Status',
              logBase: 1,
              max: '1',
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        },
        {
          id: 4,
          title: 'High CPU Usage Alerts',
          type: 'graph',
          gridPos: {
            h: 8,
            w: 12,
            x: 12,
            y: 8
          },
          targets: [
            {
              expr: 'n8n_workflow_cpu_usage_percent > 80',
              legendFormat: '{{workflow_name}}',
              refId: 'A'
            }
          ],
          yaxes: [
            {
              format: 'boolean',
              label: 'Alert Status',
              logBase: 1,
              max: '1',
              min: '0'
            },
            {
              format: 'short',
              label: null,
              logBase: 1,
              max: null,
              min: null
            }
          ]
        }
      ]
    };

    const outputPath = path.join(this.config.exportPath, 'alerts-dashboard.json');
    fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
    console.log(`Generated alerts dashboard: ${outputPath}`);
  }

  /**
   * 导出仪表板到指定路径
   * @param dashboard 仪表板配置
   * @param filename 文件名
   */
  private exportDashboard(dashboard: any, filename: string): void {
    const outputPath = path.join(this.config.exportPath, filename);
    fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
    console.log(`Exported dashboard: ${outputPath}`);
  }

  /**
   * 获取仪表板模板
   * @param templateName 模板名称
   * @returns 仪表板模板
   */
  private getDashboardTemplate(templateName: string): any {
    const templatePath = path.join(this.config.dashboardTemplatePath, `${templateName}.json`);
    if (fs.existsSync(templatePath)) {
      return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    }
    return null;
  }

  /**
   * 验证仪表板配置
   * @param dashboard 仪表板配置
   * @returns 是否有效
   */
  private validateDashboard(dashboard: any): boolean {
    return (
      dashboard &&
      dashboard.title &&
      dashboard.panels &&
      Array.isArray(dashboard.panels)
    );
  }
}

/**
 * 创建 Grafana 仪表板生成器实例的工厂函数
 * @param config Grafana 配置选项
 * @returns Grafana 仪表板生成器实例
 */
export function createGrafanaDashboardGenerator(config: any): GrafanaDashboardGenerator {
  return new GrafanaDashboardGenerator(config);
}
