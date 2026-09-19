import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';

const router = Router();

router.get('/threads', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT thread_id,
           MAX(created_at) AS last_at,
           COUNT(*) AS count
    FROM messages
    WHERE tenant_id = ? AND (from_id = ? OR to_id = ?)
    GROUP BY thread_id ORDER BY last_at DESC
  `).all(req.user.tenantId, req.user.userId, req.user.userId);
  res.json({ success: true, threads: rows });
});

router.get('/threads/:id', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM messages WHERE tenant_id = ? AND thread_id = ?
    ORDER BY created_at ASC LIMIT 200
  `).all(req.user.tenantId, req.params.id);
  res.json({ success: true, messages: rows });
});

router.post('/threads/:id/send', auth, (req, res) => {
  const { text, to_id } = req.body;
  if (!text) return res.status(400).json({ success: false, error: 'Tekst bosh' });

  const info = db.prepare(`
    INSERT INTO messages (tenant_id, thread_id, from_id, to_id, text)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.tenantId, +req.params.id, req.user.userId, to_id || null, text);

  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
  req.app.get('io')?.to(`tenant:${req.user.tenantId}`).emit('new_driver_message', msg);
  res.json({ success: true, message: msg });
});

export default router;
