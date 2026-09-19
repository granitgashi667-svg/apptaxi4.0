import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';

const router = Router();

router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM tariffs WHERE tenant_id = ? ORDER BY name')
    .all(req.user.tenantId);
  res.json({ success: true, tariffs: rows });
});

router.post('/', auth, (req, res) => {
  const { name, base_price, price_per_km } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Emri është i detyrueshëm' });

  const info = db.prepare(`
    INSERT INTO tariffs (tenant_id, name, base_price, price_per_km)
    VALUES (?, ?, ?, ?)
  `).run(req.user.tenantId, name, base_price || 0, price_per_km || 0);

  res.json({ success: true, id: info.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const { name, base_price, price_per_km, active } = req.body;
  db.prepare(`
    UPDATE tariffs SET
      name = COALESCE(?, name), base_price = COALESCE(?, base_price),
      price_per_km = COALESCE(?, price_per_km), active = COALESCE(?, active)
    WHERE id = ? AND tenant_id = ?
  `).run(name, base_price, price_per_km, active, req.params.id, req.user.tenantId);
  res.json({ success: true });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM tariffs WHERE id = ? AND tenant_id = ?')
    .run(req.params.id, req.user.tenantId);
  res.json({ success: true });
});

export default router;
