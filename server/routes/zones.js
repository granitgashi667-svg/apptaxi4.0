import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';

const router = Router();

router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM zones WHERE tenant_id = ? ORDER BY name')
    .all(req.user.tenantId);
  res.json({ success: true, zones: rows });
});

router.post('/', auth, (req, res) => {
  const { name, lat, lng, radius, backup_1, backup_2, backup_3, backup_4, backup_5 } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Emri është i detyrueshëm' });

  const info = db.prepare(`
    INSERT INTO zones (tenant_id, name, lat, lng, radius, backup_1, backup_2, backup_3, backup_4, backup_5)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.tenantId, name, lat ?? null, lng ?? null, radius || 500,
    backup_1 ?? null, backup_2 ?? null, backup_3 ?? null, backup_4 ?? null, backup_5 ?? null);

  res.json({ success: true, id: info.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const { name, lat, lng, radius, backup_1, backup_2, backup_3, backup_4, backup_5, active } = req.body;
  db.prepare(`
    UPDATE zones SET
      name = COALESCE(?, name), lat = COALESCE(?, lat), lng = COALESCE(?, lng),
      radius = COALESCE(?, radius),
      backup_1 = COALESCE(?, backup_1), backup_2 = COALESCE(?, backup_2),
      backup_3 = COALESCE(?, backup_3), backup_4 = COALESCE(?, backup_4),
      backup_5 = COALESCE(?, backup_5), active = COALESCE(?, active)
    WHERE id = ? AND tenant_id = ?
  `).run(name, lat, lng, radius, backup_1, backup_2, backup_3, backup_4, backup_5,
    active, req.params.id, req.user.tenantId);
  res.json({ success: true });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM zones WHERE id = ? AND tenant_id = ?')
    .run(req.params.id, req.user.tenantId);
  res.json({ success: true });
});

export default router;
