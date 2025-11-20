// Gemini AI Service for Medical Coding

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AuditEntry, CodingPrediction, ModelOption } from '../types';

// Initialize Gemini client with provided API key
const getGenAI = (apiKey: string) => {
  if (!apiKey) {
    throw new Error('Gemini API key not found. Please set it in settings.');
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Extract audit entries from PDF using Gemini Vision
 */
export async function extractAuditFromPDF(
  fileData: ArrayBuffer,
  _fileName: string,
  model: ModelOption = 'gemini-3-pro-preview',
  apiKey: string
): Promise<AuditEntry[]> {
  const genAI = getGenAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const base64Data = arrayBufferToBase64(fileData);

  const prompt = `
    Analyze this Medical Coding Audit PDF. It contains multiple encounters.

    For EACH encounter (indicated by a Green Header or 'Details' section):
    1. **mrn**: Extract the 'Medical Record Number' from the Details section.
    2. **audit_filename_ref**: Extract the filename string from the Green Header bar.
    3. **cpt_codes**: Look at the 'Codes' table. Look ONLY at the 'Auditor' column (Right Side).
       - Combine the Code + Modifier column. Example: If Code is '99214' and Mod is '25', output '99214-25'.
       - IGNORE the 'Office Transcription' column completely.
    4. **primary_icd**: The FIRST ICD-10 code listed in the 'Auditor' column.
    5. **secondary_icds**: Any other ICD-10 codes in the 'Auditor' column (after the first).
    6. **auditor_notes**: Text from 'Auditor notes' section.

    Return a JSON array of objects matching this schema:
    [
      {
        "mrn": "string",
        "audit_filename_ref": "string",
        "primary_icd": "string",
        "secondary_icds": ["string"],
        "cpt_codes": ["string"],
        "auditor_notes": "string"
      }
    ]
  `;

  const result = await geminiModel.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Data
      }
    },
    prompt
  ]);

  const response = await result.response;
  const text = response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not parse audit entries from response');
  }

  return JSON.parse(jsonMatch[0]) as AuditEntry[];
}

/**
 * Extract text from PDF using Gemini Vision
 */
export async function extractTextFromPDF(
  fileData: ArrayBuffer,
  model: ModelOption = 'gemini-3-pro-preview',
  apiKey: string
): Promise<string> {
  const genAI = getGenAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const base64Data = arrayBufferToBase64(fileData);

  const prompt = `
    Extract ALL text from this PDF document exactly as it appears.
    Preserve the formatting and structure as much as possible.
    Return only the extracted text, no additional commentary.
  `;

  const result = await geminiModel.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Data
      }
    },
    prompt
  ]);

  const response = await result.response;
  return response.text();
}

/**
 * Run medical coding prompt on clinical note
 */
export async function runCodingPrompt(
  noteText: string,
  systemPrompt: string,
  model: ModelOption = 'gemini-3-pro-preview',
  apiKey: string
): Promise<CodingPrediction> {
  const genAI = getGenAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const fullPrompt = `
${systemPrompt}

---

**Clinical Note:**
${noteText}

---

Return your analysis as JSON matching this schema:
{
  "primary_icd": "string - the primary ICD-10 code",
  "secondary_icds": ["array of secondary ICD-10 codes"],
  "cpt_codes": ["array of CPT codes with modifiers"],
  "reasoning": "string - detailed explanation of your coding decisions"
}
`;

  const result = await geminiModel.generateContent(fullPrompt);
  const response = await result.response;
  const text = response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse coding prediction from response');
  }

  return JSON.parse(jsonMatch[0]) as CodingPrediction;
}

/**
 * Generate improved prompt based on test results
 */
export async function improvePrompt(
  currentPrompt: string,
  testHistory: Array<{
    primary_match: boolean;
    missed_cpts: string[];
    hallucinated_cpts: string[];
    gold_primary: string;
    pred_primary: string;
    gold_cpts: string[];
    pred_cpts: string[];
  }>,
  model: ModelOption = 'gemini-3-pro-preview',
  apiKey: string,
  focusCases?: Array<{
    mrn: string;
    rawText: string;
    groundTruth: any;
    testResults: Array<{
      primary_match: boolean;
      missed_cpts: string[];
      hallucinated_cpts: string[];
      gold_primary: string;
      pred_primary: string;
    }>;
  }>
): Promise<string> {
  const genAI = getGenAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  // Analyze patterns in test results
  const totalTests = testHistory.length;
  const primaryMatches = testHistory.filter(t => t.primary_match).length;
  const allMissedCpts = testHistory.flatMap(t => t.missed_cpts);
  const allHallucinatedCpts = testHistory.flatMap(t => t.hallucinated_cpts);

  // Build focus cases section if provided
  let focusCasesSection = '';
  if (focusCases && focusCases.length > 0) {
    focusCasesSection = `
## PRIORITY FOCUS CASES
The user has flagged the following cases as problematic. The improved prompt MUST address the issues with these specific cases.

${focusCases.map((fc, i) => {
  const latestTest = fc.testResults[0];
  return `
### Focus Case ${i + 1} (MRN: ${fc.mrn})

**Ground Truth:**
- Primary ICD: ${fc.groundTruth?.primary_icd || 'N/A'}
- CPT Codes: ${fc.groundTruth?.cpt_codes?.join(', ') || 'N/A'}

**Last Test Result:**
- Predicted Primary: ${latestTest?.pred_primary || 'N/A'} ${latestTest?.primary_match ? '✓' : '✗'}
- Missed CPTs: ${latestTest?.missed_cpts?.join(', ') || 'None'}
- Hallucinated CPTs: ${latestTest?.hallucinated_cpts?.join(', ') || 'None'}

**Clinical Note (excerpt):**
\`\`\`
${fc.rawText.substring(0, 2000)}${fc.rawText.length > 2000 ? '...[truncated]' : ''}
\`\`\`
`;
}).join('\n')}

IMPORTANT: Analyze WHY the prompt failed on these specific cases and add targeted instructions to address these failures.
`;
  }

  const analysisPrompt = `You are a prompt engineering expert specializing in medical coding AI systems.

## Current Prompt
${currentPrompt}

## Test Results Analysis (${totalTests} tests)
- Primary ICD Match Rate: ${((primaryMatches / totalTests) * 100).toFixed(1)}%
- Commonly Missed CPT Codes: ${[...new Set(allMissedCpts)].join(', ') || 'None'}
- Commonly Hallucinated CPT Codes: ${[...new Set(allHallucinatedCpts)].join(', ') || 'None'}

## Detailed Test Results
${testHistory.slice(0, 10).map((t, i) => `
Test ${i + 1}:
- Gold Primary: ${t.gold_primary} | Predicted: ${t.pred_primary} | ${t.primary_match ? '✓' : '✗'}
- Gold CPTs: ${t.gold_cpts.join(', ')}
- Predicted CPTs: ${t.pred_cpts.join(', ')}
- Missed: ${t.missed_cpts.join(', ') || 'None'}
- Hallucinated: ${t.hallucinated_cpts.join(', ') || 'None'}
`).join('\n')}
${focusCasesSection}
## Your Task
Generate an IMPROVED version of the prompt that addresses the patterns of errors WITHOUT overfitting to specific cases.

Guidelines:
1. If primary ICD matching is low, add clearer instructions about identifying the main reason for encounter
2. If certain CPT codes are commonly missed, add guidance about those procedure categories
3. If hallucinations are common, add instructions to only code what's explicitly documented
4. Keep improvements GENERALIZABLE - don't reference specific codes unless they represent a pattern
5. Maintain the same output format requirements
6. Add clarifying instructions where the original prompt was ambiguous
${focusCases && focusCases.length > 0 ? '7. PAY SPECIAL ATTENTION to the focus cases - understand what went wrong and add specific guidance to prevent those errors' : ''}

Return ONLY the improved prompt text, nothing else.`;

  const result = await geminiModel.generateContent(analysisPrompt);
  const response = await result.response;
  return response.text().trim();
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
