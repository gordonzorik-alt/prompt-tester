// PATCH /api/cases/:mrn - Update a case
// DELETE /api/cases/:mrn - Delete a case

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { mrn } = req.query;

  try {
    await initDb();

    if (req.method === 'PATCH') {
      const updates = req.body;

      const existing = await db.execute({
        sql: 'SELECT * FROM cases WHERE mrn = ?',
        args: [mrn as string]
      });

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      const row = existing.rows[0];

      await db.execute({
        sql: `
          UPDATE cases SET
            status = ?,
            specialty = ?,
            ground_truth = ?,
            raw_text = ?,
            metadata = ?,
            updated_at = datetime('now')
          WHERE mrn = ?
        `,
        args: [
          updates.status || row.status,
          updates.specialty || row.specialty,
          updates.ground_truth ? JSON.stringify(updates.ground_truth) : row.ground_truth,
          updates.raw_text || row.raw_text,
          updates.metadata ? JSON.stringify(updates.metadata) : row.metadata,
          mrn as string
        ]
      });

      return res.json({ success: true });
    }

    if (req.method === 'DELETE') {
      await db.execute({
        sql: 'DELETE FROM cases WHERE mrn = ?',
        args: [mrn as string]
      });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
