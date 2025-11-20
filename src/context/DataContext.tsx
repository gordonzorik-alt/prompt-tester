// React Context for Medical Coding Data with SQLite API persistence

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { MedicalCase, TestResult, GroundTruth, AuditEntry, Specialty, SavedPrompt } from '../types';
import { generateId, extractMRN } from '../utils';

// Use relative URL for production (Vercel), absolute for local dev
const API_BASE = import.meta.env.DEV ? 'http://localhost:3009/api' : '/api';

interface DataContextType {
  // Cases
  cases: MedicalCase[];
  addCase: (caseData: MedicalCase) => void;
  updateCase: (mrn: string, updates: Partial<MedicalCase>) => void;
  getCase: (mrn: string) => MedicalCase | undefined;
  getCompleteCases: () => MedicalCase[];

  // Audit ingestion
  ingestAuditEntries: (entries: AuditEntry[], sourceFile: string, specialty: Specialty) => number;

  // Note ingestion
  ingestRawNote: (text: string, fileName: string) => { success: boolean; mrn: string | null };

  // Test results
  testResults: TestResult[];
  addTestResult: (result: Omit<TestResult, 'id' | 'timestamp'>) => void;

  // Saved prompts
  savedPrompts: SavedPrompt[];
  savePrompt: (name: string, text: string) => void;
  deletePrompt: (id: string) => void;

  // Flagged cases for focus improvement
  flaggedMrns: Set<string>;
  toggleFlaggedMrn: (mrn: string) => void;
  clearFlaggedMrns: () => void;
  getFlaggedCasesWithNotes: () => Array<{ mrn: string; rawText: string; groundTruth: any; testResults: TestResult[] }>;

  // API Key
  apiKey: string;
  setApiKey: (key: string) => void;

  // Loading state
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<MedicalCase[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [apiKey, setApiKeyState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [flaggedMrns, setFlaggedMrns] = useState<Set<string>>(new Set());

  // Load all data from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [casesRes, resultsRes, promptsRes, apiKeyRes] = await Promise.all([
          fetch(`${API_BASE}/cases`),
          fetch(`${API_BASE}/results`),
          fetch(`${API_BASE}/prompts`),
          fetch(`${API_BASE}/settings/gemini_api_key`)
        ]);

        if (casesRes.ok) {
          const casesData = await casesRes.json();
          setCases(casesData);
        }

        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          setTestResults(resultsData);
        }

        if (promptsRes.ok) {
          const promptsData = await promptsRes.json();
          setSavedPrompts(promptsData);
        }

        if (apiKeyRes.ok) {
          const { value } = await apiKeyRes.json();
          if (value) setApiKeyState(value);
        }
      } catch (error) {
        console.error('Failed to load data from API:', error);
        // Fall back to localStorage if API is unavailable
        const savedCases = localStorage.getItem('medical_coder_cases');
        const savedResults = localStorage.getItem('medical_coder_results');
        const loadedPrompts = localStorage.getItem('medical_coder_prompts');
        const savedApiKey = localStorage.getItem('gemini_api_key');

        if (savedCases) setCases(JSON.parse(savedCases));
        if (savedResults) setTestResults(JSON.parse(savedResults));
        if (loadedPrompts) setSavedPrompts(JSON.parse(loadedPrompts));
        if (savedApiKey) setApiKeyState(savedApiKey);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    setApiKeyState(key);
    try {
      await fetch(`${API_BASE}/settings/gemini_api_key`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: key })
      });
    } catch (error) {
      console.error('Failed to save API key:', error);
      localStorage.setItem('gemini_api_key', key);
    }
  }, []);

  const addCase = useCallback(async (caseData: MedicalCase) => {
    setCases(prev => {
      const existing = prev.findIndex(c => c.mrn === caseData.mrn);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], ...caseData };
        return updated;
      }
      return [...prev, caseData];
    });

    // Persist to API
    try {
      await fetch(`${API_BASE}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData)
      });
    } catch (error) {
      console.error('Failed to save case:', error);
    }
  }, []);

  const updateCase = useCallback(async (mrn: string, updates: Partial<MedicalCase>) => {
    setCases(prev => prev.map(c =>
      c.mrn === mrn ? { ...c, ...updates } : c
    ));

    // Persist to API
    try {
      await fetch(`${API_BASE}/cases/${mrn}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (error) {
      console.error('Failed to update case:', error);
    }
  }, []);

  const getCase = useCallback((mrn: string) => {
    return cases.find(c => c.mrn === mrn);
  }, [cases]);

  const getCompleteCases = useCallback(() => {
    return cases.filter(c => c.status === 'complete');
  }, [cases]);

  const ingestAuditEntries = useCallback((entries: AuditEntry[], sourceFile: string, specialty: Specialty): number => {
    let savedCount = 0;

    entries.forEach(entry => {
      const mrn = entry.mrn;
      if (!mrn) return;

      const existingCase = cases.find(c => c.mrn === mrn);

      const groundTruth: GroundTruth = {
        primary_icd: entry.primary_icd,
        secondary_icds: entry.secondary_icds || [],
        cpt_codes: entry.cpt_codes || [],
        auditor_notes: entry.auditor_notes || ''
      };

      const newCase: MedicalCase = {
        mrn,
        status: existingCase?.raw_text ? 'complete' : 'incomplete_truth_only',
        specialty: existingCase?.specialty || specialty,
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
  }, [cases, addCase]);

  const ingestRawNote = useCallback((text: string, fileName: string): { success: boolean; mrn: string | null } => {
    const mrn = extractMRN(text);

    if (!mrn) {
      return { success: false, mrn: null };
    }

    const existingCase = cases.find(c => c.mrn === mrn);

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
  }, [cases, addCase]);

  const addTestResult = useCallback(async (result: Omit<TestResult, 'id' | 'timestamp'>) => {
    const newResult: TestResult = {
      ...result,
      id: generateId(),
      timestamp: new Date().toISOString()
    };
    setTestResults(prev => [newResult, ...prev]);

    // Persist to API
    try {
      await fetch(`${API_BASE}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResult)
      });
    } catch (error) {
      console.error('Failed to save test result:', error);
    }
  }, []);

  const savePrompt = useCallback(async (name: string, text: string) => {
    const existing = savedPrompts.find(p => p.name === name);

    if (existing) {
      setSavedPrompts(prev => prev.map(p =>
        p.name === name ? { ...p, text } : p
      ));

      // Update in API
      try {
        await fetch(`${API_BASE}/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existing.id, name, text, createdAt: existing.createdAt })
        });
      } catch (error) {
        console.error('Failed to update prompt:', error);
      }
    } else {
      const newPrompt: SavedPrompt = {
        id: generateId(),
        name,
        text,
        createdAt: new Date().toISOString()
      };
      setSavedPrompts(prev => [...prev, newPrompt]);

      // Save to API
      try {
        await fetch(`${API_BASE}/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPrompt)
        });
      } catch (error) {
        console.error('Failed to save prompt:', error);
      }
    }
  }, [savedPrompts]);

  const deletePrompt = useCallback(async (id: string) => {
    setSavedPrompts(prev => prev.filter(p => p.id !== id));

    // Delete from API
    try {
      await fetch(`${API_BASE}/prompts/${id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    }
  }, []);

  const toggleFlaggedMrn = useCallback((mrn: string) => {
    setFlaggedMrns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mrn)) {
        newSet.delete(mrn);
      } else {
        newSet.add(mrn);
      }
      return newSet;
    });
  }, []);

  const clearFlaggedMrns = useCallback(() => {
    setFlaggedMrns(new Set());
  }, []);

  const getFlaggedCasesWithNotes = useCallback(() => {
    return Array.from(flaggedMrns).map(mrn => {
      const caseData = cases.find(c => c.mrn === mrn);
      const caseTestResults = testResults.filter(r => r.mrn === mrn);
      return {
        mrn,
        rawText: caseData?.raw_text || '',
        groundTruth: caseData?.ground_truth || null,
        testResults: caseTestResults
      };
    }).filter(c => c.rawText); // Only return cases with actual notes
  }, [flaggedMrns, cases, testResults]);

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
      savedPrompts,
      savePrompt,
      deletePrompt,
      flaggedMrns,
      toggleFlaggedMrn,
      clearFlaggedMrns,
      getFlaggedCasesWithNotes,
      apiKey,
      setApiKey,
      isLoading
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
