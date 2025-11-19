// Utility functions for Medical Coding Truth Database

import type { GroundTruth, CodingPrediction } from './types';

/**
 * Calculate scoring metrics between prediction and gold standard
 */
export function calculateScore(gold: GroundTruth, pred: CodingPrediction) {
  // Primary ICD match (exact match)
  const primaryMatch = gold.primary_icd.toLowerCase().trim() === pred.primary_icd.toLowerCase().trim();

  // CPT recall calculation
  const goldCpts = new Set(gold.cpt_codes.map(c => c.toLowerCase().trim()));
  const predCpts = new Set(pred.cpt_codes.map(c => c.toLowerCase().trim()));

  const matchedCpts = [...goldCpts].filter(c => predCpts.has(c));
  const missedCpts = [...goldCpts].filter(c => !predCpts.has(c));
  const hallucinatedCpts = [...predCpts].filter(c => !goldCpts.has(c));

  const cptRecall = goldCpts.size > 0 ? matchedCpts.length / goldCpts.size : 0;
  const cptPrecision = predCpts.size > 0 ? matchedCpts.length / predCpts.size : 0;

  return {
    primary_match: primaryMatch,
    cpt_recall: cptRecall,
    cpt_precision: cptPrecision,
    matched_cpts: matchedCpts,
    missed_cpts: missedCpts,
    hallucinated_cpts: hallucinatedCpts
  };
}

/**
 * Generate unique ID for test results
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Extract MRN from text using regex patterns
 */
export function extractMRN(text: string): string | null {
  // Pattern 1: "id #2857430" or "(id #2857430,"
  let match = text.match(/id\s*#\s*(\d+)/i);
  if (match) return match[1];

  // Pattern 2: "MRN: 12345" or "Medical Record Number: 12345"
  match = text.match(/MRN:?\s*(\d+)/i);
  if (match) return match[1];

  // Pattern 3: "Medical Record Number 12345"
  match = text.match(/Medical Record (?:Number|#):?\s*(\d+)/i);
  if (match) return match[1];

  // Pattern 4: Just look for a 7-digit number that's likely an MRN
  match = text.match(/\b(\d{7})\b/);
  if (match) return match[1];

  return null;
}

/**
 * Get status color for case status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'complete':
      return '#22c55e'; // green
    case 'incomplete_truth_only':
      return '#eab308'; // yellow
    case 'incomplete_note_only':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Get status badge text
 */
export function getStatusBadge(status: string): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'incomplete_truth_only':
      return 'Truth Only';
    case 'incomplete_note_only':
      return 'Note Only';
    default:
      return 'Unknown';
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Calculate aggregate statistics from test results
 */
export function calculateAggregateStats(results: { primary_match: boolean; cpt_recall: number }[]) {
  if (results.length === 0) {
    return {
      total: 0,
      primaryAccuracy: 0,
      avgCptRecall: 0
    };
  }

  const total = results.length;
  const primaryMatches = results.filter(r => r.primary_match).length;
  const totalRecall = results.reduce((sum, r) => sum + r.cpt_recall, 0);

  return {
    total,
    primaryAccuracy: primaryMatches / total,
    avgCptRecall: totalRecall / total
  };
}
