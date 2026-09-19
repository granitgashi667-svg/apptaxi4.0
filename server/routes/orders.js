import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';
import { generateOrderCode } from '../auth.js';

const router = Router();

// ─── KRIJO POROSI ──────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  const {
    phone, client_name, pickup, pickup_lat, pickup_lng,
    destination, dest_lat, dest_lng, zone, tariff_id, remark,
    price, is_preorder, preorder_date,
  } = req.body;

  if (!phone || !pickup)
    return res.status(400).json({ success: false, error: 'phone dhe pickup janë të detyrueshme' });

  // Gjej ose krijo klient
  let client = db.prepare('SELECT * FROM clients WHERE tenant_id = ? AND phone = ?')
    .get(req.user.tenantId, phone);
  if (!client) {
    const info = db.prepare(`
      INSERT INTO clients (tenant_id, phone, name) VALUES (?, ?, ?)
    `).run(req.user.tenantId, phone, client_name || null);
    client = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
  }

  const code = generateOrderCode();
  const status = is_preorder ? 'preorder' : 'waiting';

  const info = db.prepare(`
    INSERT INTO orders (
      tenant_id, order_code, client_id, phone, client_name,
      pickup, pickup_lat, pickup_lng, destination, dest_lat, dest_lng,
      zone, tariff_id, remark, price, status, is_preorder, preorder_date, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.tenantId, code, client.id, phone, client_name || client.name,
    pickup, pickup_lat ?? null, pickup_lng ?? null,
    destination ?? null, dest_lat ?? null, dest_lng ?? null,
    zone ?? null, tariff_id ?? null, remark ?? null, price ?? null,
    status, is_preorder ? 1 : 0, preorder_date ?? null, req.user.userId
  );

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
  req.app.get('io')?.to(`tenant:${req.user.tenantId}`).emit('order_created', order);

  res.json({ success: true, order });
});

// ─── LISTA (me filtra) ─────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { status, driver_id, from, to, limit = 100 } = req.query;
  const parts = ['tenant_id = ?'];
  const params = [req.user.tenantId];

  if (status) { parts.push('status = ?'); params.push(status); }
  if (driver_id) { parts.push('driver_id = ?'); params.push(+driver_id); }
  if (from) { parts.push('created_at >= ?'); params.push(from); }
  if (to) { parts.push('created_at <= ?'); params.push(to); }

  params.push(+limit);
  const rows = db.prepare(`
    SELECT o.*, d.name AS driver_name, u.name AS operator_name
    FROM orders o
    LEFT JOIN users d ON d.id = o.driver_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE ${parts.join(' AND ')}
    ORDER BY o.created_at DESC LIMIT ?
  `).all(...params);

  res.json({ success: true, orders: rows });
});

router.get('/waiting', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM orders WHERE tenant_id = ? AND status = 'waiting'
    ORDER BY created_at ASC
  `).all(req.user.tenantId);
  res.json({ success: true, orders: rows });
});

router.get('/preorders', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM orders WHERE tenant_id = ? AND is_preorder = 1
    AND status NOT IN ('completed','cancelled')
    ORDER BY preorder_date ASC
  `).all(req.user.tenantId);
  res.json({ success: true, orders: rows });
});

router.get('/:id', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?')
    .get(req.params.id, req.user.tenantId);
  if (!order) return res.status(404).json({ success: false, error: 'Nuk u gjet' });
  res.json({ success: true, order });
});

// ─── CAKTO SHOFER ──────────────────────────────────────────────
router.post('/:id/assign', auth, (req, res) => {
  const { driver_id } = req.body;
  if (!driver_id) return res.status(400).json({ success: false, error: 'driver_id mungon' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?')
    .get(req.params.id, req.user.tenantId);
  if (!order) return res.status(404).json({ success: false, error: 'Nuk u gjet' });

  db.prepare(`
    UPDATE orders SET driver_id = ?, status = 'assigned',
    assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(driver_id, order.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  req.app.get('io')?.to(`tenant:${req.user.tenantId}`).emit('order_updated', updated);
  req.app.get('io')?.to(`user:${driver_id}`).emit('order_assigned', updated);

  res.json({ success: true, order: updated });
});

// ─── PËRDITËSO STATUS ──────────────────────────────────────────
router.put('/:id', auth, (req, res) => {
  const { status, price, remark, destination, dest_lat, dest_lng } = req.body;
  const id = +req.params.id;

  const patch = [];
  const params = [];
  if (status)      { patch.push('status = ?');      params.push(status); }
  if (price != null){ patch.push('price = ?');       params.push(price); }
  if (remark != null){ patch.push('remark = ?');     params.push(remark); }
  if (destination != null){ patch.push('destination = ?'); params.push(destination); }
  if (dest_lat != null){ patch.push('dest_lat = ?'); params.push(dest_lat); }
  if (dest_lng != null){ patch.push('dest_lng = ?'); params.push(dest_lng); }

  if (status === 'arrived')   patch.push("arrived_at = CURRENT_TIMESTAMP");
  if (status === 'completed') patch.push("completed_at = CURRENT_TIMESTAMP");
  if (status === 'cancelled') patch.push("cancelled_at = CURRENT_TIMESTAMP");
  patch.push('updated_at = CURRENT_TIMESTAMP');

  params.push(id, req.user.tenantId);

  db.prepare(`UPDATE orders SET ${patch.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  req.app.get('io')?.to(`tenant:${req.user.tenantId}`).emit('order_updated', updated);
  res.json({ success: true, order: updated });
});

// ─── ANULO ─────────────────────────────────────────────────────
router.post('/:id/cancel', auth, (req, res) => {
  const { reason } = req.body;
  db.prepare(`
    UPDATE orders SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
    cancel_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(reason || null, req.params.id, req.user.tenantId);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  req.app.get('io')?.to(`tenant:${req.user.tenantId}`).emit('order_updated', updated);
  res.json({ success: true, order: updated });
});

// ─── FSHIJ ─────────────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ? AND tenant_id = ?')
    .run(req.params.id, req.user.tenantId);
  res.json({ success: true });
});

export default router;
