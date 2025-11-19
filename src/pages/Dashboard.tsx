// Dashboard page with overview stats

import { useData } from '../context/DataContext';
import { calculateAggregateStats, formatTimestamp } from '../utils';
import { CheckCircle, XCircle, Activity, Clock } from 'lucide-react';

export default function Dashboard() {
  const { cases, testResults } = useData();

  const completeCases = cases.filter(c => c.status === 'complete').length;
  const truthOnly = cases.filter(c => c.status === 'incomplete_truth_only').length;
  const noteOnly = cases.filter(c => c.status === 'incomplete_note_only').length;

  const stats = calculateAggregateStats(testResults);
  const recentResults = testResults.slice(0, 5);

  return (
    <div className="dashboard">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your Medical Coding Truth Database</p>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{cases.length}</span>
            <span className="stat-label">Total Cases</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{completeCases}</span>
            <span className="stat-label">Complete Cases</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon yellow">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{truthOnly}</span>
            <span className="stat-label">Awaiting Notes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{noteOnly}</span>
            <span className="stat-label">Awaiting Truth</span>
          </div>
        </div>
      </section>

      {testResults.length > 0 && (
        <section className="performance-section">
          <h2>Test Performance</h2>
          <div className="performance-grid">
            <div className="perf-card">
              <span className="perf-value">{stats.total}</span>
              <span className="perf-label">Total Tests</span>
            </div>
            <div className="perf-card">
              <span className="perf-value">{(stats.primaryAccuracy * 100).toFixed(1)}%</span>
              <span className="perf-label">Primary ICD Accuracy</span>
            </div>
            <div className="perf-card">
              <span className="perf-value">{(stats.avgCptRecall * 100).toFixed(1)}%</span>
              <span className="perf-label">Avg CPT Recall</span>
            </div>
          </div>
        </section>
      )}

      {recentResults.length > 0 && (
        <section className="recent-section">
          <h2>Recent Test Results</h2>
          <div className="results-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>MRN</th>
                  <th>Primary Match</th>
                  <th>CPT Recall</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map(result => (
                  <tr key={result.id}>
                    <td>{formatTimestamp(result.timestamp)}</td>
                    <td>{result.mrn}</td>
                    <td>
                      {result.primary_match ? (
                        <span className="badge green">Match</span>
                      ) : (
                        <span className="badge red">Miss</span>
                      )}
                    </td>
                    <td>{(result.cpt_recall * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cases.length === 0 && (
        <section className="empty-state">
          <h2>Get Started</h2>
          <p>Upload audit PDFs and clinical notes to build your truth database.</p>
          <ol>
            <li>Go to <strong>Data Ingestion</strong> to upload files</li>
            <li>View linked cases in <strong>Case Database</strong></li>
            <li>Test prompts in <strong>Prompt Tester</strong></li>
          </ol>
        </section>
      )}

      <style>{`
        .dashboard {
          padding: 32px;
        }

        .page-header {
          margin-bottom: 32px;
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

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.blue { background: #dbeafe; color: #3b82f6; }
        .stat-icon.green { background: #dcfce7; color: #22c55e; }
        .stat-icon.yellow { background: #fef3c7; color: #f59e0b; }
        .stat-icon.red { background: #fee2e2; color: #ef4444; }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1e293b;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #64748b;
        }

        .performance-section, .recent-section {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .performance-section h2, .recent-section h2 {
          font-size: 1.25rem;
          margin: 0 0 16px;
          color: #1e293b;
        }

        .performance-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .perf-card {
          text-align: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .perf-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: #3b82f6;
        }

        .perf-label {
          font-size: 0.75rem;
          color: #64748b;
        }

        .results-table {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #64748b;
        }

        td {
          font-size: 0.875rem;
          color: #1e293b;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .badge.green { background: #dcfce7; color: #16a34a; }
        .badge.red { background: #fee2e2; color: #dc2626; }

        .empty-state {
          background: white;
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .empty-state h2 {
          margin: 0 0 8px;
          color: #1e293b;
        }

        .empty-state p {
          color: #64748b;
          margin: 0 0 16px;
        }

        .empty-state ol {
          text-align: left;
          display: inline-block;
          margin: 0;
          padding-left: 20px;
          color: #64748b;
        }

        .empty-state li {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
