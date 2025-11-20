// Data Ingestion page for uploading audit PDFs and clinical notes

import { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { extractAuditFromPDF, extractTextFromPDF } from '../services/geminiService';
import { extractMRN } from '../utils';
import type { Specialty } from '../types';
import { Upload, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function Ingestion() {
  const { ingestAuditEntries, ingestRawNote, apiKey } = useData();

  const [specialty, setSpecialty] = useState<Specialty>('Urology');
  const [auditStatus, setAuditStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [auditMessage, setAuditMessage] = useState('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [noteMessage, setNoteMessage] = useState('');
  const [noteResults, setNoteResults] = useState<Array<{ file: string; success: boolean; mrn: string | null }>>([]);

  const auditInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const handleAuditUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!apiKey) {
      setAuditStatus('error');
      setAuditMessage('Please set your Gemini API key in settings first.');
      return;
    }

    setAuditStatus('loading');
    setAuditMessage('Extracting audit entries...');

    try {
      const buffer = await file.arrayBuffer();
      const entries = await extractAuditFromPDF(buffer, file.name);
      const count = ingestAuditEntries(entries, file.name, specialty);

      setAuditStatus('success');
      setAuditMessage(`Successfully extracted ${count} audit cases from ${file.name}`);
    } catch (error) {
      setAuditStatus('error');
      setAuditMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (auditInputRef.current) {
      auditInputRef.current.value = '';
    }
  };

  const handleNoteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!apiKey) {
      setNoteStatus('error');
      setNoteMessage('Please set your Gemini API key in settings first.');
      return;
    }

    setNoteStatus('loading');
    setNoteMessage(`Processing ${files.length} file(s)...`);
    setNoteResults([]);

    const results: Array<{ file: string; success: boolean; mrn: string | null }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setNoteMessage(`Processing ${i + 1}/${files.length}: ${file.name}`);

      try {
        const buffer = await file.arrayBuffer();
        const text = await extractTextFromPDF(buffer);
        const mrn = extractMRN(text);

        if (mrn) {
          const { success } = ingestRawNote(text, file.name);
          results.push({ file: file.name, success, mrn });
        } else {
          results.push({ file: file.name, success: false, mrn: null });
        }
      } catch (error) {
        results.push({ file: file.name, success: false, mrn: null });
      }
    }

    const successCount = results.filter(r => r.success).length;
    setNoteStatus('success');
    setNoteMessage(`Processed ${files.length} files. ${successCount} successfully linked.`);
    setNoteResults(results);

    if (noteInputRef.current) {
      noteInputRef.current.value = '';
    }
  };

  return (
    <div className="ingestion">
      <header className="page-header">
        <h1>Data Ingestion</h1>
        <p>Upload Audit PDFs (answers) and Clinical Notes (questions) to build your database</p>
      </header>

      <div className="upload-grid">
        {/* Audit Upload */}
        <div className="upload-card">
          <div className="card-header">
            <FileText size={24} />
            <h2>1. Upload Audit PDF</h2>
          </div>
          <p className="card-description">
            Contains the correct codes from the auditor. This is your "answer key".
          </p>

          <div className="specialty-selector">
            <label>Specialty:</label>
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value as Specialty)}>
              <option value="Urology">Urology</option>
              <option value="Gastroenterology">Gastroenterology</option>
              <option value="Cardiology">Cardiology</option>
              <option value="General">General</option>
            </select>
          </div>

          <label className="upload-area">
            <input
              ref={auditInputRef}
              type="file"
              accept=".pdf"
              onChange={handleAuditUpload}
              disabled={auditStatus === 'loading'}
            />
            <Upload size={32} />
            <span>Click to select PDF</span>
          </label>

          {auditStatus !== 'idle' && (
            <div className={`status-message ${auditStatus}`}>
              {auditStatus === 'loading' && <Loader className="spin" size={16} />}
              {auditStatus === 'success' && <CheckCircle size={16} />}
              {auditStatus === 'error' && <AlertCircle size={16} />}
              <span>{auditMessage}</span>
            </div>
          )}
        </div>

        {/* Note Upload */}
        <div className="upload-card">
          <div className="card-header">
            <FileText size={24} />
            <h2>2. Upload Clinical Notes</h2>
          </div>
          <p className="card-description">
            Original clinical notes. MRN will be auto-detected and linked to audit records.
          </p>

          <label className="upload-area">
            <input
              ref={noteInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleNoteUpload}
              disabled={noteStatus === 'loading'}
            />
            <Upload size={32} />
            <span>Click to select PDFs (multiple)</span>
          </label>

          {noteStatus !== 'idle' && (
            <div className={`status-message ${noteStatus}`}>
              {noteStatus === 'loading' && <Loader className="spin" size={16} />}
              {noteStatus === 'success' && <CheckCircle size={16} />}
              {noteStatus === 'error' && <AlertCircle size={16} />}
              <span>{noteMessage}</span>
            </div>
          )}

          {noteResults.length > 0 && (
            <div className="results-list">
              {noteResults.map((r, i) => (
                <div key={i} className={`result-item ${r.success ? 'success' : 'error'}`}>
                  {r.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <span>{r.file}</span>
                  {r.mrn && <span className="mrn">MRN: {r.mrn}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="workflow-info">
        <h3>How It Works</h3>
        <ol>
          <li><strong>Upload Audit PDF</strong> - Extracts coding corrections indexed by MRN</li>
          <li><strong>Upload Clinical Notes</strong> - Extracts text and auto-detects MRN</li>
          <li><strong>System Links</strong> - Matches notes to audit records via MRN</li>
          <li><strong>Test Prompts</strong> - Use complete cases to test AI coding accuracy</li>
        </ol>
      </section>

      <style>{`
        .ingestion {
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

        .upload-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .upload-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
          color: #1e293b;
        }

        .card-header h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
        }

        .card-description {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0 0 16px;
        }

        .specialty-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .specialty-selector label {
          font-weight: 500;
          color: #1e293b;
        }

        .specialty-selector select {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          font-size: 0.875rem;
          color: #1e293b;
          cursor: pointer;
        }

        .specialty-selector select:hover {
          border-color: #3b82f6;
        }

        .specialty-selector select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .upload-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          border: 2px dashed #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          color: #64748b;
        }

        .upload-area:hover {
          border-color: #3b82f6;
          background: #f8fafc;
        }

        .upload-area input {
          display: none;
        }

        .upload-area span {
          margin-top: 8px;
          font-size: 0.875rem;
        }

        .status-message {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .status-message.loading {
          background: #f0f9ff;
          color: #0369a1;
        }

        .status-message.success {
          background: #f0fdf4;
          color: #15803d;
        }

        .status-message.error {
          background: #fef2f2;
          color: #b91c1c;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .results-list {
          margin-top: 12px;
          max-height: 200px;
          overflow-y: auto;
        }

        .result-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          font-size: 0.75rem;
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .result-item.success {
          background: #f0fdf4;
          color: #15803d;
        }

        .result-item.error {
          background: #fef2f2;
          color: #b91c1c;
        }

        .result-item .mrn {
          margin-left: auto;
          font-weight: 500;
        }

        .workflow-info {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .workflow-info h3 {
          margin: 0 0 16px;
          color: #1e293b;
        }

        .workflow-info ol {
          margin: 0;
          padding-left: 20px;
          color: #64748b;
        }

        .workflow-info li {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
