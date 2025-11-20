// Health check endpoint for debugging

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  return res.json({
    status: 'ok',
    env: {
      hasDbUrl: !!process.env.TURSO_DATABASE_URL,
      hasAuthToken: !!process.env.TURSO_AUTH_TOKEN,
      dbUrlPreview: process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.substring(0, 30) + '...' : 'NOT SET'
    }
  });
}
