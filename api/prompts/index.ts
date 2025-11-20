// GET /api/prompts - Get all saved prompts
// POST /api/prompts - Save a prompt

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
      const result = await db.execute('SELECT * FROM saved_prompts ORDER BY created_at DESC');
      const formatted = result.rows.map(p => ({
        id: p.id,
        name: p.name,
        text: p.text,
        createdAt: p.created_at
      }));
      return res.json(formatted);
    }

    if (req.method === 'POST') {
      const { id, name, text, createdAt } = req.body;

      await db.execute({
        sql: `
          INSERT INTO saved_prompts (id, name, text, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            text = excluded.text
        `,
        args: [id, name, text, createdAt]
      });

      return res.json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
