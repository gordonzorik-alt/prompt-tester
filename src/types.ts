// Core data types for Medical Coding Truth Database

export interface GroundTruth {
  primary_icd: string;
  secondary_icds: string[];
  cpt_codes: string[];
  auditor_notes: string;
}

export interface CaseMetadata {
  audit_filename_ref?: string;
  audit_source?: string;
  raw_note_file?: string;
}

export interface MedicalCase {
  mrn: string;
  status: 'complete' | 'incomplete_truth_only' | 'incomplete_note_only';
  ground_truth?: GroundTruth;
  raw_text?: string;
  metadata?: CaseMetadata;
}

export interface TestResult {
  id: string;
  timestamp: string;
  mrn: string;
  model: string;
  prompt_name: string;
  primary_match: boolean;
  cpt_recall: number;
  missed_cpts: string[];
  hallucinated_cpts: string[];
  pred_primary: string;
  pred_cpts: string[];
  gold_primary: string;
  gold_cpts: string[];
  reasoning?: string;
}

export interface CodingPrediction {
  primary_icd: string;
  secondary_icds: string[];
  cpt_codes: string[];
  reasoning: string;
}

export interface AuditEntry {
  mrn: string;
  audit_filename_ref: string;
  primary_icd: string;
  secondary_icds: string[];
  cpt_codes: string[];
  auditor_notes: string;
}

export type ModelOption = 'gemini-2.0-flash-exp' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
