// React Context for Medical Coding Data with localStorage persistence

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { MedicalCase, TestResult, GroundTruth, AuditEntry } from '../types';
import { generateId, extractMRN } from '../utils';

interface DataContextType {
  // Cases
  cases: MedicalCase[];
  addCase: (caseData: MedicalCase) => void;
  updateCase: (mrn: string, updates: Partial<MedicalCase>) => void;
  getCase: (mrn: string) => MedicalCase | undefined;
  getCompleteCases: () => MedicalCase[];

  // Audit ingestion
  ingestAuditEntries: (entries: AuditEntry[], sourceFile: string) => number;

  // Note ingestion
  ingestRawNote: (text: string, fileName: string) => { success: boolean; mrn: string | null };

  // Test results
  testResults: TestResult[];
  addTestResult: (result: Omit<TestResult, 'id' | 'timestamp'>) => void;

  // API Key
  apiKey: string;
  setApiKey: (key: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CASES: 'medical_coder_cases',
  RESULTS: 'medical_coder_results',
  API_KEY: 'gemini_api_key'
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<MedicalCase[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [apiKey, setApiKeyState] = useState<string>('');

  // Load from localStorage on mount
  useEffect(() => {
    const savedCases = localStorage.getItem(STORAGE_KEYS.CASES);
    const savedResults = localStorage.getItem(STORAGE_KEYS.RESULTS);
    const savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);

    if (savedCases) setCases(JSON.parse(savedCases));
    if (savedResults) setTestResults(JSON.parse(savedResults));
    if (savedApiKey) setApiKeyState(savedApiKey);
  }, []);

  // Save cases to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(cases));
  }, [cases]);

  // Save results to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(testResults));
  }, [testResults]);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  };

  const addCase = (caseData: MedicalCase) => {
    setCases(prev => {
      const existing = prev.findIndex(c => c.mrn === caseData.mrn);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], ...caseData };
        return updated;
      }
      return [...prev, caseData];
    });
  };

  const updateCase = (mrn: string, updates: Partial<MedicalCase>) => {
    setCases(prev => prev.map(c =>
      c.mrn === mrn ? { ...c, ...updates } : c
    ));
  };

  const getCase = (mrn: string) => {
    return cases.find(c => c.mrn === mrn);
  };

  const getCompleteCases = () => {
    return cases.filter(c => c.status === 'complete');
  };

  const ingestAuditEntries = (entries: AuditEntry[], sourceFile: string): number => {
    let savedCount = 0;

    entries.forEach(entry => {
      const mrn = entry.mrn;
      if (!mrn) return;

      const existingCase = getCase(mrn);

      const groundTruth: GroundTruth = {
        primary_icd: entry.primary_icd,
        secondary_icds: entry.secondary_icds || [],
        cpt_codes: entry.cpt_codes || [],
        auditor_notes: entry.auditor_notes || ''
      };

      const newCase: MedicalCase = {
        mrn,
        status: existingCase?.raw_text ? 'complete' : 'incomplete_truth_only',
        ground_truth: groundTruth,
        raw_text: existingCase?.raw_text,
        metadata: {
          ...existingCase?.metadata,
          audit_filename_ref: entry.audit_filename_ref,
          audit_source: sourceFile
        }
      };

      addCase(newCase);
      savedCount++;
    });

    return savedCount;
  };

  const ingestRawNote = (text: string, fileName: string): { success: boolean; mrn: string | null } => {
    const mrn = extractMRN(text);

    if (!mrn) {
      return { success: false, mrn: null };
    }

    const existingCase = getCase(mrn);

    const newCase: MedicalCase = {
      mrn,
      status: existingCase?.ground_truth ? 'complete' : 'incomplete_note_only',
      ground_truth: existingCase?.ground_truth,
      raw_text: text,
      metadata: {
        ...existingCase?.metadata,
        raw_note_file: fileName
      }
    };

    addCase(newCase);
    return { success: true, mrn };
  };

  const addTestResult = (result: Omit<TestResult, 'id' | 'timestamp'>) => {
    const newResult: TestResult = {
      ...result,
      id: generateId(),
      timestamp: new Date().toISOString()
    };
    setTestResults(prev => [newResult, ...prev]);
  };

  return (
    <DataContext.Provider value={{
      cases,
      addCase,
      updateCase,
      getCase,
      getCompleteCases,
      ingestAuditEntries,
      ingestRawNote,
      testResults,
      addTestResult,
      apiKey,
      setApiKey
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
