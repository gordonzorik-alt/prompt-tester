// Gemini AI Service for Medical Coding

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AuditEntry, CodingPrediction, ModelOption } from '../types';

// Initialize Gemini client
const getGenAI = () => {
  const apiKey = localStorage.getItem('gemini_api_key');
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
  model: ModelOption = 'gemini-2.0-flash-exp'
): Promise<AuditEntry[]> {
  const genAI = getGenAI();
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
  model: ModelOption = 'gemini-2.0-flash-exp'
): Promise<string> {
  const genAI = getGenAI();
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
  model: ModelOption = 'gemini-2.0-flash-exp'
): Promise<CodingPrediction> {
  const genAI = getGenAI();
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
