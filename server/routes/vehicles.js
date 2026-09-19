import { Router } from 'express';
import db from '../database.js';
import { auth, requireRole } from '../middleware.js';

const router = Router();

router.get('/', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT v.*, u.name AS driver_name
    FROM vehicles v
    LEFT JOIN users u ON u.id = v.driver_id
    WHERE v.tenant_id = ? ORDER BY v.plate
  `).all(req.user.tenantId);
  res.json({ success: true, vehicles: rows });
});

router.post('/', auth, requireRole('manager', 'operator'), (req, res) => {
  const { plate, model, year, color, driver_id } = req.body;
  if (!plate) return res.status(400).json({ success: false, error: 'Targa është e detyrueshme' });

  const info = db.prepare(`
    INSERT INTO vehicles (tenant_id, plate, model, year, color, driver_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.tenantId, plate, model || null, year || null, color || null, driver_id || null);

  res.json({ success: true, id: info.lastInsertRowid });
});

router.put('/:id', auth, requireRole('manager', 'operator'), (req, res) => {
  const { plate, model, year, color, driver_id, active } = req.body;
  db.prepare(`
    UPDATE vehicles SET
      plate = COALESCE(?, plate), model = COALESCE(?, model),
      year = COALESCE(?, year), color = COALESCE(?, color),
      driver_id = COALESCE(?, driver_id), active = COALESCE(?, active)
    WHERE id = ? AND tenant_id = ?
  `).run(plate, model, year, color, driver_id, active, req.params.id, req.user.tenantId);
  res.json({ success: true });
});

router.delete('/:id', auth, requireRole('manager'), (req, res) => {
  db.prepare('DELETE FROM vehicles WHERE id = ? AND tenant_id = ?')
    .run(req.params.id, req.user.tenantId);
  res.json({ success: true });
});

export default router;
