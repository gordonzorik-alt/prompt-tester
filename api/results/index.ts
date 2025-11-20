// GET /api/results - Get all test results
// POST /api/results - Add a test result

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, initDb } from '../_db';

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
      const result = await db.execute('SELECT * FROM test_results ORDER BY timestamp DESC');
      const formatted = result.rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        mrn: r.mrn,
        model: r.model,
        prompt_name: r.prompt_name,
        prompt_text: r.prompt_text,
        primary_match: Boolean(r.primary_match),
        cpt_recall: r.cpt_recall,
        missed_cpts: r.missed_cpts ? JSON.parse(r.missed_cpts as string) : [],
        hallucinated_cpts: r.hallucinated_cpts ? JSON.parse(r.hallucinated_cpts as string) : [],
        pred_primary: r.pred_primary,
        pred_cpts: r.pred_cpts ? JSON.parse(r.pred_cpts as string) : [],
        gold_primary: r.gold_primary,
        gold_cpts: r.gold_cpts ? JSON.parse(r.gold_cpts as string) : [],
        reasoning: r.reasoning
      }));
      return res.json(formatted);
    }

    if (req.method === 'POST') {
      const result = req.body;

      await db.execute({
        sql: `
          INSERT INTO test_results (
            id, timestamp, mrn, model, prompt_name, prompt_text,
            primary_match, cpt_recall, missed_cpts, hallucinated_cpts,
            pred_primary, pred_cpts, gold_primary, gold_cpts, reasoning
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          result.id,
          result.timestamp,
          result.mrn,
          result.model,
          result.prompt_name,
          result.prompt_text || null,
          result.primary_match ? 1 : 0,
          result.cpt_recall,
          JSON.stringify(result.missed_cpts || []),
          JSON.stringify(result.hallucinated_cpts || []),
          result.pred_primary,
          JSON.stringify(result.pred_cpts || []),
          result.gold_primary,
          JSON.stringify(result.gold_cpts || []),
          result.reasoning || null
        ]
      });

      return res.json({ success: true, id: result.id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
