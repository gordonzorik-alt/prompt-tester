// Prompt Tester page for running AI coding tests

import { useState } from 'react';
import { useData } from '../context/DataContext';
import { runCodingPrompt } from '../services/geminiService';
import { calculateScore } from '../utils';
import type { ModelOption } from '../types';
import { Play, CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-react';

const DEFAULT_PROMPT = `You are an expert Medical Coder certified in CPT and ICD-10-CM coding.

Analyze the provided medical note and assign the correct codes following CMS guidelines.

Instructions:
1. Identify the PRIMARY diagnosis (the main reason for the encounter)
2. Identify any SECONDARY diagnoses documented
3. Identify all CPT codes for procedures and services performed
4. Include appropriate modifiers when needed

Provide your reasoning for each code selection.`;

export default function PromptTester() {
  const { getCompleteCases, addTestResult, apiKey } = useData();
  const completeCases = getCompleteCases();

  const [selectedMRN, setSelectedMRN] = useState<string>(completeCases[0]?.mrn || '');
  const [model, setModel] = useState<ModelOption>('gemini-2.0-flash-exp');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{
    prediction: { primary_icd: string; cpt_codes: string[]; reasoning: string };
    score: ReturnType<typeof calculateScore>;
    gold: { primary_icd: string; cpt_codes: string[] };
  } | null>(null);
  const [error, setError] = useState('');

  const selectedCase = completeCases.find(c => c.mrn === selectedMRN);

  const runTest = async () => {
    if (!selectedCase || !apiKey) {
      setError('Please select a case and ensure API key is set.');
      return;
    }

    setStatus('loading');
    setResult(null);
    setError('');

    try {
      const noteText = selectedCase.raw_text || '';
      const prediction = await runCodingPrompt(noteText, prompt, model);

      const gold = selectedCase.ground_truth!;
      const score = calculateScore(gold, prediction);

      setResult({
        prediction: {
          primary_icd: prediction.primary_icd,
          cpt_codes: prediction.cpt_codes,
          reasoning: prediction.reasoning
        },
        score,
        gold: {
          primary_icd: gold.primary_icd,
          cpt_codes: gold.cpt_codes
        }
      });

      // Save to history
      addTestResult({
        mrn: selectedCase.mrn,
        model,
        prompt_name: 'Custom Prompt',
        primary_match: score.primary_match,
        cpt_recall: score.cpt_recall,
        missed_cpts: score.missed_cpts,
        hallucinated_cpts: score.hallucinated_cpts,
        pred_primary: prediction.primary_icd,
        pred_cpts: prediction.cpt_codes,
        gold_primary: gold.primary_icd,
        gold_cpts: gold.cpt_codes,
        reasoning: prediction.reasoning
      });

      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="prompt-tester">
      <header className="page-header">
        <h1>Prompt Tester</h1>
        <p>Test AI coding accuracy against gold standard</p>
      </header>

      {completeCases.length === 0 ? (
        <div className="empty-state">
          <h2>No Complete Cases</h2>
          <p>Upload audit PDFs and clinical notes to create complete cases for testing.</p>
        </div>
      ) : (
        <div className="tester-layout">
          <div className="config-panel">
            <div className="form-group">
              <label>Select Case</label>
              <select value={selectedMRN} onChange={(e) => setSelectedMRN(e.target.value)}>
                {completeCases.map(c => (
                  <option key={c.mrn} value={c.mrn}>
                    MRN: {c.mrn} - {c.ground_truth?.primary_icd}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value as ModelOption)}>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>

            <div className="form-group">
              <label>System Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={10}
              />
            </div>

            <button
              className="run-btn"
              onClick={runTest}
              disabled={status === 'loading' || !apiKey}
            >
              {status === 'loading' ? (
                <>
                  <Loader className="spin" size={18} />
                  Running...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Run Test
                </>
              )}
            </button>

            {!apiKey && (
              <p className="warning">Set your Gemini API key in sidebar settings.</p>
            )}

            {error && (
              <div className="error-message">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
          </div>

          <div className="results-panel">
            {selectedCase && (
              <div className="case-preview">
                <h3>Case Preview: MRN {selectedCase.mrn}</h3>
                <div className="gold-standard">
                  <span className="label">Gold Standard:</span>
                  <span>Primary: {selectedCase.ground_truth?.primary_icd}</span>
                  <span>CPTs: {selectedCase.ground_truth?.cpt_codes.join(', ')}</span>
                </div>
                <div className="note-preview">
                  <span className="label">Note Preview:</span>
                  <pre>{selectedCase.raw_text?.substring(0, 500)}...</pre>
                </div>
              </div>
            )}

            {result && (
              <div className="test-results">
                <h3>Test Results</h3>

                <div className="metrics">
                  <div className={`metric ${result.score.primary_match ? 'success' : 'error'}`}>
                    {result.score.primary_match ? (
                      <CheckCircle size={24} />
                    ) : (
                      <XCircle size={24} />
                    )}
                    <div>
                      <span className="metric-value">
                        {result.score.primary_match ? 'MATCH' : 'MISS'}
                      </span>
                      <span className="metric-label">Primary ICD</span>
                    </div>
                  </div>

                  <div className="metric">
                    <span className="metric-value">
                      {(result.score.cpt_recall * 100).toFixed(0)}%
                    </span>
                    <span className="metric-label">CPT Recall</span>
                  </div>

                  <div className="metric">
                    <span className="metric-value">
                      {(result.score.cpt_precision * 100).toFixed(0)}%
                    </span>
                    <span className="metric-label">CPT Precision</span>
                  </div>
                </div>

                <div className="comparison">
                  <div className="comparison-col">
                    <h4>AI Prediction</h4>
                    <p><strong>Primary:</strong> {result.prediction.primary_icd}</p>
                    <p><strong>CPTs:</strong> {result.prediction.cpt_codes.join(', ')}</p>
                  </div>
                  <div className="comparison-col">
                    <h4>Gold Standard</h4>
                    <p><strong>Primary:</strong> {result.gold.primary_icd}</p>
                    <p><strong>CPTs:</strong> {result.gold.cpt_codes.join(', ')}</p>
                  </div>
                </div>

                {result.score.missed_cpts.length > 0 && (
                  <div className="error-list">
                    <strong>Missed CPTs:</strong> {result.score.missed_cpts.join(', ')}
                  </div>
                )}

                {result.score.hallucinated_cpts.length > 0 && (
                  <div className="warning-list">
                    <strong>Hallucinated CPTs:</strong> {result.score.hallucinated_cpts.join(', ')}
                  </div>
                )}

                <div className="reasoning">
                  <h4>AI Reasoning</h4>
                  <p>{result.prediction.reasoning}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .prompt-tester {
          padding: 32px;
          height: 100vh;
          display: flex;
          flex-direction: column;
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
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 12px;
          padding: 32px;
        }

        .empty-state h2 {
          margin: 0 0 8px;
          color: #1e293b;
        }

        .empty-state p {
          color: #64748b;
        }

        .tester-layout {
          flex: 1;
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 24px;
          min-height: 0;
        }

        .config-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
          overflow-y: auto;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .form-group textarea {
          resize: vertical;
          font-family: monospace;
        }

        .run-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .run-btn:hover {
          background: #2563eb;
        }

        .run-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .warning {
          font-size: 0.75rem;
          color: #f59e0b;
          margin: 8px 0 0;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 12px;
          background: #fef2f2;
          color: #b91c1c;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .results-panel {
          background: white;
          border-radius: 12px;
          padding: 24px;
          overflow-y: auto;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .case-preview {
          margin-bottom: 24px;
        }

        .case-preview h3 {
          font-size: 1rem;
          margin: 0 0 12px;
          color: #1e293b;
        }

        .gold-standard {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 0.875rem;
        }

        .gold-standard .label {
          font-weight: 600;
        }

        .note-preview {
          background: #f8fafc;
          padding: 12px;
          border-radius: 8px;
        }

        .note-preview .label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 8px;
        }

        .note-preview pre {
          margin: 0;
          font-size: 0.75rem;
          color: #64748b;
          white-space: pre-wrap;
          max-height: 150px;
          overflow-y: auto;
        }

        .test-results h3 {
          font-size: 1.125rem;
          margin: 0 0 16px;
          color: #1e293b;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .metric {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .metric.success {
          background: #f0fdf4;
          color: #16a34a;
        }

        .metric.error {
          background: #fef2f2;
          color: #dc2626;
        }

        .metric-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .metric-label {
          font-size: 0.75rem;
          color: #64748b;
        }

        .comparison {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .comparison-col {
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .comparison-col h4 {
          margin: 0 0 8px;
          font-size: 0.875rem;
          color: #64748b;
        }

        .comparison-col p {
          margin: 4px 0;
          font-size: 0.875rem;
        }

        .error-list {
          padding: 12px;
          background: #fef2f2;
          color: #dc2626;
          border-radius: 8px;
          font-size: 0.875rem;
          margin-bottom: 12px;
        }

        .warning-list {
          padding: 12px;
          background: #fef3c7;
          color: #b45309;
          border-radius: 8px;
          font-size: 0.875rem;
          margin-bottom: 12px;
        }

        .reasoning {
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .reasoning h4 {
          margin: 0 0 8px;
          font-size: 0.875rem;
          color: #64748b;
        }

        .reasoning p {
          margin: 0;
          font-size: 0.875rem;
          color: #1e293b;
        }
      `}</style>
    </div>
  );
}
