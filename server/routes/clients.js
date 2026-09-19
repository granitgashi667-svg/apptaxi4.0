import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';

const router = Router();

router.get('/', auth, (req, res) => {
  const { search } = req.query;
  const parts = ['tenant_id = ?'];
  const params = [req.user.tenantId];

  if (search) {
    parts.push('(phone LIKE ? OR name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const rows = db.prepare(`
    SELECT * FROM clients WHERE ${parts.join(' AND ')}
    ORDER BY created_at DESC LIMIT 200
  `).all(...params);
  res.json({ success: true, clients: rows });
});

router.get('/by-phone/:phone', auth, (req, res) => {
  const c = db.prepare('SELECT * FROM clients WHERE tenant_id = ? AND phone = ?')
    .get(req.user.tenantId, req.params.phone);
  res.json({ success: true, client: c || null });
});

router.post('/', auth, (req, res) => {
  const { phone, name, email, address } = req.body;
  if (!phone) return res.status(400).json({ success: false, error: 'Telefoni është i detyrueshëm' });

  const info = db.prepare(`
    INSERT INTO clients (tenant_id, phone, name, email, address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.tenantId, phone, name || null, email || null, address || null);

  res.json({ success: true, id: info.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const { name, email, address, blocked, loyalty_points, wallet } = req.body;
  db.prepare(`
    UPDATE clients SET
      name = COALESCE(?, name), email = COALESCE(?, email),
      address = COALESCE(?, address), blocked = COALESCE(?, blocked),
      loyalty_points = COALESCE(?, loyalty_points),
      wallet = COALESCE(?, wallet)
    WHERE id = ? AND tenant_id = ?
  `).run(name, email, address, blocked, loyalty_points, wallet, req.params.id, req.user.tenantId);
  res.json({ success: true });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ? AND tenant_id = ?')
    .run(req.params.id, req.user.tenantId);
  res.json({ success: true });
});

export default router;
