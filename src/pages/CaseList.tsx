// Case Database page showing all ingested cases

import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { getStatusColor, getStatusBadge, truncateText } from '../utils';
import { Search, Filter, Download, Eye, Key, FileText, CheckCircle, XCircle, ChevronDown, ChevronUp, Flag } from 'lucide-react';

export default function CaseList() {
  const { cases, testResults, flaggedMrns, toggleFlaggedMrn, clearFlaggedMrns } = useData();
  const [activeTab, setActiveTab] = useState<'keys' | 'prompts' | 'results'>('keys');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [selectedResultKey, setSelectedResultKey] = useState<string | null>(null);
  const [expandedResultRows, setExpandedResultRows] = useState<Set<string>>(new Set());

  const toggleResultRow = (mrn: string) => {
    setExpandedResultRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mrn)) {
        newSet.delete(mrn);
      } else {
        newSet.add(mrn);
      }
      return newSet;
    });
  };

  // Aggregate test results by prompt
  const promptStats = useMemo(() => {
    const stats: Record<string, {
      name: string;
      promptText: string;
      totalTests: number;
      primaryMatches: number;
      avgCptRecall: number;
      avgCptPrecision: number;
      tests: typeof testResults;
    }> = {};

    testResults.forEach(result => {
      const promptName = result.prompt_name;
      if (!stats[promptName]) {
        stats[promptName] = {
          name: promptName,
          promptText: result.prompt_text || '',
          totalTests: 0,
          primaryMatches: 0,
          avgCptRecall: 0,
          avgCptPrecision: 0,
          tests: []
        };
      }
      stats[promptName].totalTests++;
      if (result.primary_match) stats[promptName].primaryMatches++;
      stats[promptName].avgCptRecall += result.cpt_recall;
      stats[promptName].tests.push(result);
    });

    // Calculate averages
    Object.values(stats).forEach(s => {
      s.avgCptRecall = s.totalTests > 0 ? s.avgCptRecall / s.totalTests : 0;
      // Calculate precision from tests
      let totalPrecision = 0;
      s.tests.forEach(t => {
        const precision = t.pred_cpts.length > 0
          ? (t.pred_cpts.length - t.hallucinated_cpts.length) / t.pred_cpts.length
          : 0;
        totalPrecision += precision;
      });
      s.avgCptPrecision = s.totalTests > 0 ? totalPrecision / s.totalTests : 0;
    });

    return Object.values(stats).sort((a, b) => {
      // Sort by overall score (primary match rate + avg recall) / 2
      const scoreA = (a.primaryMatches / a.totalTests + a.avgCptRecall) / 2;
      const scoreB = (b.primaryMatches / b.totalTests + b.avgCptRecall) / 2;
      return scoreB - scoreA;
    });
  }, [testResults]);

  // Aggregate test results by key (MRN)
  const keyResults = useMemo(() => {
    const results: Record<string, {
      mrn: string;
      goldPrimary: string;
      goldCpts: string[];
      promptResults: Array<{
        promptName: string;
        primaryMatch: boolean;
        predPrimary: string;
        cptRecall: number;
        missedCpts: string[];
        hallucinatedCpts: string[];
        timestamp: string;
      }>;
    }> = {};

    testResults.forEach(result => {
      const mrn = result.mrn;
      if (!results[mrn]) {
        results[mrn] = {
          mrn,
          goldPrimary: result.gold_primary,
          goldCpts: result.gold_cpts,
          promptResults: []
        };
      }
      results[mrn].promptResults.push({
        promptName: result.prompt_name,
        primaryMatch: result.primary_match,
        predPrimary: result.pred_primary,
        cptRecall: result.cpt_recall,
        missedCpts: result.missed_cpts,
        hallucinatedCpts: result.hallucinated_cpts,
        timestamp: result.timestamp
      });
    });

    // Sort prompt results by timestamp (newest first)
    Object.values(results).forEach(r => {
      r.promptResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    return Object.values(results).sort((a, b) => a.mrn.localeCompare(b.mrn));
  }, [testResults]);

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.mrn.includes(search) ||
      c.ground_truth?.primary_icd?.toLowerCase().includes(search.toLowerCase()) ||
      c.metadata?.raw_note_file?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSpecialty = specialtyFilter === 'all' || c.specialty === specialtyFilter;

    return matchesSearch && matchesStatus && matchesSpecialty;
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

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          <Key size={18} />
          Keys ({cases.length})
        </button>
        <button
          className={`tab ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
        >
          <FileText size={18} />
          Prompts ({promptStats.length})
        </button>
        <button
          className={`tab ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          <CheckCircle size={18} />
          Results ({keyResults.length})
        </button>
      </div>

      {activeTab === 'keys' && (
        <>
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
        <div className="filter-select">
          <Filter size={18} />
          <select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}>
            <option value="all">All Specialties</option>
            <option value="Urology">Urology</option>
            <option value="Gastroenterology">Gastroenterology</option>
            <option value="Cardiology">Cardiology</option>
            <option value="General">General</option>
          </select>
        </div>
      </div>

      <div className="content-area">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>MRN</th>
                <th>Specialty</th>
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
                  <td colSpan={7} className="empty-row">
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
                    <td className="specialty-cell">{c.specialty || '—'}</td>
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

            {selected.specialty && (
              <div className="detail-section">
                <h4>Specialty</h4>
                <div className="specialty-badge">{selected.specialty}</div>
              </div>
            )}

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
        </>
      )}

      {activeTab === 'prompts' && (
        <div className="prompts-content">
          {promptStats.length === 0 ? (
            <div className="empty-prompts">
              <h3>No Prompt Tests Yet</h3>
              <p>Run tests in the Prompt Tester to see prompt performance here.</p>
            </div>
          ) : (
            <div className="content-area">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Prompt</th>
                      <th>Tests</th>
                      <th>Primary Match</th>
                      <th>CPT Recall</th>
                      <th>CPT Precision</th>
                      <th>Overall Score</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promptStats.map(stat => {
                      const overallScore = ((stat.primaryMatches / stat.totalTests + stat.avgCptRecall) / 2 * 100);
                      return (
                        <tr key={stat.name} className={selectedPrompt === stat.name ? 'selected' : ''}>
                          <td className="prompt-name">{stat.name}</td>
                          <td>{stat.totalTests}</td>
                          <td>
                            <span className={`score-badge ${stat.primaryMatches / stat.totalTests >= 0.8 ? 'good' : stat.primaryMatches / stat.totalTests >= 0.5 ? 'medium' : 'poor'}`}>
                              {((stat.primaryMatches / stat.totalTests) * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td>
                            <span className={`score-badge ${stat.avgCptRecall >= 0.8 ? 'good' : stat.avgCptRecall >= 0.5 ? 'medium' : 'poor'}`}>
                              {(stat.avgCptRecall * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td>
                            <span className={`score-badge ${stat.avgCptPrecision >= 0.8 ? 'good' : stat.avgCptPrecision >= 0.5 ? 'medium' : 'poor'}`}>
                              {(stat.avgCptPrecision * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td>
                            <span className={`overall-score ${overallScore >= 80 ? 'good' : overallScore >= 50 ? 'medium' : 'poor'}`}>
                              {overallScore.toFixed(0)}%
                            </span>
                          </td>
                          <td>
                            <button
                              className="view-btn"
                              onClick={() => setSelectedPrompt(selectedPrompt === stat.name ? null : stat.name)}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedPrompt && (
                <div className="detail-panel">
                  <div className="detail-header">
                    <h3>{selectedPrompt}</h3>
                    <button onClick={() => setSelectedPrompt(null)}>×</button>
                  </div>

                  <div className="detail-section">
                    <h4>Full Prompt</h4>
                    <div className="full-prompt-text">
                      {promptStats.find(s => s.name === selectedPrompt)?.promptText || 'No prompt text available'}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h4>Test Results</h4>
                    <div className="test-results-list">
                      {promptStats.find(s => s.name === selectedPrompt)?.tests.map(test => (
                        <div key={test.id} className="test-result-item">
                          <div className="test-result-header">
                            <span className="test-mrn">MRN: {test.mrn}</span>
                            <span className={`test-status ${test.primary_match ? 'success' : 'error'}`}>
                              {test.primary_match ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            </span>
                          </div>
                          <div className="test-result-details">
                            <div className="test-detail">
                              <span className="label">Gold:</span> {test.gold_primary}
                            </div>
                            <div className="test-detail">
                              <span className="label">Pred:</span> {test.pred_primary}
                            </div>
                            <div className="test-detail">
                              <span className="label">CPT Recall:</span> {(test.cpt_recall * 100).toFixed(0)}%
                            </div>
                            {test.missed_cpts.length > 0 && (
                              <div className="test-detail missed">
                                <span className="label">Missed:</span> {test.missed_cpts.join(', ')}
                              </div>
                            )}
                            {test.hallucinated_cpts.length > 0 && (
                              <div className="test-detail hallucinated">
                                <span className="label">Extra:</span> {test.hallucinated_cpts.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'results' && (
        <div className="results-content">
          {keyResults.length === 0 ? (
            <div className="empty-prompts">
              <h3>No Test Results Yet</h3>
              <p>Run tests in the Prompt Tester to see key performance here.</p>
            </div>
          ) : (
            <>
              {flaggedMrns.size > 0 && (
                <div className="flagged-indicator">
                  <Flag size={16} />
                  <span>{flaggedMrns.size} case{flaggedMrns.size > 1 ? 's' : ''} flagged for prompt improvement</span>
                  <button onClick={clearFlaggedMrns} className="clear-flagged-btn">
                    Clear All
                  </button>
                </div>
              )}
              <div className="content-area">
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>MRN</th>
                        <th>Gold Primary ICD</th>
                        <th>Gold CPTs</th>
                        <th>Tests</th>
                        <th>Best Match</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                  <tbody>
                    {keyResults.map(result => {
                      const bestResult = result.promptResults.reduce((best, curr) => {
                        const currScore = (curr.primaryMatch ? 1 : 0) + curr.cptRecall;
                        const bestScore = (best.primaryMatch ? 1 : 0) + best.cptRecall;
                        return currScore > bestScore ? curr : best;
                      }, result.promptResults[0]);

                      const isExpanded = expandedResultRows.has(result.mrn);

                      return (
                        <>
                          <tr key={result.mrn} className={`${selectedResultKey === result.mrn ? 'selected' : ''} ${isExpanded ? 'expanded-parent' : ''} ${flaggedMrns.has(result.mrn) ? 'flagged-row' : ''}`}>
                            <td className="mrn-cell">
                              <button
                                className="expand-btn"
                                onClick={() => toggleResultRow(result.mrn)}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                              {result.mrn}
                            </td>
                            <td>{result.goldPrimary}</td>
                            <td className="cpt-cell">{result.goldCpts.join(', ')}</td>
                            <td>{result.promptResults.length}</td>
                            <td>
                              <span className={`score-badge ${bestResult?.primaryMatch ? 'good' : 'poor'}`}>
                                {bestResult?.promptName || '—'}
                              </span>
                            </td>
                            <td className="actions-cell">
                              <button
                                className={`flag-btn ${flaggedMrns.has(result.mrn) ? 'flagged' : ''}`}
                                onClick={() => toggleFlaggedMrn(result.mrn)}
                                title={flaggedMrns.has(result.mrn) ? 'Remove from focus list' : 'Flag for prompt improvement focus'}
                              >
                                <Flag size={16} />
                              </button>
                              <button
                                className="view-btn"
                                onClick={() => setSelectedResultKey(selectedResultKey === result.mrn ? null : result.mrn)}
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${result.mrn}-scores`} className="scores-row">
                              <td colSpan={6}>
                                <div className="inline-scores">
                                  <table className="scores-table">
                                    <thead>
                                      <tr>
                                        <th>Prompt</th>
                                        <th>ICD-10 Match</th>
                                        <th>Predicted ICD</th>
                                        <th>CPT Recall</th>
                                        <th>Missed CPTs</th>
                                        <th>Extra CPTs</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {result.promptResults.map((pr, idx) => (
                                        <tr key={idx}>
                                          <td className="prompt-name-cell">{pr.promptName}</td>
                                          <td>
                                            <span className={`mini-badge ${pr.primaryMatch ? 'good' : 'poor'}`}>
                                              {pr.primaryMatch ? 'YES' : 'NO'}
                                            </span>
                                          </td>
                                          <td className="pred-icd-cell">{pr.predPrimary}</td>
                                          <td>
                                            <span className={`mini-badge ${pr.cptRecall >= 0.8 ? 'good' : pr.cptRecall >= 0.5 ? 'medium' : 'poor'}`}>
                                              {(pr.cptRecall * 100).toFixed(0)}%
                                            </span>
                                          </td>
                                          <td className="missed-cell">
                                            {pr.missedCpts.length > 0 ? pr.missedCpts.join(', ') : '—'}
                                          </td>
                                          <td className="extra-cell">
                                            {pr.hallucinatedCpts.length > 0 ? pr.hallucinatedCpts.join(', ') : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedResultKey && (
                <div className="detail-panel">
                  <div className="detail-header">
                    <h3>MRN: {selectedResultKey}</h3>
                    <button onClick={() => setSelectedResultKey(null)}>×</button>
                  </div>

                  {(() => {
                    const keyData = keyResults.find(r => r.mrn === selectedResultKey);
                    if (!keyData) return null;

                    return (
                      <>
                        <div className="detail-section">
                          <h4>Ground Truth</h4>
                          <div className="detail-row">
                            <span className="label">Primary ICD:</span>
                            <span className="value">{keyData.goldPrimary}</span>
                          </div>
                          <div className="detail-row">
                            <span className="label">CPT Codes:</span>
                            <span className="value">{keyData.goldCpts.join(', ')}</span>
                          </div>
                        </div>

                        <div className="detail-section">
                          <h4>Prompt Performance ({keyData.promptResults.length})</h4>
                          <div className="prompt-results-list">
                            {keyData.promptResults.map((pr, idx) => (
                              <div key={idx} className="prompt-result-item">
                                <div className="prompt-result-header">
                                  <span className="prompt-result-name">{pr.promptName}</span>
                                  <span className={`test-status ${pr.primaryMatch ? 'success' : 'error'}`}>
                                    {pr.primaryMatch ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                  </span>
                                </div>
                                <div className="prompt-result-details">
                                  <div className="test-detail">
                                    <span className="label">Predicted:</span> {pr.predPrimary}
                                  </div>
                                  <div className="test-detail">
                                    <span className="label">CPT Recall:</span> {(pr.cptRecall * 100).toFixed(0)}%
                                  </div>
                                  {pr.missedCpts.length > 0 && (
                                    <div className="test-detail missed">
                                      <span className="label">Missed:</span> {pr.missedCpts.join(', ')}
                                    </div>
                                  )}
                                  {pr.hallucinatedCpts.length > 0 && (
                                    <div className="test-detail hallucinated">
                                      <span className="label">Extra:</span> {pr.hallucinatedCpts.join(', ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              </div>
            </>
          )}
        </div>
      )}

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

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }

        .tab:hover {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .tab.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
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

        .specialty-cell {
          font-size: 0.75rem;
          color: #64748b;
        }

        .specialty-badge {
          display: inline-block;
          padding: 6px 12px;
          background: #f0f9ff;
          color: #0369a1;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
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

        .prompts-content {
          flex: 1;
          min-height: 0;
        }

        .empty-prompts {
          background: white;
          border-radius: 12px;
          padding: 48px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .empty-prompts h3 {
          margin: 0 0 8px;
          color: #1e293b;
        }

        .empty-prompts p {
          color: #64748b;
          margin: 0;
        }

        .prompt-name {
          font-weight: 600;
          color: #1e293b;
        }

        .score-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .score-badge.good {
          background: #f0fdf4;
          color: #16a34a;
        }

        .score-badge.medium {
          background: #fef3c7;
          color: #b45309;
        }

        .score-badge.poor {
          background: #fef2f2;
          color: #dc2626;
        }

        .overall-score {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 700;
        }

        .overall-score.good {
          background: #f0fdf4;
          color: #16a34a;
        }

        .overall-score.medium {
          background: #fef3c7;
          color: #b45309;
        }

        .overall-score.poor {
          background: #fef2f2;
          color: #dc2626;
        }

        .test-results-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .test-result-item {
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .test-result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .test-mrn {
          font-weight: 600;
          font-size: 0.875rem;
          color: #1e293b;
        }

        .test-status {
          display: flex;
          align-items: center;
        }

        .test-status.success {
          color: #16a34a;
        }

        .test-status.error {
          color: #dc2626;
        }

        .test-result-details {
          font-size: 0.75rem;
        }

        .test-detail {
          margin-bottom: 4px;
          color: #64748b;
        }

        .test-detail .label {
          font-weight: 500;
          color: #1e293b;
        }

        .test-detail.missed {
          color: #dc2626;
        }

        .test-detail.hallucinated {
          color: #b45309;
        }

        .full-prompt-text {
          background: #f8fafc;
          padding: 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          color: #1e293b;
          max-height: 200px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-family: monospace;
          line-height: 1.5;
        }

        .results-content {
          flex: 1;
          min-height: 0;
        }

        .cpt-cell {
          font-size: 0.75rem;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .prompt-results-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .prompt-result-item {
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .prompt-result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .prompt-result-name {
          font-weight: 600;
          font-size: 0.875rem;
          color: #1e293b;
        }

        .prompt-result-details {
          font-size: 0.75rem;
        }

        .expand-btn {
          padding: 4px;
          margin-right: 8px;
          background: #f1f5f9;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
        }

        .expand-btn:hover {
          background: #e2e8f0;
          color: #3b82f6;
        }

        .expanded-parent {
          background: #f8fafc;
        }

        .scores-row {
          background: #f8fafc;
        }

        .scores-row td {
          padding: 0 !important;
          border-bottom: 2px solid #e2e8f0;
        }

        .inline-scores {
          padding: 12px 16px 16px;
        }

        .scores-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .scores-table th {
          background: #f1f5f9;
          padding: 8px 12px;
          font-size: 0.7rem;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 600;
          text-align: left;
        }

        .scores-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #f1f5f9;
        }

        .scores-table tbody tr:last-child td {
          border-bottom: none;
        }

        .prompt-name-cell {
          font-weight: 600;
          color: #1e293b;
        }

        .pred-icd-cell {
          font-family: monospace;
          font-size: 0.7rem;
        }

        .missed-cell {
          color: #dc2626;
          font-size: 0.7rem;
        }

        .extra-cell {
          color: #b45309;
          font-size: 0.7rem;
        }

        .mini-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 600;
        }

        .mini-badge.good {
          background: #f0fdf4;
          color: #16a34a;
        }

        .mini-badge.medium {
          background: #fef3c7;
          color: #b45309;
        }

        .mini-badge.poor {
          background: #fef2f2;
          color: #dc2626;
        }

        .actions-cell {
          display: flex;
          gap: 4px;
        }

        .flag-btn {
          padding: 6px;
          background: #f1f5f9;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          color: #64748b;
        }

        .flag-btn:hover {
          background: #fef3c7;
          color: #b45309;
        }

        .flag-btn.flagged {
          background: #fef3c7;
          color: #b45309;
        }

        .flagged-row {
          background: #fffbeb !important;
        }

        .flagged-row:hover {
          background: #fef3c7 !important;
        }

        .flagged-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          margin-bottom: 16px;
          color: #b45309;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .flagged-indicator span {
          flex: 1;
        }

        .clear-flagged-btn {
          padding: 6px 12px;
          background: white;
          border: 1px solid #f59e0b;
          border-radius: 4px;
          color: #b45309;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
        }

        .clear-flagged-btn:hover {
          background: #fef3c7;
        }
      `}</style>
    </div>
  );
}
