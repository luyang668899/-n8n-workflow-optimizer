import React, { useState, useEffect, useCallback } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

import { WebSocketClient } from '@n8n/workflow-monitor/src/frontend/websocket-client'
import type { OptimizationSuggestion } from '@n8n/workflow-ai-optimizer'
import { WorkflowAIOptimizer } from '@n8n/workflow-ai-optimizer'
import type { Workflow } from 'n8n-workflow'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

function App() {
  // State for performance data
  const [performanceData, setPerformanceData] = useState({
    executionTime: [] as number[],
    memoryUsage: [] as number[],
    cpuUsage: [] as number[],
    timestamps: [] as string[],
  })

  // State for optimization suggestions
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([])

  // State for connection status
  const [connected, setConnected] = useState(false)

  // State for loading status
  const [loading, setLoading] = useState(true)

  // State for error messages
  const [error, setError] = useState<string | null>(null)

  // WebSocket client instance
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null)

  // AI optimizer instance
  const [aiOptimizer, setAiOptimizer] = useState<WorkflowAIOptimizer | null>(null)

  // Initialize WebSocket client
  useEffect(() => {
    const client = new WebSocketClient('ws://localhost:5678/n8n-performance-ws')
    setWsClient(client)

    client.connect()
      .then(() => {
        setConnected(true)
        setLoading(false)
        setError(null)
      })
      .catch((err) => {
        setError(`WebSocket connection failed: ${err.message}`)
        setLoading(false)
      })

    // Set up event handlers
    client.on('workflowStart', handleWorkflowStart)
    client.on('workflowEnd', handleWorkflowEnd)
    client.on('nodeEnd', handleNodeEnd)
    client.on('bottleneck', handleBottleneck)
    client.on('error', handleError)

    // Clean up on unmount
    return () => {
      client.disconnect()
    }
  }, [])

  // Initialize AI optimizer
  useEffect(() => {
    const optimizer = new WorkflowAIOptimizer({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
      enableLearning: true,
      enableCaching: true,
      cacheExpiration: 3600000
    })
    setAiOptimizer(optimizer)
  }, [])

  // Handle workflow start event
  const handleWorkflowStart = useCallback((event: any) => {
    console.log('Workflow started:', event)
  }, [])

  // Handle workflow end event
  const handleWorkflowEnd = useCallback((event: any) => {
    console.log('Workflow ended:', event)
    // Request optimization suggestions after workflow completes
    fetchOptimizationSuggestions()
  }, [])

  // Handle node end event
  const handleNodeEnd = useCallback((event: any) => {
    console.log('Node ended:', event)

    // Update performance data
    setPerformanceData(prev => {
      const now = new Date().toLocaleTimeString()
      return {
        executionTime: [...prev.executionTime, event.data.duration || 0].slice(-20),
        memoryUsage: [...prev.memoryUsage, event.data.memoryUsage?.peak || 0].slice(-20),
        cpuUsage: [...prev.cpuUsage, event.data.cpuUsage || 0].slice(-20),
        timestamps: [...prev.timestamps, now].slice(-20),
      }
    })
  }, [])

  // Handle bottleneck event
  const handleBottleneck = useCallback((event: any) => {
    console.log('Bottleneck detected:', event)
    // Could show a notification or update UI
  }, [])

  // Handle error event
  const handleError = useCallback((event: any) => {
    console.error('Error:', event)
    setError(`Error: ${event.data.error.message}`)
  }, [])

  // Fetch optimization suggestions
  const fetchOptimizationSuggestions = useCallback(async () => {
    if (!aiOptimizer) return

    try {
      // In a real implementation, we would get the current workflow
      // For now, we'll use a mock workflow
      const mockWorkflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: [
          {
            id: '1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: { x: 100, y: 100 },
            parameters: {
              method: 'GET',
              url: 'https://api.example.com/data',
              options: {
                timeout: 30000
              }
            }
          },
          {
            id: '2',
            name: 'Function',
            type: 'n8n-nodes-base.function',
            position: { x: 300, y: 100 },
            parameters: {
              functionCode: 'return items.map(item => { item.json.processed = true; return item; });'
            }
          }
        ],
        connections: {
          '1': {
            main: [
              {
                node: '2',
                type: 'main',
                index: 0
              }
            ]
          }
        }
      } as unknown as Workflow

      // Generate suggestions
      const generatedSuggestions = await aiOptimizer.generateSuggestions(mockWorkflow)
      setSuggestions(generatedSuggestions)
    } catch (err) {
      console.error('Error fetching suggestions:', err)
      setError(`Error fetching suggestions: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [aiOptimizer])

  // Handle suggestion action
  const handleSuggestionAction = useCallback((suggestionId: string, action: 'apply' | 'dismiss' | 'details') => {
    console.log(`Action ${action} for suggestion ${suggestionId}`)
    // In a real implementation, we would handle the action
  }, [])

  // Chart data configurations
  const executionTimeData = {
    labels: performanceData.timestamps,
    datasets: [
      {
        label: 'Execution Time (ms)',
        data: performanceData.executionTime,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.1,
      },
    ],
  }

  const memoryUsageData = {
    labels: performanceData.timestamps,
    datasets: [
      {
        label: 'Memory Usage (MB)',
        data: performanceData.memoryUsage,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        tension: 0.1,
      },
    ],
  }

  const cpuUsageData = {
    labels: performanceData.timestamps,
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: performanceData.cpuUsage,
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.5)',
        tension: 0.1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1>n8n Workflow Optimizer Dashboard</h1>
        <div className="status-indicator">
          <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></div>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Metrics grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">
            {performanceData.executionTime.length > 0
              ? performanceData.executionTime[performanceData.executionTime.length - 1].toFixed(2)
              : '0.00'
            }
          </div>
          <div className="metric-label">Execution Time (ms)</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {performanceData.memoryUsage.length > 0
              ? performanceData.memoryUsage[performanceData.memoryUsage.length - 1].toFixed(2)
              : '0.00'
            }
          </div>
          <div className="metric-label">Memory Usage (MB)</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {performanceData.cpuUsage.length > 0
              ? performanceData.cpuUsage[performanceData.cpuUsage.length - 1].toFixed(2)
              : '0.00'
            }
          </div>
          <div className="metric-label">CPU Usage (%)</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{suggestions.length}</div>
          <div className="metric-label">Optimization Suggestions</div>
        </div>
      </div>

      {/* Main content */}
      <div className="dashboard-content">
        {/* Charts section */}
        <div className="charts-section">
          <div className="chart-container">
            <div className="chart-title">Execution Time</div>
            <div style={{ height: '300px' }}>
              <Line options={chartOptions} data={executionTimeData} />
            </div>
          </div>

          <div className="chart-container">
            <div className="chart-title">Memory Usage</div>
            <div style={{ height: '300px' }}>
              <Line options={chartOptions} data={memoryUsageData} />
            </div>
          </div>

          <div className="chart-container">
            <div className="chart-title">CPU Usage</div>
            <div style={{ height: '300px' }}>
              <Line options={chartOptions} data={cpuUsageData} />
            </div>
          </div>
        </div>

        {/* Suggestions section */}
        <div className="suggestions-container">
          <h3>Optimization Suggestions</h3>
          {loading ? (
            <div className="loading-spinner">
              <p>Loading suggestions...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <p>No suggestions available</p>
          ) : (
            suggestions.map((suggestion) => (
              <div key={suggestion.id} className="suggestion-card">
                <div className="suggestion-title">{suggestion.title}</div>
                <div className="suggestion-description">{suggestion.description}</div>
                <div className="suggestion-meta">
                  <span>Priority: {suggestion.priority}</span>
                  <span>Complexity: {suggestion.complexity}</span>
                </div>
                <div className="suggestion-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleSuggestionAction(suggestion.id, 'apply')}
                  >
                    Apply
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSuggestionAction(suggestion.id, 'details')}
                  >
                    Details
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSuggestionAction(suggestion.id, 'dismiss')}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
          <button
            className="btn btn-primary"
            onClick={fetchOptimizationSuggestions}
            style={{ marginTop: '15px', width: '100%' }}
          >
            Refresh Suggestions
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
