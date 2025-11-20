// GET /api/cases - Get all cases
// POST /api/cases - Add or update a case

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDb();

    if (req.method === 'GET') {
      const result = await db.execute('SELECT * FROM cases ORDER BY updated_at DESC');
      const formatted = result.rows.map(c => ({
        mrn: c.mrn,
        status: c.status,
        specialty: c.specialty,
        ground_truth: c.ground_truth ? JSON.parse(c.ground_truth as string) : undefined,
        raw_text: c.raw_text,
        metadata: c.metadata ? JSON.parse(c.metadata as string) : undefined
      }));
      return res.json(formatted);
    }

    if (req.method === 'POST') {
      const { mrn, status, specialty, ground_truth, raw_text, metadata } = req.body;

      await db.execute({
        sql: `
          INSERT INTO cases (mrn, status, specialty, ground_truth, raw_text, metadata, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(mrn) DO UPDATE SET
            status = excluded.status,
            specialty = COALESCE(excluded.specialty, cases.specialty),
            ground_truth = COALESCE(excluded.ground_truth, cases.ground_truth),
            raw_text = COALESCE(excluded.raw_text, cases.raw_text),
            metadata = excluded.metadata,
            updated_at = datetime('now')
        `,
        args: [
          mrn,
          status,
          specialty || null,
          ground_truth ? JSON.stringify(ground_truth) : null,
          raw_text || null,
          metadata ? JSON.stringify(metadata) : null
        ]
      });

      return res.json({ success: true, mrn });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
