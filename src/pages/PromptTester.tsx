// Prompt Tester page for running AI coding tests

import { useState } from 'react';
import { useData } from '../context/DataContext';
import { runCodingPrompt, improvePrompt } from '../services/geminiService';
import { calculateScore } from '../utils';
import type { ModelOption, Specialty } from '../types';
import { Play, CheckCircle, XCircle, AlertTriangle, Loader, Sparkles, Flag } from 'lucide-react';

const SPECIALTY_PROMPTS: Record<Specialty | 'General', string> = {
  General: `You are an expert Medical Coder certified in CPT and ICD-10-CM coding.

Analyze the provided medical note and assign the correct codes following CMS guidelines.

Instructions:
1. Identify the PRIMARY diagnosis (the main reason for the encounter)
2. Identify any SECONDARY diagnoses documented
3. Identify all CPT codes for procedures and services performed
4. Include appropriate modifiers when needed

Provide your reasoning for each code selection.`,

  Urology: `You are an expert Medical Coder specializing in UROLOGY coding, certified in CPT and ICD-10-CM.

Analyze this urology clinical note and assign the correct codes following CMS guidelines.

Key Urology Considerations:
- Common procedures: cystoscopy (52000), transurethral procedures, prostate procedures
- Pay attention to approach (transurethral vs open vs laparoscopic)
- Note laterality for kidney/ureteral procedures (use -50 modifier for bilateral)
- Distinguish between diagnostic vs therapeutic procedures
- Watch for commonly bundled services

Instructions:
1. Identify the PRIMARY diagnosis (the main reason for the encounter)
2. Identify any SECONDARY diagnoses documented
3. Identify all CPT codes for urology procedures performed
4. Include appropriate modifiers (-50 bilateral, -59 distinct procedure, etc.)

Provide your reasoning for each code selection.`,

  Gastroenterology: `You are an expert Medical Coder specializing in GASTROENTEROLOGY coding, certified in CPT and ICD-10-CM.

Analyze this gastroenterology clinical note and assign the correct codes following CMS guidelines.

Key Gastroenterology Considerations:
- Endoscopy codes: EGD (43235-43259), Colonoscopy (45378-45398)
- Watch for diagnostic vs therapeutic procedures
- Biopsy codes - note number and sites
- Polypectomy techniques affect code selection
- EGD vs colonoscopy vs both in same session

Instructions:
1. Identify the PRIMARY diagnosis (the main reason for the encounter)
2. Identify any SECONDARY diagnoses documented
3. Identify all CPT codes for GI procedures performed
4. Include appropriate modifiers (-59 distinct procedure, etc.)

Provide your reasoning for each code selection.`,

  Cardiology: `You are an expert Medical Coder specializing in CARDIOLOGY coding, certified in CPT and ICD-10-CM.

Analyze this cardiology clinical note and assign the correct codes following CMS guidelines.

Key Cardiology Considerations:
- Cardiac catheterization codes (93451-93572)
- Echocardiography codes (93303-93355)
- Stress testing codes
- Distinguish between diagnostic and interventional procedures
- Pay attention to professional vs technical components
- Note supervision levels for stress tests

Instructions:
1. Identify the PRIMARY diagnosis (the main reason for the encounter)
2. Identify any SECONDARY diagnoses documented
3. Identify all CPT codes for cardiology procedures performed
4. Include appropriate modifiers (-26 professional component, -TC technical, etc.)

Provide your reasoning for each code selection.`
};

const DEFAULT_PROMPT = SPECIALTY_PROMPTS.General;

export default function PromptTester() {
  const { getCompleteCases, addTestResult, testResults, savedPrompts, savePrompt, apiKey, flaggedMrns, getFlaggedCasesWithNotes } = useData();
  const completeCases = getCompleteCases();

  const [selectedMRN, setSelectedMRN] = useState<string>(completeCases[0]?.mrn || '');
  const [model, setModel] = useState<ModelOption>('gemini-3-pro-preview');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [promptName, setPromptName] = useState('Default Prompt');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{
    prediction: { primary_icd: string; cpt_codes: string[]; reasoning: string };
    score: ReturnType<typeof calculateScore>;
    gold: { primary_icd: string; cpt_codes: string[] };
  } | null>(null);
  const [error, setError] = useState('');
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [improvedPrompt, setImprovedPrompt] = useState<string | null>(null);

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
      const prediction = await runCodingPrompt(noteText, prompt, model, apiKey);

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
        prompt_name: promptName,
        prompt_text: prompt,
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

      // Save prompt for future use
      savePrompt(promptName, prompt);

      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  const handleImprovePrompt = async () => {
    if (testResults.length === 0) {
      setError('Run some tests first to generate improvement suggestions.');
      return;
    }

    setImprovingPrompt(true);
    setImprovedPrompt(null);
    setError('');

    try {
      // Get flagged cases with their clinical notes
      const flaggedCases = getFlaggedCasesWithNotes();

      // Transform test results to the format expected by improvePrompt
      const testHistory = testResults.map(r => ({
        primary_match: r.primary_match,
        missed_cpts: r.missed_cpts,
        hallucinated_cpts: r.hallucinated_cpts,
        gold_primary: r.gold_primary,
        pred_primary: r.pred_primary,
        gold_cpts: r.gold_cpts,
        pred_cpts: r.pred_cpts
      }));

      // Transform flagged cases to the format expected by improvePrompt
      const focusCases = flaggedCases.map(fc => ({
        mrn: fc.mrn,
        rawText: fc.rawText,
        groundTruth: fc.groundTruth,
        testResults: fc.testResults.map(tr => ({
          primary_match: tr.primary_match,
          missed_cpts: tr.missed_cpts,
          hallucinated_cpts: tr.hallucinated_cpts,
          gold_primary: tr.gold_primary,
          pred_primary: tr.pred_primary
        }))
      }));

      const improved = await improvePrompt(prompt, testHistory, model, apiKey, focusCases.length > 0 ? focusCases : undefined);
      setImprovedPrompt(improved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve prompt');
    } finally {
      setImprovingPrompt(false);
    }
  };

  const applyImprovedPrompt = () => {
    if (improvedPrompt) {
      // Count existing improved prompts to generate new name
      const uniqueImproved = new Set(savedPrompts.filter(p => p.name.startsWith('Improved')).map(p => p.name));
      const version = uniqueImproved.size + 1;
      const newName = `Improved v${version}`;

      setPrompt(improvedPrompt);
      setPromptName(newName);

      // Save the improved prompt immediately
      savePrompt(newName, improvedPrompt);

      setImprovedPrompt(null);
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
                    MRN: {c.mrn} - {c.specialty || 'General'} - {c.ground_truth?.primary_icd}
                  </option>
                ))}
              </select>
            </div>

            {selectedCase?.specialty && (
              <button
                className="load-specialty-btn"
                onClick={() => setPrompt(SPECIALTY_PROMPTS[selectedCase.specialty || 'General'])}
              >
                Load {selectedCase.specialty} Prompt
              </button>
            )}

            <div className="form-group">
              <label>Load Saved Prompt</label>
              <select
                value=""
                onChange={(e) => {
                  const selected = savedPrompts.find(p => p.id === e.target.value);
                  if (selected) {
                    setPrompt(selected.text);
                    setPromptName(selected.name);
                  }
                }}
              >
                <option value="">{savedPrompts.length === 0 ? 'No saved prompts yet' : 'Select a saved prompt...'}</option>
                {savedPrompts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Prompt Name</label>
              <input
                type="text"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="Enter a name for this prompt"
              />
            </div>

            <div className="form-group">
              <label>Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value as ModelOption)}>
                <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
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

            <button
              className="improve-btn"
              onClick={handleImprovePrompt}
              disabled={improvingPrompt || testResults.length === 0}
            >
              {improvingPrompt ? (
                <>
                  <Loader className="spin" size={18} />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Improve Prompt ({testResults.length} tests)
                </>
              )}
            </button>

            {flaggedMrns.size > 0 && (
              <div className="flagged-cases-info">
                <Flag size={14} />
                <span>{flaggedMrns.size} flagged case{flaggedMrns.size > 1 ? 's' : ''} will be prioritized</span>
              </div>
            )}

            {!apiKey && (
              <p className="warning">Set your Gemini API key in sidebar settings.</p>
            )}

            {testResults.length === 0 && (
              <p className="info-text">Run tests to enable prompt improvement</p>
            )}

            {error && (
              <div className="error-message">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {improvedPrompt && (
              <div className="improved-prompt-section">
                <h4>Improved Prompt</h4>
                <div className="improved-prompt-preview">
                  {improvedPrompt.substring(0, 500)}...
                </div>
                <div className="improved-prompt-actions">
                  <button onClick={applyImprovedPrompt} className="apply-btn">
                    Apply Improved Prompt
                  </button>
                  <button onClick={() => setImprovedPrompt(null)} className="dismiss-btn">
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="results-panel">
            {selectedCase && (
              <div className="case-preview">
                <h3>Case Preview: MRN {selectedCase.mrn}</h3>
                {selectedCase.specialty && (
                  <div className="specialty-tag">{selectedCase.specialty}</div>
                )}
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
        .form-group textarea,
        .form-group input[type="text"] {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .form-group input[type="text"] {
          box-sizing: border-box;
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

        .load-specialty-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: #f0f9ff;
          color: #0369a1;
          border: 1px solid #0369a1;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 16px;
        }

        .load-specialty-btn:hover {
          background: #e0f2fe;
        }

        .specialty-tag {
          display: inline-block;
          padding: 4px 12px;
          background: #f0f9ff;
          color: #0369a1;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          margin-bottom: 12px;
        }

        .improve-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: #8b5cf6;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
        }

        .improve-btn:hover {
          background: #7c3aed;
        }

        .improve-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .info-text {
          font-size: 0.75rem;
          color: #64748b;
          text-align: center;
          margin: 8px 0 0;
        }

        .improved-prompt-section {
          margin-top: 16px;
          padding: 16px;
          background: #f5f3ff;
          border: 1px solid #8b5cf6;
          border-radius: 8px;
        }

        .improved-prompt-section h4 {
          margin: 0 0 8px;
          font-size: 0.875rem;
          color: #7c3aed;
        }

        .improved-prompt-preview {
          font-size: 0.75rem;
          color: #1e293b;
          background: white;
          padding: 12px;
          border-radius: 6px;
          max-height: 150px;
          overflow-y: auto;
          margin-bottom: 12px;
          font-family: monospace;
          white-space: pre-wrap;
        }

        .improved-prompt-actions {
          display: flex;
          gap: 8px;
        }

        .apply-btn {
          flex: 1;
          padding: 8px;
          background: #8b5cf6;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
        }

        .apply-btn:hover {
          background: #7c3aed;
        }

        .dismiss-btn {
          padding: 8px 12px;
          background: transparent;
          color: #64748b;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          cursor: pointer;
        }

        .dismiss-btn:hover {
          background: #f1f5f9;
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

        .flagged-cases-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          color: #b45309;
          font-size: 0.75rem;
          font-weight: 500;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
