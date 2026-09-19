import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';

const router = Router();

router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM custom_locations WHERE tenant_id = ? ORDER BY label')
    .all(req.user.tenantId);
  res.json({ success: true, locations: rows });
});

router.post('/', auth, (req, res) => {
  const { label, address, lat, lng } = req.body;
  if (!label) return res.status(400).json({ success: false, error: 'Etiketa është e detyrueshme' });

  const info = db.prepare(`
    INSERT INTO custom_locations (tenant_id, label, address, lat, lng)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.tenantId, label, address ?? null, lat ?? null, lng ?? null);

  res.json({ success: true, id: info.lastInsertRowid });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM custom_locations WHERE id = ? AND tenant_id = ?')
    .run(req.params.id, req.user.tenantId);
  res.json({ success: true });
});

export default router;
