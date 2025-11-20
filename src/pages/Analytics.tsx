// Analytics page with charts for prompt performance visualization

import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { BarChart3, TrendingUp, Target } from 'lucide-react';

export default function Analytics() {
  const { testResults } = useData();
  const [selectedMrn, setSelectedMrn] = useState<string>('all');

  // Get unique MRNs for filter
  const uniqueMrns = useMemo(() => {
    return [...new Set(testResults.map(r => r.mrn))].sort();
  }, [testResults]);

  // Aggregate data by prompt version
  const promptPerformance = useMemo(() => {
    const stats: Record<string, {
      name: string;
      tests: number;
      primaryMatchRate: number;
      cptRecall: number;
      cptPrecision: number;
      avgScore: number;
      timestamp: string;
    }> = {};

    testResults.forEach(result => {
      const promptName = result.prompt_name;
      if (!stats[promptName]) {
        stats[promptName] = {
          name: promptName,
          tests: 0,
          primaryMatchRate: 0,
          cptRecall: 0,
          cptPrecision: 0,
          avgScore: 0,
          timestamp: result.timestamp
        };
      }
      stats[promptName].tests++;
      if (result.primary_match) stats[promptName].primaryMatchRate++;
      stats[promptName].cptRecall += result.cpt_recall;

      // Calculate precision
      const precision = result.pred_cpts.length > 0
        ? (result.pred_cpts.length - result.hallucinated_cpts.length) / result.pred_cpts.length
        : 0;
      stats[promptName].cptPrecision += precision;

      // Update timestamp to latest
      if (result.timestamp > stats[promptName].timestamp) {
        stats[promptName].timestamp = result.timestamp;
      }
    });

    // Calculate averages and sort by timestamp
    return Object.values(stats)
      .map(s => ({
        name: s.name,
        tests: s.tests,
        'Primary Match %': Math.round((s.primaryMatchRate / s.tests) * 100),
        'CPT Recall %': Math.round((s.cptRecall / s.tests) * 100),
        'CPT Precision %': Math.round((s.cptPrecision / s.tests) * 100),
        'Overall Score': Math.round(((s.primaryMatchRate / s.tests + s.cptRecall / s.tests) / 2) * 100),
        timestamp: s.timestamp
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [testResults]);

  // Performance by individual MRN across prompts
  const mrnPerformance = useMemo(() => {
    const mrnStats: Record<string, Record<string, {
      primaryMatch: boolean;
      cptRecall: number;
    }>> = {};

    testResults.forEach(result => {
      if (!mrnStats[result.mrn]) {
        mrnStats[result.mrn] = {};
      }
      // Keep latest result for each prompt
      if (!mrnStats[result.mrn][result.prompt_name] ||
          result.timestamp > mrnStats[result.mrn][result.prompt_name].timestamp) {
        mrnStats[result.mrn][result.prompt_name] = {
          primaryMatch: result.primary_match,
          cptRecall: result.cpt_recall,
          timestamp: result.timestamp
        };
      }
    });

    // Transform to chart data format
    const promptNames = [...new Set(testResults.map(r => r.prompt_name))];

    return Object.entries(mrnStats).map(([mrn, prompts]) => {
      const data: Record<string, string | number> = { mrn };
      promptNames.forEach(pn => {
        if (prompts[pn]) {
          data[pn] = Math.round(((prompts[pn].primaryMatch ? 1 : 0) + prompts[pn].cptRecall) / 2 * 100);
        } else {
          data[pn] = 0;
        }
      });
      return data;
    });
  }, [testResults]);

  // Filtered MRN data for individual analysis
  const selectedMrnData = useMemo(() => {
    if (selectedMrn === 'all') return null;

    const mrnResults = testResults.filter(r => r.mrn === selectedMrn);
    const promptNames = [...new Set(mrnResults.map(r => r.prompt_name))];

    return promptNames.map(pn => {
      const result = mrnResults.find(r => r.prompt_name === pn);
      if (!result) return null;

      return {
        name: pn,
        'Primary Match': result.primary_match ? 100 : 0,
        'CPT Recall %': Math.round(result.cpt_recall * 100),
        'Missed CPTs': result.missed_cpts.length,
        'Extra CPTs': result.hallucinated_cpts.length
      };
    }).filter(Boolean);
  }, [selectedMrn, testResults]);

  // Radar chart data for prompt comparison
  const radarData = useMemo(() => {
    if (promptPerformance.length === 0) return [];

    const metrics = ['Primary Match %', 'CPT Recall %', 'CPT Precision %'];
    return metrics.map(metric => {
      const data: Record<string, string | number> = { metric };
      promptPerformance.forEach(p => {
        data[p.name] = p[metric as keyof typeof p] as number;
      });
      return data;
    });
  }, [promptPerformance]);

  if (testResults.length === 0) {
    return (
      <div className="analytics">
        <header className="page-header">
          <h1>Analytics</h1>
          <p>Visualize prompt performance and improvements</p>
        </header>
        <div className="empty-state">
          <BarChart3 size={48} />
          <h2>No Test Data Yet</h2>
          <p>Run tests in the Prompt Tester to see analytics here.</p>
        </div>
        <style>{analyticsStyles}</style>
      </div>
    );
  }

  return (
    <div className="analytics">
      <header className="page-header">
        <h1>Analytics</h1>
        <p>Visualize prompt performance and improvements</p>
      </header>

      <div className="charts-grid">
        {/* Prompt Version Performance Bar Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <TrendingUp size={20} />
            <h3>Prompt Version Performance</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={promptPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Primary Match %" fill="#3b82f6" />
                <Bar dataKey="CPT Recall %" fill="#22c55e" />
                <Bar dataKey="CPT Precision %" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overall Score Trend Line Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <TrendingUp size={20} />
            <h3>Overall Score Trend</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={promptPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Overall Score"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart for Multi-metric Comparison */}
        {promptPerformance.length > 0 && promptPerformance.length <= 5 && (
          <div className="chart-card">
            <div className="chart-header">
              <Target size={20} />
              <h3>Metric Comparison (Radar)</h3>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" fontSize={12} />
                  <PolarRadiusAxis domain={[0, 100]} />
                  {promptPerformance.map((p, i) => (
                    <Radar
                      key={p.name}
                      name={p.name}
                      dataKey={p.name}
                      stroke={['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'][i % 5]}
                      fill={['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'][i % 5]}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Individual MRN Analysis */}
        <div className="chart-card full-width">
          <div className="chart-header">
            <BarChart3 size={20} />
            <h3>Individual Case Performance</h3>
            <select
              value={selectedMrn}
              onChange={(e) => setSelectedMrn(e.target.value)}
              className="mrn-select"
            >
              <option value="all">All Cases (Heatmap)</option>
              {uniqueMrns.map(mrn => (
                <option key={mrn} value={mrn}>MRN: {mrn}</option>
              ))}
            </select>
          </div>
          <div className="chart-container">
            {selectedMrn === 'all' ? (
              <ResponsiveContainer width="100%" height={Math.max(300, uniqueMrns.length * 40)}>
                <BarChart data={mrnPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="mrn" type="category" width={100} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  {[...new Set(testResults.map(r => r.prompt_name))].map((pn, i) => (
                    <Bar
                      key={pn}
                      dataKey={pn}
                      fill={['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'][i % 6]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : selectedMrnData && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={selectedMrnData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Primary Match" fill="#3b82f6" />
                  <Bar dataKey="CPT Recall %" fill="#22c55e" />
                  <Bar dataKey="Missed CPTs" fill="#ef4444" />
                  <Bar dataKey="Extra CPTs" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="stats-summary">
          <div className="stat-card">
            <span className="stat-value">{promptPerformance.length}</span>
            <span className="stat-label">Prompt Versions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{testResults.length}</span>
            <span className="stat-label">Total Tests</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{uniqueMrns.length}</span>
            <span className="stat-label">Unique Cases</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {promptPerformance.length > 0
                ? promptPerformance[promptPerformance.length - 1]['Overall Score']
                : 0}%
            </span>
            <span className="stat-label">Latest Score</span>
          </div>
          {promptPerformance.length >= 2 && (
            <div className="stat-card">
              <span className={`stat-value ${
                promptPerformance[promptPerformance.length - 1]['Overall Score'] > promptPerformance[0]['Overall Score']
                  ? 'positive'
                  : 'negative'
              }`}>
                {promptPerformance[promptPerformance.length - 1]['Overall Score'] - promptPerformance[0]['Overall Score'] > 0 ? '+' : ''}
                {promptPerformance[promptPerformance.length - 1]['Overall Score'] - promptPerformance[0]['Overall Score']}%
              </span>
              <span className="stat-label">Improvement</span>
            </div>
          )}
        </div>
      </div>

      <style>{analyticsStyles}</style>
    </div>
  );
}

const analyticsStyles = `
  .analytics {
    padding: 32px;
    height: 100vh;
    overflow-y: auto;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .page-header h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 8px;
    color: #1e293b;
  }

  .page-header p {
    color: #64748b;
    margin: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: white;
    border-radius: 12px;
    padding: 64px 32px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    color: #64748b;
  }

  .empty-state h2 {
    margin: 16px 0 8px;
    color: #1e293b;
  }

  .empty-state p {
    margin: 0;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }

  .chart-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .chart-card.full-width {
    grid-column: 1 / -1;
  }

  .chart-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: #1e293b;
  }

  .chart-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    flex: 1;
  }

  .mrn-select {
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    background: white;
  }

  .chart-container {
    width: 100%;
  }

  .stats-summary {
    grid-column: 1 / -1;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .stat-card {
    flex: 1;
    min-width: 120px;
    background: white;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 700;
    color: #1e293b;
  }

  .stat-value.positive {
    color: #16a34a;
  }

  .stat-value.negative {
    color: #dc2626;
  }

  .stat-label {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 4px;
    text-transform: uppercase;
  }

  @media (max-width: 1024px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
`;
