import type { Request, Response, NextFunction } from 'express';
import * as db from '../services/database.js';
import { verifySessionToken } from '../services/session.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') || '';
  const userId = verifySessionToken(header.startsWith('Bearer ') ? header.slice(7).trim() : '');
  if (!userId) { res.status(401).json({ success: false, message: 'Your session has expired. Please log in again.' }); return; }
  db.runForUser(userId, next);
}
