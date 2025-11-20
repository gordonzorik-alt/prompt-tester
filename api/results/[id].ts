// DELETE /api/results/:id - Delete a test result

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    await initDb();

    if (req.method === 'DELETE') {
      await db.execute({
        sql: 'DELETE FROM test_results WHERE id = ?',
        args: [id as string]
      });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
