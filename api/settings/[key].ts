// GET /api/settings/:key - Get a setting
// PUT /api/settings/:key - Set a setting

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { key } = req.query;

  try {
    await initDb();

    if (req.method === 'GET') {
      const result = await db.execute({
        sql: 'SELECT value FROM settings WHERE key = ?',
        args: [key as string]
      });
      const value = result.rows.length > 0 ? result.rows[0].value : null;
      return res.json({ value });
    }

    if (req.method === 'PUT') {
      const { value } = req.body;

      await db.execute({
        sql: `
          INSERT INTO settings (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `,
        args: [key as string, value]
      });

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
