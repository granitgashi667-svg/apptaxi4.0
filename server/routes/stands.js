import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';

const router = Router();

router.get('/', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, z.name AS zone_name
    FROM stands s LEFT JOIN zones z ON z.id = s.zone_id
    WHERE s.tenant_id = ? ORDER BY s.name
  `).all(req.user.tenantId);
  res.json({ success: true, stands: rows });
});

router.post('/', auth, (req, res) => {
  const { name, lat, lng, radius, zone_id } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Emri është i detyrueshëm' });

  const info = db.prepare(`
    INSERT INTO stands (tenant_id, name, lat, lng, radius, zone_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.tenantId, name, lat ?? null, lng ?? null, radius || 15, zone_id ?? null);

  res.json({ success: true, id: info.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const { name, lat, lng, radius, zone_id, active } = req.body;
  db.prepare(`
    UPDATE stands SET
      name = COALESCE(?, name), lat = COALESCE(?, lat), lng = COALESCE(?, lng),
      radius = COALESCE(?, radius), zone_id = COALESCE(?, zone_id),
      active = COALESCE(?, active)
    WHERE id = ? AND tenant_id = ?
  `).run(name, lat, lng, radius, zone_id, active, req.params.id, req.user.tenantId);
  res.json({ success: true });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM stands WHERE id = ? AND tenant_id = ?')
    .run(req.params.id, req.user.tenantId);
  res.json({ success: true });
});

export default router;
