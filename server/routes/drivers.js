import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';

const router = Router();

// ─── LISTA E SHOFERËVE ─────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name, u.phone, u.driver_code, u.active,
           v.plate, v.model, v.color,
           (SELECT event FROM hours_log WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS last_event
    FROM users u
    LEFT JOIN vehicles v ON v.driver_id = u.id
    WHERE u.tenant_id = ? AND u.role = 'driver'
    ORDER BY u.name
  `).all(req.user.tenantId);
  res.json({ success: true, drivers: rows });
});

// ─── SHOFERI AKTUAL ────────────────────────────────────────────
router.get('/me', auth, (req, res) => {
  const row = db.prepare(`
    SELECT u.id, u.username, u.name, u.phone, u.driver_code,
           v.plate, v.model, v.color
    FROM users u
    LEFT JOIN vehicles v ON v.driver_id = u.id
    WHERE u.id = ? AND u.tenant_id = ?
  `).get(req.user.userId, req.user.tenantId);
  res.json({ success: true, driver: row });
});

// ─── PËRDITËSO STATUS / LOCATION ───────────────────────────────
router.put('/:id/status', auth, (req, res) => {
  const { status } = req.body; // free/busy/pause/inactive
  db.prepare(`
    INSERT INTO hours_log (tenant_id, user_id, event) VALUES (?, ?, ?)
  `).run(req.user.tenantId, req.params.id, status);

  req.app.get('io')?.to(`tenant:${req.user.tenantId}`).emit('driver_status', {
    driverId: +req.params.id, status,
  });

  res.json({ success: true });
});

// ─── PËRDITËSO GPS ─────────────────────────────────────────────
router.post('/:id/location', auth, (req, res) => {
  const { lat, lng } = req.body;
  req.app.get('io')?.to(`tenant:${req.user.tenantId}`).emit('driver_location_update', {
    tenantId: req.user.tenantId,
    driverId: +req.params.id,
    lat, lng, at: new Date().toISOString(),
  });
  res.json({ success: true });
});

export default router;
