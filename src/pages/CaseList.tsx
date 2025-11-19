// Case Database page showing all ingested cases

import { useState } from 'react';
import { useData } from '../context/DataContext';
import { getStatusColor, getStatusBadge, truncateText } from '../utils';
import { Search, Filter, Download, Eye } from 'lucide-react';

export default function CaseList() {
  const { cases } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.mrn.includes(search) ||
      c.ground_truth?.primary_icd?.toLowerCase().includes(search.toLowerCase()) ||
      c.metadata?.raw_note_file?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const completeCases = cases.filter(c => c.status === 'complete').length;
  const truthOnly = cases.filter(c => c.status === 'incomplete_truth_only').length;
  const noteOnly = cases.filter(c => c.status === 'incomplete_note_only').length;

  const exportCases = () => {
    const complete = cases.filter(c => c.status === 'complete');
    const blob = new Blob([JSON.stringify(complete, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'complete_cases.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selected = cases.find(c => c.mrn === selectedCase);

  return (
    <div className="case-list">
      <header className="page-header">
        <div>
          <h1>Case Database</h1>
          <p>View and manage all ingested medical coding cases</p>
        </div>
        <button onClick={exportCases} className="export-btn" disabled={completeCases === 0}>
          <Download size={18} />
          Export Complete ({completeCases})
        </button>
      </header>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-count">{cases.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item green">
          <span className="stat-count">{completeCases}</span>
          <span className="stat-label">Complete</span>
        </div>
        <div className="stat-item yellow">
          <span className="stat-count">{truthOnly}</span>
          <span className="stat-label">Truth Only</span>
        </div>
        <div className="stat-item red">
          <span className="stat-count">{noteOnly}</span>
          <span className="stat-label">Note Only</span>
        </div>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by MRN, ICD code, or filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-select">
          <Filter size={18} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="complete">Complete</option>
            <option value="incomplete_truth_only">Truth Only</option>
            <option value="incomplete_note_only">Note Only</option>
          </select>
        </div>
      </div>

      <div className="content-area">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>MRN</th>
                <th>Status</th>
                <th>Primary ICD</th>
                <th>CPT Codes</th>
                <th>Files</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    {cases.length === 0
                      ? 'No cases yet. Upload files in Data Ingestion.'
                      : 'No cases match your filters.'
                    }
                  </td>
                </tr>
              ) : (
                filteredCases.map(c => (
                  <tr key={c.mrn} className={selectedCase === c.mrn ? 'selected' : ''}>
                    <td className="mrn-cell">{c.mrn}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(c.status) + '20', color: getStatusColor(c.status) }}
                      >
                        {getStatusBadge(c.status)}
                      </span>
                    </td>
                    <td>{c.ground_truth?.primary_icd || '—'}</td>
                    <td>{c.ground_truth?.cpt_codes?.join(', ') || '—'}</td>
                    <td className="files-cell">
                      <span title={c.metadata?.audit_filename_ref}>
                        {c.metadata?.audit_filename_ref ? '📋' : ''}
                      </span>
                      <span title={c.metadata?.raw_note_file}>
                        {c.metadata?.raw_note_file ? '📄' : ''}
                      </span>
                    </td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={() => setSelectedCase(selectedCase === c.mrn ? null : c.mrn)}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="detail-panel">
            <div className="detail-header">
              <h3>MRN: {selected.mrn}</h3>
              <button onClick={() => setSelectedCase(null)}>×</button>
            </div>

            {selected.ground_truth && (
              <div className="detail-section">
                <h4>Ground Truth</h4>
                <div className="detail-row">
                  <span className="label">Primary ICD:</span>
                  <span className="value">{selected.ground_truth.primary_icd}</span>
                </div>
                {selected.ground_truth.secondary_icds?.length > 0 && (
                  <div className="detail-row">
                    <span className="label">Secondary ICDs:</span>
                    <span className="value">{selected.ground_truth.secondary_icds.join(', ')}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="label">CPT Codes:</span>
                  <span className="value">{selected.ground_truth.cpt_codes.join(', ')}</span>
                </div>
                {selected.ground_truth.auditor_notes && (
                  <div className="detail-row">
                    <span className="label">Auditor Notes:</span>
                    <span className="value">{selected.ground_truth.auditor_notes}</span>
                  </div>
                )}
              </div>
            )}

            {selected.raw_text && (
              <div className="detail-section">
                <h4>Clinical Note Preview</h4>
                <div className="note-preview">
                  {truncateText(selected.raw_text, 1000)}
                </div>
              </div>
            )}

            {selected.metadata && (
              <div className="detail-section">
                <h4>Metadata</h4>
                {selected.metadata.audit_source && (
                  <div className="detail-row">
                    <span className="label">Audit Source:</span>
                    <span className="value">{selected.metadata.audit_source}</span>
                  </div>
                )}
                {selected.metadata.raw_note_file && (
                  <div className="detail-row">
                    <span className="label">Note File:</span>
                    <span className="value">{selected.metadata.raw_note_file}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .case-list {
          padding: 32px;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
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

        .export-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        }

        .export-btn:hover {
          background: #2563eb;
        }

        .export-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .stats-bar {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-item {
          background: white;
          padding: 12px 20px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .stat-count {
          font-size: 1.25rem;
          font-weight: 700;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #64748b;
        }

        .stat-item.green .stat-count { color: #22c55e; }
        .stat-item.yellow .stat-count { color: #eab308; }
        .stat-item.red .stat-count { color: #ef4444; }

        .filters {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .search-box, .filter-select {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .search-box {
          flex: 1;
        }

        .search-box input {
          border: none;
          outline: none;
          flex: 1;
          font-size: 0.875rem;
        }

        .filter-select select {
          border: none;
          outline: none;
          background: none;
          font-size: 0.875rem;
        }

        .content-area {
          flex: 1;
          display: flex;
          gap: 20px;
          min-height: 0;
        }

        .table-container {
          flex: 1;
          background: white;
          border-radius: 12px;
          overflow: auto;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          background: #f8fafc;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #64748b;
          position: sticky;
          top: 0;
        }

        td {
          font-size: 0.875rem;
        }

        tr.selected {
          background: #f0f9ff;
        }

        .mrn-cell {
          font-weight: 600;
          color: #1e293b;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .files-cell {
          font-size: 1rem;
        }

        .view-btn {
          padding: 6px;
          background: #f1f5f9;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          color: #64748b;
        }

        .view-btn:hover {
          background: #e2e8f0;
          color: #3b82f6;
        }

        .empty-row {
          text-align: center;
          color: #64748b;
          padding: 32px !important;
        }

        .detail-panel {
          width: 400px;
          background: white;
          border-radius: 12px;
          padding: 20px;
          overflow-y: auto;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .detail-header h3 {
          margin: 0;
          font-size: 1.125rem;
          color: #1e293b;
        }

        .detail-header button {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #64748b;
        }

        .detail-section {
          margin-bottom: 20px;
        }

        .detail-section h4 {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #64748b;
          margin: 0 0 12px;
        }

        .detail-row {
          margin-bottom: 8px;
        }

        .detail-row .label {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
        }

        .detail-row .value {
          font-size: 0.875rem;
          color: #1e293b;
        }

        .note-preview {
          font-size: 0.75rem;
          color: #64748b;
          background: #f8fafc;
          padding: 12px;
          border-radius: 8px;
          max-height: 200px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}
